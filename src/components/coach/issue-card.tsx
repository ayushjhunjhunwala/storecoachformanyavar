import { useState } from "react";
import { Check, ChevronDown, Copy, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import type { FollowupView, Issue } from "@/lib/coach/types";
import { RESULT_LABEL, formatRupees, formatShortDate } from "@/lib/coach/format";
import { addDays } from "@/lib/coach/logic";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { LeverChip, resultTone } from "./primitives";
import { useLocalStatus } from "./use-local-status";

type IssueStatus = "done" | "dismissed";

export function whatsappText(issue: Issue): string {
  return [
    `*${issue.title}* (${issue.store_id})`,
    `Cause: ${issue.cause}`,
    `Do this: ${issue.action}`,
    `Who: ${issue.who}`,
    `When: ${issue.when}`,
    `At stake: ${formatRupees(issue.rupees)} per 4 weeks`,
  ].join("\n");
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
  const [status, setStatus] = useLocalStatus<IssueStatus>(issue.id);
  const [mathOpen, setMathOpen] = useState(false);
  const latest = followup?.latest ?? null;
  const lastSend = followup?.sends[followup.sends.length - 1] ?? issue.id.slice(-10);
  const dueOn = addDays(lastSend, 7);

  async function copy() {
    try {
      await navigator.clipboard.writeText(whatsappText(issue));
      toast.success("Copied for WhatsApp", { description: `${issue.store_id} · ${issue.title}` });
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  }

  return (
    <article
      className={cn(
        "coach-card animate-rise overflow-hidden transition-opacity",
        status === "dismissed" && "opacity-60",
      )}
      aria-label={`Issue ${issue.rank}: ${issue.title}`}
    >
      <div className="flex gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-maroon text-sm font-extrabold text-on-maroon">
              {issue.rank}
            </span>
            <LeverChip lever={issue.lever} />
            <span className="text-sm font-semibold text-foreground">{issue.store_id}</span>
            <span className="text-sm text-muted-foreground">{issue.city}</span>
            {status && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-bold",
                  status === "done" ? "bg-improved-soft text-improved" : "bg-secondary text-muted-foreground",
                )}
              >
                {status === "done" ? "Done" : "Dismissed"}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold leading-snug text-foreground">{issue.title}</h3>
          <p className="text-[0.95rem] leading-relaxed text-muted-foreground">{issue.cause}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="rupee-figure text-3xl text-maroon sm:text-4xl">{formatRupees(issue.rupees)}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">at stake / 4 wks</div>
        </div>
      </div>

      <div className="mx-4 rounded-xl border-l-4 border-marigold bg-marigold-soft px-4 py-3 sm:mx-5">
        <div className="text-xs font-extrabold uppercase tracking-wide text-marigold-ink">Do this</div>
        <p className="mt-1 text-[0.95rem] font-medium leading-relaxed text-foreground">{issue.action}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">When · </span>
            <span className="font-semibold text-foreground">{issue.when}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Who · </span>
            <span className="font-semibold text-foreground">{issue.who}</span>
          </span>
        </div>
      </div>

      <div className="px-4 pt-3 sm:px-5">
        <Collapsible open={mathOpen} onOpenChange={setMathOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-maroon hover:underline">
            <ChevronDown className={cn("size-4 transition-transform", mathOpen && "rotate-180")} />
            How {formatRupees(issue.rupees)} was worked out
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="tabular mt-2 rounded-lg bg-secondary px-3 py-2 text-sm leading-relaxed text-secondary-foreground">
              {issue.math}
              <span className="mt-1 block text-xs text-muted-foreground">KPI tracked: {issue.kpi}</span>
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="px-4 pt-3 sm:px-5">
        {latest ? (
          <div className={cn("rounded-xl border px-3 py-2 text-sm", resultTone[latest.result])}>
            <span className="font-bold">
              7-day follow-up · {formatShortDate(latest.on)} · {RESULT_LABEL[latest.result]}
            </span>
            <p className="mt-0.5 leading-relaxed text-foreground/85">{latest.text}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
            7-day follow-up due {formatShortDate(dueOn)}
            {dueOn <= date ? "" : " — the number is re-measured then."}
          </div>
        )}
      </div>

      {interactive ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-4 sm:px-5">
          {status ? (
            <Button variant="quiet" size="sm" onClick={() => setStatus(null)}>
              <RotateCcw /> Undo
            </Button>
          ) : (
            <>
              <Button variant="default" size="sm" onClick={() => setStatus("done")}>
                <Check /> Mark done
              </Button>
              <Button variant="soft" size="sm" onClick={() => setStatus("dismissed")}>
                <X /> Dismiss
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="ml-auto" onClick={copy}>
            <Copy /> Copy for WhatsApp
          </Button>
        </div>
      ) : (
        <div className="h-4" />
      )}
    </article>
  );
}
