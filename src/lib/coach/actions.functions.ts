// Server functions for the issue action workflow. Every change is validated against the
// workflow rules and the caller's scope, then applied in one database transaction with a
// version check so two people can't overwrite each other.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addDays, followupKey, historyUpTo, digestDates } from "./logic";
import { loadCoachIndex } from "./data.server";
import { digestIssues, forbid, readProfile, storesInScope } from "./guard.server";
import type { ActionBoard, ActionEventRow, ActionRow, BoardItem, IssueActivity, TransitionResult } from "./actions.types";
import {
  ACTION_EVENTS,
  EVENT_PAST,
  WorkflowError,
  nextState,
  notifyTargets,
  type ActionState,
} from "./workflow";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");
const ACTION_COLUMNS = "issue_id, state, assignee_user_id, assignee_name, due_date, block_reason, dismiss_reason, version, updated_at";

function toRow(r: {
  state: ActionState;
  assignee_user_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  block_reason: string | null;
  dismiss_reason: string | null;
  version: number;
  updated_at: string;
}): ActionRow {
  return {
    state: r.state,
    assignee_user_id: r.assignee_user_id,
    assignee_name: r.assignee_name,
    due_date: r.due_date,
    block_reason: r.block_reason,
    dismiss_reason: r.dismiss_reason,
    version: r.version,
    updated_at: r.updated_at,
  };
}

// ---------- board ----------
export const getActionBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ date: dateSchema }).parse(input))
  .handler(async ({ data, context }): Promise<ActionBoard> => {
    const profile = await readProfile(context.supabase, context.userId);
    if (profile.role === "salesperson") forbid("The action board is for managers and store leads");
    const index = await loadCoachIndex();
    const stores = storesInScope(index, profile);
    const storeById = new Map(stores.map((s) => [s.store_id, s]));
    const weeks = digestDates(index.dates).filter((d) => d <= data.date);
    const followups = new Map(index.meta.followups.map((f) => [f.key, f]));

    const base: Omit<BoardItem, "action">[] = [];
    for (const week of weeks) {
      for (const issue of index.dayByDate.get(week)?.issues ?? []) {
        const store = storeById.get(issue.store_id);
        if (!store) continue;
        const f = followups.get(followupKey(issue));
        // The follow-up for this week's send, measured 7 days later (only once that date has passed).
        const history = f ? historyUpTo(f, data.date).filter((h) => h.sent_on === week) : [];
        base.push({
          issue,
          week_date: week,
          zone: store.zone,
          outcome: history[history.length - 1] ?? null,
          followup_due: addDays(week, 7),
        });
      }
    }

    const ids = base.map((b) => b.issue.id);
    const rows = new Map<string, ActionRow>();
    if (ids.length) {
      // RLS limits this to the caller's scope as well.
      const { data: found, error } = await context.supabase.from("issue_actions").select(ACTION_COLUMNS).in("issue_id", ids);
      if (error) throw new Error("Could not read actions");
      for (const r of found ?? []) rows.set(r.issue_id, toRow(r));
    }

    const items: BoardItem[] = base.map((b) => ({ ...b, action: rows.get(b.issue.id) ?? null }));
    return {
      date: data.date,
      items,
      stores: stores.map((s) => s.store_id),
      levers: [...new Set(items.map((i) => i.issue.lever))].sort(),
      weeks,
    };
  });

// ---------- one issue's activity ----------
export const getIssueActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ issueId: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data, context }): Promise<IssueActivity> => {
    const profile = await readProfile(context.supabase, context.userId);
    if (profile.role === "salesperson") forbid("Actions are for managers and store leads");
    const index = await loadCoachIndex();
    const found = digestIssues(index).get(data.issueId);
    if (!found || !storesInScope(index, profile).some((s) => s.store_id === found.issue.store_id)) forbid("This issue is not in your scope");

    const [{ data: row, error: rowError }, { data: events, error: eventsError }] = await Promise.all([
      context.supabase.from("issue_actions").select(ACTION_COLUMNS).eq("issue_id", data.issueId).maybeSingle(),
      context.supabase
        .from("issue_action_events")
        .select("id, actor_name, actor_role, event, from_state, to_state, assignee_name, reason, note, created_at")
        .eq("issue_id", data.issueId)
        .order("created_at", { ascending: true }),
    ]);
    if (rowError || eventsError) throw new Error("Could not read this action's history");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: leadRole } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "store_lead")
      .eq("scope_id", found.issue.store_id)
      .limit(1)
      .maybeSingle();
    let storeLead: IssueActivity["store_lead"] = null;
    if (leadRole) {
      const { data: p } = await supabaseAdmin.from("profiles").select("display_name").eq("id", leadRole.user_id).maybeSingle();
      storeLead = { user_id: leadRole.user_id, name: p?.display_name ?? "Store lead" };
    }

    return {
      issue: found.issue,
      week_date: found.week_date,
      action: row ? toRow(row) : null,
      events: (events ?? []).filter((e) => (ACTION_EVENTS as readonly string[]).includes(e.event)) as ActionEventRow[],
      store_lead: storeLead,
      me: { user_id: context.userId, role: profile.role },
    };
  });

