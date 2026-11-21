import { Link } from "@tanstack/react-router";
import type { FollowupView, Issue } from "@/lib/coach/types";
import { RESULT_LABEL, formatDayMonth, formatRupees } from "@/lib/coach/format";
import { addDays } from "@/lib/coach/logic";
import { cn } from "@/lib/utils";
import { Callout, Chip, LeverChip, resultText } from "./primitives";
import { BoardActionControls } from "./action-panel";

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
  return (
    <article
      className="surface animate-rise p-6 sm:p-8"
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
          <BoardActionControls issue={issue} />
        </div>
      )}
    </article>
  );
}

export { RESULT_LABEL };
