// Server functions for Store Coach. Every handler authenticates the caller and
// reads their role from their own user_roles row (RLS: own row only, no client
// writes) before touching data.json, which lives in a private bucket.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CoachView, ViewProfile } from "./types";
import { forbid, readProfile } from "./guard.server";
import { loadCoachIndex } from "./data.server";
import { buildView, ScopeError } from "./slice.server";
import { buildDemoAccounts, DEMO_PASSWORD } from "./accounts.server";
import { SYSTEM_PROMPT, askModel, buildAiContext, type ChatTurn } from "./ai.server";

export const ASK_LIMIT_PER_HOUR = 10;
const SEED_BATCH = 20;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

// ---------- get-view ----------
export const getView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ date: dateSchema }).parse(input))
  .handler(async ({ data, context }): Promise<CoachView> => {
    const profile = await readProfile(context.supabase, context.userId);
    const index = await loadCoachIndex();
    try {
      return buildView(index, profile, data.date);
    } catch (error) {
      if (error instanceof ScopeError) forbid(error.message);
      throw error;
    }
  });

// ---------- seed-users (HQ only, batched so each call stays small) ----------
export interface SeedResult {
  total: number;
  offset: number;
  processed: number;
  created: number;
  /** Login existed but its profile or role row was missing and has been attached. */
  repaired: number;
  existing: number;
  failed: { email: string; error: string }[];
  next_offset: number | null;
}

export const seedUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ offset: z.number().int().min(0).default(0) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<SeedResult> => {
    const profile = await readProfile(context.supabase, context.userId);
    if (profile.role !== "hq") forbid("Only HQ can seed demo users");

    const index = await loadCoachIndex();
    const accounts = buildDemoAccounts(index);
    const batch = accounts.slice(data.offset, data.offset + SEED_BATCH);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // An account is complete once it has both a profile and a role row.
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .in(
        "email",
        batch.map((a) => a.email),
      );
    if (existingError) throw new Error(`Could not check existing accounts: ${existingError.message}`);
    const ids = (existingRows ?? []).map((r) => r.id);
    const { data: existingRoleRows, error: roleError } = ids.length
      ? await supabaseAdmin.from("user_roles").select("user_id").in("user_id", ids)
      : { data: [], error: null };
    if (roleError) throw new Error(`Could not check existing roles: ${roleError.message}`);
    const withRole = new Set((existingRoleRows ?? []).map((r) => r.user_id));
    const existing = new Set((existingRows ?? []).filter((r) => withRole.has(r.id)).map((r) => r.email));

    const result: SeedResult = {
      total: accounts.length,
      offset: data.offset,
      processed: batch.length,
      created: 0,
      repaired: 0,
      existing: 0,
      failed: [],
      next_offset: data.offset + SEED_BATCH < accounts.length ? data.offset + SEED_BATCH : null,
    };
    const profileRows: { id: string; email: string; display_name: string }[] = [];
    const roleRows: { user_id: string; role: ViewProfile["role"]; scope_id: string }[] = [];

    for (const account of batch) {
      if (existing.has(account.email)) {
        result.existing += 1;
        continue;
      }
      let userId: string | null = null;
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: account.display_name },
      });
      if (created?.user) {
        userId = created.user.id;
        result.created += 1;
      } else {
        // The login may already exist without a profile: look it up and attach one.
        const { data: foundId } = await supabaseAdmin.rpc("auth_user_id_by_email", {
          _email: account.email,
        });
        if (typeof foundId === "string" && foundId) {
          userId = foundId;
          result.repaired += 1;
        } else {
          result.failed.push({ email: account.email, error: error?.message ?? "Unknown error" });
        }
      }
      if (userId) {
        profileRows.push({ id: userId, email: account.email, display_name: account.display_name });
        roleRows.push({ user_id: userId, role: account.role, scope_id: account.scope_id });
      }
    }

    if (profileRows.length) {
      const { error } = await supabaseAdmin.from("profiles").upsert(profileRows, { onConflict: "id" });
      if (error) throw new Error(`Could not save profiles: ${error.message}`);
      const { error: rolesError } = await supabaseAdmin.from("user_roles").upsert(roleRows, { onConflict: "user_id" });
      if (rolesError) throw new Error(`Could not save roles: ${rolesError.message}`);
    }
    return result;
  });

