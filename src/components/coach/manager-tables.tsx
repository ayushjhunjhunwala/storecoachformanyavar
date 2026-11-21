import { useState } from "react";
import type { FollowupView, ManagerView, RunLog } from "@/lib/coach/types";
import { formatRupees, formatShortDate } from "@/lib/coach/format";
import { Button } from "@/components/ui/button";
import { Panel, ResultChip } from "./primitives";

export function followupCounts(followups: FollowupView[], amId?: string) {
  const out = { improved: 0, no_change: 0, worse: 0, pending: 0 };
  for (const f of followups) {
    if (amId && f.area_manager_id !== amId) continue;
    if (!f.latest) out.pending += 1;
    else out[f.latest.result] += 1;
  }
  return out;
}

export function AmScorecard({
  view,
  onOpen,
  title = "Area managers",
  subtitle,
}: {
  view: ManagerView;
  onOpen?: (amId: string) => void;
  title?: string;
  subtitle?: string;
}) {
  const weekNow = view.weeks[view.weeks.length - 1];
  return (
    <Panel
      title={title}
      subtitle={subtitle ?? `Issues sent in the digest of ${formatShortDate(view.digest_date)} and 7-day follow-up results so far`}
      bodyClassName="px-0 py-0 sm:px-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2.5 font-semibold">Area manager</th>
              <th className="px-3 py-2.5 text-right font-semibold">This week</th>
              <th className="px-3 py-2.5 text-right font-semibold">₹ at stake</th>
              <th className="px-3 py-2.5 text-right font-semibold">Sent since 1 Oct</th>
              <th className="px-3 py-2.5 font-semibold">Follow-up results</th>
              {onOpen && <th className="px-5 py-2.5" />}
            </tr>
          </thead>
          <tbody className="tabular">
            {view.area_managers.map((am) => {
              const now = weekNow?.by_am[am.area_manager_id];
              const sent = view.weeks.reduce((sum, w) => sum + (w.by_am[am.area_manager_id]?.count ?? 0), 0);
              const fu = followupCounts(view.followups, am.area_manager_id);
              return (
                <tr key={am.area_manager_id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-foreground">{am.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {am.area_manager_id} · {am.city} · {am.stores}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right font-bold">{now?.count ?? 0}</td>
                  <td className="px-3 py-3 text-right font-bold text-maroon">{formatRupees(now?.rupees ?? 0)}</td>
                  <td className="px-3 py-3 text-right">{sent}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {fu.improved > 0 && <ResultChip result="improved" label={`${fu.improved} improved`} />}
                      {fu.no_change > 0 && <ResultChip result="no_change" label={`${fu.no_change} no change`} />}
                      {fu.worse > 0 && <ResultChip result="worse" label={`${fu.worse} worse`} />}
                      {fu.pending > 0 && <ResultChip result={null} label={`${fu.pending} pending`} />}
                      {fu.improved + fu.no_change + fu.worse + fu.pending === 0 && (
                        <span className="text-xs text-muted-foreground">None yet</span>
                      )}
                    </div>
                  </td>
                  {onOpen && (
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="soft" onClick={() => onOpen(am.area_manager_id)}>
                        Open digest
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function RunLogTable({ runs }: { runs: RunLog[] }) {
  const [showAll, setShowAll] = useState(false);
  const ordered = [...runs].reverse();
  const shown = showAll ? ordered : ordered.slice(0, 7);
  return (
    <Panel
      title="Run log"
      subtitle={`${runs.length} daily runs so far, each finished by itself`}
      bodyClassName="px-0 py-0 sm:px-0"
      action={
        runs.length > 7 ? (
          <Button size="sm" variant="quiet" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show last 7" : `Show all ${runs.length}`}
          </Button>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2.5 font-semibold">Run</th>
              <th className="px-3 py-2.5 text-right font-semibold">Issues</th>
              <th className="px-3 py-2.5 text-right font-semibold">Candidates</th>
              <th className="px-3 py-2.5 text-right font-semibold">Cards</th>
              <th className="px-3 py-2.5 text-right font-semibold">Data flags</th>
              <th className="px-3 py-2.5 text-right font-semibold">Market</th>
              <th className="px-3 py-2.5 text-right font-semibold">Longest card</th>
              <th className="px-5 py-2.5 text-right font-semibold">Secs</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {shown.map((r) => (
              <tr key={r.replay_date} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-2 font-semibold">{formatShortDate(r.replay_date)}</td>
                <td className="px-3 py-2 text-right">{r.issues}</td>
                <td className="px-3 py-2 text-right">{r.candidates}</td>
                <td className="px-3 py-2 text-right">{r.cards}</td>
                <td className="px-3 py-2 text-right">{r.flags}</td>
                <td className="px-3 py-2 text-right">{r.market}</td>
                <td className="px-3 py-2 text-right">{r.max_card_words} words</td>
                <td className="px-5 py-2 text-right">{r.secs.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
