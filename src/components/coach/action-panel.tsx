import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Issue } from "@/lib/coach/types";
import type { ActionEventRow, ActionRow } from "@/lib/coach/actions.types";
import { transitionIssueAction } from "@/lib/coach/actions.functions";
import { actionBoardQueryOptions, issueActivityQueryOptions } from "@/lib/coach/action-queries";
import { addDays } from "@/lib/coach/logic";
import { formatRupees, formatShortDate, formatWhen } from "@/lib/coach/format";
import {
  BLOCK_REASONS,
  DISMISS_REASONS,
  EVENT_LABEL,
  EVENT_PAST,
  STATE_LABEL,
  allowedEvents,
  type ActionEvent,
  type ActionState,
} from "@/lib/coach/workflow";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Chip, type ChipTone } from "./primitives";
import { useReplay } from "./replay-context";

const authed = getRouteApi("/_authenticated");

export const STATE_TONE: Record<ActionState, ChipTone> = {
  open: "neutral",
  assigned: "info",
  acknowledged: "info",
  in_progress: "info",
  blocked: "warn",
  done: "good",
  reviewed: "good",
  dismissed: "neutral",
};

const PRIMARY_ORDER: ActionEvent[] = ["acknowledge", "begin", "done", "assign", "review", "unblock", "reopen"];

export function whatsappText(issue: Issue): string {
  return [
    `*${issue.title}* (${issue.store_id})`,
    issue.cause,
    `*Do this · ${issue.when} · ${issue.who}*`,
    issue.action,
    `${formatRupees(issue.rupees)} at stake / 4 weeks (estimate)`,
  ].join("\n");
}

export async function copyIssue(issue: Issue) {
  try {
    await navigator.clipboard.writeText(whatsappText(issue));
    toast.success("Copied", { description: "Paste it into WhatsApp. Nothing has been sent." });
  } catch {
    toast.error("Couldn't copy. Select the action text and copy it yourself.");
  }
}

export function StateChip({ action }: { action: ActionRow | null }) {
  const state = action?.state ?? "open";
  return (
    <Chip tone={STATE_TONE[state]} size="sm">
      {STATE_LABEL[state]}
    </Chip>
  );
}

/** "Assigned to Jitendra V. · due Sat 31 Oct · Blocked: stock not available". */
export function ActionSummary({ action }: { action: ActionRow | null }) {
  if (!action || action.state === "open") return <span className="text-muted-foreground">Not assigned yet</span>;
  const parts = [
    action.assignee_name ? `${action.state === "done" || action.state === "reviewed" ? "Done by" : "With"} ${action.assignee_name}` : null,
    action.due_date && !["done", "reviewed", "dismissed"].includes(action.state) ? `due ${formatShortDate(action.due_date)}` : null,
    action.state === "blocked" && action.block_reason ? `Blocked: ${action.block_reason.toLowerCase()}` : null,
    action.state === "dismissed" && action.dismiss_reason ? `Dismissed: ${action.dismiss_reason.toLowerCase()}` : null,
  ].filter(Boolean);
  return <span className="text-muted-foreground">{parts.join(" · ")}</span>;
}

type DialogKind = "assign" | "block" | "dismiss" | "review" | null;

function useTransition(issue: Issue) {
  const queryClient = useQueryClient();
  const fn = useServerFn(transitionIssueAction);
  const [pending, setPending] = useState<ActionEvent | null>(null);
  async function run(
    event: ActionEvent,
    expectedVersion: number,
    extra: { assignee?: "store_lead" | "me"; due?: string; reason?: string; note?: string } = {},
  ): Promise<boolean> {
    setPending(event);
    try {
      const res = await fn({ data: { issueId: issue.id, event, expectedVersion, ...extra } });
      if (!res.ok) {
        toast.error(res.message);
        return false;
      }
      toast.success(`${issue.store_id}: ${EVENT_PAST[event]}`, { description: STATE_LABEL[res.state] });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That didn't save. Try again.");
      return false;
    } finally {
      // Keep the buttons disabled until the fresh state (and its version) is back.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["action-board"] }),
        queryClient.invalidateQueries({ queryKey: ["issue-activity", issue.id] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]).catch(() => undefined);
      setPending(null);
    }
  }
  return { run, pending };
}

