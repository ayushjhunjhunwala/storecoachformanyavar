import { Link } from "@tanstack/react-router";
import { Check, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { FollowupView, Issue } from "@/lib/coach/types";
import { RESULT_LABEL, formatDayMonth, formatRupees } from "@/lib/coach/format";
import { addDays } from "@/lib/coach/logic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Callout, Chip, LeverChip, resultText } from "./primitives";
import { statusKey, useActionStatus } from "./use-action-status";

export type IssueStatus = "done" | "dismissed";

export function whatsappText(issue: Issue): string {
  return [
    `*${issue.title}* (${issue.store_id})`,
    issue.cause,
    `*Do this · ${issue.when} · ${issue.who}*`,
    issue.action,
    `${formatRupees(issue.rupees)} at stake / 4 weeks`,
  ].join("\n");
}

export async function copyIssue(issue: Issue) {
  try {
    await navigator.clipboard.writeText(whatsappText(issue));
    toast.success("Copied for WhatsApp", { description: `${issue.store_id} · ${issue.title}` });
  } catch {
    toast.error("Could not copy. Select the text and copy it by hand.");
  }
}

/** Mark done / Dismiss / Copy for WhatsApp, saved to the signed-in person's account. */
export function IssueActions({ issue, layout = "row" }: { issue: Issue; layout?: "row" | "stack" }) {
  const [status, setStatus] = useActionStatus<IssueStatus>(statusKey.issue(issue.id));
  const stack = layout === "stack";
  return (
    <div className={cn("flex flex-wrap items-center gap-3", stack && "grid grid-cols-2 gap-3")}>
      {status ? (
        <>
          <span
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold",
              status === "done" ? "bg-good-soft text-good" : "bg-secondary text-muted-foreground",
              stack && "col-span-2 justify-center",
            )}
            role="status"
          >
            {status === "done" ? <Check className="size-4" /> : null}
            {status === "done" ? "Done" : "Dismissed"}
          </span>
          <Button variant="quiet" onClick={() => setStatus(null)} className={cn(stack && "col-span-2")}>
            <RotateCcw /> Undo
          </Button>
        </>
      ) : (
        <>
          <Button onClick={() => setStatus("done")} className={cn(stack && "col-span-2 h-12")}>
            Mark done
          </Button>
          <Button variant="secondary" onClick={() => setStatus("dismissed")} className={cn(stack && "col-span-2")}>
            Dismiss
          </Button>
        </>
      )}
      <Button variant="secondary" onClick={() => void copyIssue(issue)} className={cn(stack && "col-span-2")}>
        <Copy className={cn(!stack && "hidden sm:block")} /> Copy for WhatsApp
      </Button>
    </div>
  );
}

/** "Follow-up, 26 Oct · Store bills vs all other stores…" or when the follow-up is due. */
export function FollowupLine({ issue, followup, date }: { issue: Issue; followup?: FollowupView | undefined; date: string }) {
  const latest = followup?.latest ?? null;
  if (latest) {
    return (
      <p className="text-[0.95rem] leading-relaxed text-foreground">
        <span className={cn("font-semibold", resultText[latest.result])}>Follow-up, {formatDayMonth(latest.on)}</span>
        <span className="text-muted-foreground"> · </span>
        {latest.text}
      </p>
    );
  }
  const lastSend = followup?.sends[followup.sends.length - 1] ?? issue.id.slice(-10);
  const due = addDays(lastSend, 7);
  return (
    <p className="text-[0.95rem] text-muted-foreground">
      <span className="font-semibold">Follow-up due {formatDayMonth(due)}</span>
      {due > date ? " · the number is measured again 7 days after sending." : " · measured in the next run."}
    </p>
  );
}

export function IssueCard({
  issue,
  followup,
  date,
  interactive = true,
}: {
  issue: Issue;
  followup?: FollowupView | undefined;
  date: string;
  interactive?: boolean;
}) {
  const [status] = useActionStatus<IssueStatus>(statusKey.issue(issue.id));
  return (
    <article
      className={cn("surface animate-rise p-6 transition-opacity sm:p-8", status === "dismissed" && "opacity-55")}
      aria-label={`Issue ${issue.rank}: ${issue.title}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <span className="tabular text-lg text-muted-foreground">{issue.rank}</span>
          <span className="figure text-[2.6rem] text-foreground sm:text-5xl">{formatRupees(issue.rupees)}</span>
          <span className="text-[0.95rem] text-muted-foreground">at stake / 4 weeks</span>
        </div>
        <div className="flex items-center gap-2">
          <LeverChip lever={issue.lever} />
          <Chip tone="neutral">{issue.store_id}</Chip>
        </div>
      </div>

      <h3 className="mt-4 text-2xl font-semibold leading-snug text-foreground sm:text-[1.7rem]">
        <Link
          to="/issue/$issueId"
          params={{ issueId: issue.id }}
          className="rounded-md decoration-2 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          {issue.title}
        </Link>
      </h3>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-foreground/80 sm:text-lg">{issue.cause}</p>

      <Callout className="mt-5" label={`Do this · ${issue.when} · ${issue.who}`}>
        {issue.action}
      </Callout>

      <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">How it's worked out: {issue.math}</p>
      <div className="mt-3">
        <FollowupLine issue={issue} followup={followup} date={date} />
      </div>

      {interactive && (
        <div className="mt-6">
          <IssueActions issue={issue} />
        </div>
      )}
    </article>
  );
}

export { RESULT_LABEL };