// ---------- ask-coach ----------
export type AskResult =
  | {
      ok: true;
      id: string;
      question: string;
      answer: string;
      date: string;
      provider: string;
      created_at: string;
      remaining: number;
    }
  | { ok: false; code: "rate_limited" | "error"; message: string; remaining: number };

export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        date: dateSchema,
        question: z.string().trim().min(2, "Ask a question").max(600, "Keep questions under 600 characters"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AskResult> => {
    const profile = await readProfile(context.supabase, context.userId);
    if (profile.role === "salesperson") forbid("The assistant is for managers only");

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await context.supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", since);
    if (countError) throw new Error("Could not check your question limit");
    const used = count ?? 0;
    if (used >= ASK_LIMIT_PER_HOUR) {
      return {
        ok: false,
        code: "rate_limited",
        message: `You have asked ${ASK_LIMIT_PER_HOUR} questions in the last hour. Please try again a little later.`,
        remaining: 0,
      };
    }

    const index = await loadCoachIndex();
    let view: CoachView;
    try {
      view = buildView(index, profile, data.date);
    } catch (error) {
      if (error instanceof ScopeError) forbid(error.message);
      throw error;
    }
    if (view.kind !== "manager") forbid("The assistant is for managers only");

    const { data: past } = await context.supabase
      .from("chat_messages")
      .select("question, answer")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(3);
    const history: ChatTurn[] = [];
    for (const row of [...(past ?? [])].reverse()) {
      history.push({ role: "user", content: row.question });
      history.push({ role: "assistant", content: row.answer });
    }

    const messages: ChatTurn[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Store Coach data for ${data.date} (the only data you may use):\n${JSON.stringify(buildAiContext(view))}`,
      },
      ...history.slice(-6),
      { role: "user", content: data.question },
    ];

    let answer: string;
    let provider: string;
    try {
      ({ answer, provider } = await askModel(messages));
    } catch (error) {
      return {
        ok: false,
        code: "error",
        message: error instanceof Error ? error.message : "The assistant could not answer right now.",
        remaining: ASK_LIMIT_PER_HOUR - used,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved, error: saveError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        user_id: context.userId,
        role: profile.role,
        question: data.question,
        answer,
        replay_date: data.date,
        provider,
      })
      .select("id, created_at")
      .single();
    if (saveError || !saved) {
      console.error("[ask-coach] could not save chat message", saveError);
      throw new Error("Your answer could not be saved. Please try again.");
    }

    return {
      ok: true,
      id: saved.id,
      question: data.question,
      answer,
      date: data.date,
      provider,
      created_at: saved.created_at,
      remaining: Math.max(0, ASK_LIMIT_PER_HOUR - used - 1),
    };
  });

// ---------- card statuses (managers see whether their salespeople ticked today's card) ----------
export const getCardStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ date: dateSchema }).parse(input))
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    const profile = await readProfile(context.supabase, context.userId);
    if (profile.role === "salesperson") forbid("Card statuses are for managers only");
    const index = await loadCoachIndex();
    let view: CoachView;
    try {
      view = buildView(index, profile, data.date);
    } catch (error) {
      if (error instanceof ScopeError) forbid(error.message);
      throw error;
    }
    if (view.kind !== "manager") forbid("Card statuses are for managers only");

    // Only salespeople inside the caller's scoped view are looked up.
    const spIds = [...new Set(Object.values(view.stores).flatMap((b) => b.cards.map((c) => c.sp)))];
    if (!spIds.length) return {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, scope_id")
      .eq("role", "salesperson")
      .in("scope_id", spIds);
    if (roleError) throw new Error("Could not read card statuses");
    const userToSp = new Map((roleRows ?? []).filter((r) => r.scope_id).map((r) => [r.user_id, r.scope_id as string]));
    if (!userToSp.size) return {};
    const keys = spIds.map((sp) => `card:${data.date}:${sp}`);
    const { data: rows, error } = await supabaseAdmin
      .from("action_status")
      .select("user_id, item_key, status")
      .in("user_id", [...userToSp.keys()])
      .in("item_key", keys);
    if (error) throw new Error("Could not read card statuses");
    const out: Record<string, string> = {};
    for (const row of rows ?? []) {
      const sp = userToSp.get(row.user_id);
      // A tick counts only when the salesperson set it on their own card.
      if (sp && row.item_key === `card:${data.date}:${sp}`) out[sp] = row.status;
    }
    return out;
  });