function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  reasons,
  confirmLabel,
  requireReason,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  reasons: readonly string[] | null;
  confirmLabel: string;
  requireReason: boolean;
  busy: boolean;
  onConfirm: (reason: string | undefined, note: string | undefined) => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const noteNeeded = reason === "Other";
  const valid = (!requireReason || reason) && (!noteNeeded || note.trim());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-[0.95rem]">{description}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onConfirm(reason || undefined, note.trim() || undefined);
          }}
        >
          {reasons && (
            <RadioGroup value={reason} onValueChange={setReason} aria-label="Reason" className="gap-2">
              {reasons.map((r) => (
                <Label
                  key={r}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 text-[0.95rem] font-normal",
                    reason === r && "border-primary bg-info-soft",
                  )}
                >
                  <RadioGroupItem value={r} />
                  {r}
                </Label>
              ))}
            </RadioGroup>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="action-note" className="text-[0.95rem]">
              Note {noteNeeded ? "(needed)" : "(optional)"}
            </Label>
            <Textarea id="action-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="rounded-2xl" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {busy && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  issue,
  weekDate,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  issue: Issue;
  weekDate: string;
  busy: boolean;
  onConfirm: (assignee: "store_lead" | "me", due: string) => void;
}) {
  const activity = useQuery({ ...issueActivityQueryOptions(issue.id), enabled: open });
  const lead = activity.data?.store_lead ?? null;
  const [who, setWho] = useState<"store_lead" | "me">("store_lead");
  const [due, setDue] = useState(addDays(weekDate, 6));
  const choice = lead ? who : "me";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Assign this action</DialogTitle>
          <DialogDescription className="text-[0.95rem]">{issue.action}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(choice, due);
          }}
        >
          <RadioGroup value={choice} onValueChange={(v) => setWho(v as "store_lead" | "me")} aria-label="Who does it" className="gap-2">
            <Label
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-2xl border border-border px-4 text-[0.95rem] font-normal",
                lead ? "cursor-pointer" : "opacity-60",
                choice === "store_lead" && "border-primary bg-info-soft",
              )}
            >
              <RadioGroupItem value="store_lead" disabled={!lead} />
              {activity.isLoading ? "Finding the store lead…" : lead ? `${lead.name}, store lead of ${issue.store_id}` : `${issue.store_id} has no store lead login`}
            </Label>
            <Label
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 text-[0.95rem] font-normal",
                choice === "me" && "border-primary bg-info-soft",
              )}
            >
              <RadioGroupItem value="me" />
              Me
            </Label>
          </RadioGroup>
          <div className="flex flex-col gap-2">
            <Label htmlFor="action-due" className="text-[0.95rem]">
              Due
            </Label>
            <Input id="action-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-11 rounded-2xl" required />
          </div>
          <p className="text-sm text-muted-foreground">They get an in-app notification. Nothing is sent outside Store Coach.</p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !due || activity.isLoading}>
              {busy && <Loader2 className="animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Workflow buttons for one issue. `action` comes from the board or the issue's activity. */
export function ActionControls({
  issue,
  weekDate,
  action,
  layout = "row",
  showCopy = true,
}: {
  issue: Issue;
  weekDate: string;
  action: ActionRow | null;
  layout?: "row" | "stack";
  showCopy?: boolean;
}) {
  const { userId, profile } = authed.useRouteContext();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const { run, pending } = useTransition(issue);
  const snap = { state: action?.state ?? ("open" as ActionState), assigneeUserId: action?.assignee_user_id ?? null };
  const events = allowedEvents(snap, { role: profile.role, userId });
  const version = action?.version ?? 0;
  const primary = PRIMARY_ORDER.find((e) => events.includes(e));
  const ordered = [...events].sort((a, b) => (a === primary ? -1 : b === primary ? 1 : 0));
  const stack = layout === "stack";

  function press(e: ActionEvent) {
    if (e === "assign") return setDialog("assign");
    if (e === "block") return setDialog("block");
    if (e === "dismiss") return setDialog("dismiss");
    if (e === "review") return setDialog("review");
    void run(e, version);
  }

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-3", stack && "grid grid-cols-1")}>
        {ordered.map((e) => (
          <Button
            key={e}
            variant={e === primary ? "default" : "secondary"}
            onClick={() => press(e)}
            disabled={pending !== null}
            className={cn(stack && e === primary && "h-12")}
          >
            {pending === e && <Loader2 className="animate-spin" />}
            {e === "assign" && action?.assignee_user_id ? "Reassign" : EVENT_LABEL[e]}
          </Button>
        ))}
        {showCopy && (
          <Button variant="secondary" onClick={() => void copyIssue(issue)}>
            <Copy className={cn(!stack && "hidden sm:block")} /> Copy for WhatsApp
          </Button>
        )}
        {events.length === 0 && !showCopy && <span className="text-sm text-muted-foreground">Nothing for you to do here.</span>}
      </div>

      <AssignDialog
        open={dialog === "assign"}
        onOpenChange={(v) => setDialog(v ? "assign" : null)}
        issue={issue}
        weekDate={weekDate}
        busy={pending === "assign"}
        onConfirm={async (assignee, due) => {
          if (await run("assign", version, { assignee, due })) setDialog(null);
        }}
      />
      <ReasonDialog
        open={dialog === "block"}
        onOpenChange={(v) => setDialog(v ? "block" : null)}
        title="What's blocking it?"
        description="Your area manager is told straight away."
        reasons={BLOCK_REASONS}
        confirmLabel="Mark blocked"
        requireReason
        busy={pending === "block"}
        onConfirm={async (reason, note) => {
          if (await run("block", version, { ...(reason ? { reason } : {}), ...(note ? { note } : {}) })) setDialog(null);
        }}
      />
      <ReasonDialog
        open={dialog === "dismiss"}
        onOpenChange={(v) => setDialog(v ? "dismiss" : null)}
        title="Dismiss this issue?"
        description="It stays in the history with your reason, and you can reopen it."
        reasons={DISMISS_REASONS}
        confirmLabel="Dismiss"
        requireReason
        busy={pending === "dismiss"}
        onConfirm={async (reason, note) => {
          if (await run("dismiss", version, { ...(reason ? { reason } : {}), ...(note ? { note } : {}) })) setDialog(null);
        }}
      />
      <ReasonDialog
        open={dialog === "review"}
        onOpenChange={(v) => setDialog(v ? "review" : null)}
        title="Mark reviewed"
        description="Confirms you've checked the work was done. The 7-day follow-up still measures whether the number moved."
        reasons={null}
        confirmLabel="Mark reviewed"
        requireReason={false}
        busy={pending === "review"}
        onConfirm={async (_reason, note) => {
          if (await run("review", version, note ? { note } : {})) setDialog(null);
        }}
      />
    </>
  );
}