// ---------- change state ----------
const transitionSchema = z.object({
  issueId: z.string().min(1).max(120),
  event: z.enum(ACTION_EVENTS),
  expectedVersion: z.number().int().min(0),
  assignee: z.enum(["store_lead", "me"]).optional(),
  due: dateSchema.optional(),
  reason: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

export const transitionIssueAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => transitionSchema.parse(input))
  .handler(async ({ data, context }): Promise<TransitionResult> => {
    const profile = await readProfile(context.supabase, context.userId);
    if (profile.role === "salesperson") forbid("Salespeople can't change manager actions");
    const index = await loadCoachIndex();
    const found = digestIssues(index).get(data.issueId);
    const store = found ? storesInScope(index, profile).find((s) => s.store_id === found.issue.store_id) : undefined;
    if (!found || !store) forbid("This issue is not in your scope");
    const { issue, week_date } = found;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: readError } = await supabaseAdmin
      .from("issue_actions")
      .select("state, assignee_user_id, version")
      .eq("issue_id", issue.id)
      .maybeSingle();
    if (readError) throw new Error("Could not read the action");
    const snap = { state: (current?.state ?? "open") as ActionState, assigneeUserId: current?.assignee_user_id ?? null };
    const version = current?.version ?? 0;
    if (version !== data.expectedVersion) {
      return { ok: false, code: "conflict", message: "Someone else changed this action. It has been refreshed; please check and try again." };
    }

    // Resolve the assignee for "assign".
    let assignee: { id: string; name: string } | null = null;
    if (data.event === "assign") {
      if (data.assignee === "me") {
        assignee = { id: context.userId, name: profile.display_name };
      } else if (data.assignee === "store_lead") {
        const { data: leadRole } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "store_lead")
          .eq("scope_id", issue.store_id)
          .limit(1)
          .maybeSingle();
        if (leadRole) {
          const { data: p } = await supabaseAdmin.from("profiles").select("display_name").eq("id", leadRole.user_id).maybeSingle();
          assignee = { id: leadRole.user_id, name: p?.display_name ?? "Store lead" };
        }
        if (!assignee) return { ok: false, code: "invalid", message: `${issue.store_id} has no store lead login yet. Assign it to yourself instead.` };
      }
    }

    let toState: ActionState;
    try {
      toState = nextState(snap, { role: profile.role, userId: context.userId }, {
        event: data.event,
        reason: data.reason ?? null,
        note: data.note ?? null,
        hasAssignee: assignee !== null,
      });
    } catch (error) {
      if (error instanceof WorkflowError) return { ok: false, code: "invalid", message: error.message };
      throw error;
    }

    // Who hears about it.
    const target = notifyTargets(data.event);
    let notify: string[] = [];
    if (target === "assignee") {
      const who = assignee?.id ?? snap.assigneeUserId;
      if (who) notify = [who];
    } else if (target === "managers") {
      const { data: ams } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "am").eq("scope_id", issue.area_manager_id);
      notify = (ams ?? []).map((r) => r.user_id);
    }
    const verb = EVENT_PAST[data.event];
    const title =
      data.event === "assign"
        ? `New action for ${issue.store_id}: ${issue.title}`
        : `${profile.display_name} ${verb} “${issue.title}” (${issue.store_id})`;
    const body = [data.reason, data.note].filter(Boolean).join(" · ") || (data.event === "assign" ? issue.action : null);

    const due = data.due ?? (data.event === "assign" ? addDays(week_date, 6) : null);
    const { data: applied, error } = await supabaseAdmin.rpc("apply_issue_transition", {
      _issue_id: issue.id,
      _store_id: issue.store_id,
      _am_id: issue.area_manager_id,
      _zone: store.zone,
      _week_date: week_date,
      _lever: issue.lever,
      _title: issue.title,
      _rupees: issue.rupees,
      _actor: context.userId,
      _actor_name: profile.display_name,
      _actor_role: profile.role,
      _event: data.event,
      _expected_version: data.expectedVersion,
      _to_state: toState,
      _assignee: assignee?.id ?? null,
      _assignee_name: assignee?.name ?? null,
      _set_assignee: data.event === "assign",
      _due: due,
      _reason: data.reason || null,
      _note: data.note || null,
      _notify: notify,
      _notify_kind: data.event,
      _notify_title: title.slice(0, 200),
      _notify_body: body ? body.slice(0, 600) : null,
      _notify_link: `/issue/${issue.id}`,
    } as never);
    if (error) {
      if (error.code === "P0409" || error.message.includes("version_conflict")) {
        return { ok: false, code: "conflict", message: "Someone else changed this action. It has been refreshed; please check and try again." };
      }
      console.error("[actions] transition failed", error.message);
      throw new Error("The change could not be saved. Please try again.");
    }
    const result = Array.isArray(applied) ? applied[0] : applied;
    return { ok: true, state: (result?.new_state ?? toState) as ActionState, version: result?.new_version ?? version + 1 };
  });