/** Board-backed controls for a digest card: one request serves every card on the page. */
export function BoardActionControls({ issue, layout }: { issue: Issue; layout?: "row" | "stack" }) {
  const { date } = useReplay();
  const board = useQuery(actionBoardQueryOptions(date));
  const item = board.data?.items.find((i) => i.issue.id === issue.id);
  if (board.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading action…
      </div>
    );
  }
  if (board.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn't load this action.{" "}
        <button className="text-primary hover:underline" onClick={() => void board.refetch()}>
          Try again
        </button>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2 text-[0.95rem]">
        <StateChip action={item?.action ?? null} />
        <ActionSummary action={item?.action ?? null} />
      </p>
      <ActionControls issue={issue} weekDate={item?.week_date ?? date} action={item?.action ?? null} {...(layout ? { layout } : {})} />
    </div>
  );
}

export function ActionHistory({ events }: { events: ActionEventRow[] }) {
  if (!events.length) return <p className="text-[0.95rem] text-muted-foreground">No changes yet.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="border-l-2 border-border pl-4 text-[0.95rem] leading-relaxed">
          <p className="text-foreground">
            <b className="font-semibold">{e.actor_name}</b> {EVENT_PAST[e.event]}
            {e.event === "assign" && e.assignee_name ? ` to ${e.assignee_name}` : ""}
            {e.reason ? `: ${e.reason.toLowerCase()}` : ""}
          </p>
          {e.note && <p className="text-muted-foreground">“{e.note}”</p>}
          <p className="text-xs text-muted-foreground">
            {formatWhen(e.created_at)} · now {STATE_LABEL[e.to_state].toLowerCase()}
          </p>
        </li>
      ))}
    </ol>
  );
}
