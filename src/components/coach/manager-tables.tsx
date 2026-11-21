import { Link } from "@tanstack/react-router";
import type { FollowupView, ManagerView, RunLog } from "@/lib/coach/types";
import { formatRupees, formatWeekdayDayMonth } from "@/lib/coach/format";
import { Button } from "@/components/ui/button";
import { Card, DataTable } from "./primitives";

export function followupCounts(followups: FollowupView[], amId?: string) {
  const out = { improved: 0, no_change: 0, worse: 0, pending: 0 };
  for (const f of followups) {
    if (amId && f.area_manager_id !== amId) continue;
    if (!f.latest) out.pending += 1;
    else out[f.latest.result] += 1;
  }
  return out;
}

export function followupSummary(f: ReturnType<typeof followupCounts>): string {
  const parts = [
    f.improved ? `${f.improved} improved` : null,
    f.no_change ? `${f.no_change} no change` : null,
    f.worse ? `${f.worse} worse` : null,
    f.pending ? `${f.pending} pending` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "no follow-ups yet";
}

/** "Area managers this week": name, city, issues · ₹, follow-up results. */
export function AmList({ view, onOpen }: { view: ManagerView; onOpen?: (amId: string) => void }) {
  const weekNow = view.weeks[view.weeks.length - 1];
  return (
    <Card title="Area managers this week">
      <ul className="divide-y divide-border">
        {view.area_managers.map((am) => {
          const now = weekNow?.by_am[am.area_manager_id];
          const count = now?.count ?? 0;
          const heldMarket = view.market.some((m) => m.city === am.city);
          const stores = view.store_order.filter((id) => view.stores[id]?.meta.area_manager_id === am.area_manager_id).length;
          return (
            <li key={am.area_manager_id} className="py-4 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => onOpen?.(am.area_manager_id)}
                disabled={!onOpen}
                className="flex w-full items-start justify-between gap-4 rounded-xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring enabled:hover:opacity-80"
              >
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-lg font-semibold text-foreground">{am.name}</span>
                  <span className="block text-[0.95rem] text-muted-foreground">
                    {am.city} · {stores} stores
                  </span>
                </span>
                <span className="text-right">
                  <span className="tabular block text-lg font-semibold text-foreground">
                    {count}
                    {count ? ` · ${formatRupees(now?.rupees ?? 0)}` : ""}
                  </span>
                  <span className="block text-[0.95rem] text-muted-foreground">
                    {count === 0 && heldMarket ? "held back: market" : followupSummary(followupCounts(view.followups, am.area_manager_id))}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Issues per area manager with "Open digest", for HQ. */
export function AmScorecard({ view, onOpen }: { view: ManagerView; onOpen?: (amId: string) => void }) {
  const weekNow = view.weeks[view.weeks.length - 1];
  return (
    <Card title="Issues per area manager" aside={`Digest of ${formatWeekdayDayMonth(view.digest_date)}`}>
      <DataTable
        minWidth={680}
        columns={[
          { label: "Area manager" },
          { label: "This week", align: "right" },
          { label: "At stake", align: "right" },
          { label: "Sent since 1 Oct", align: "right" },
          { label: "Follow-ups" },
          ...(onOpen ? [{ label: "" }] : []),
        ]}
      >
        {view.area_managers.map((am) => {
          const now = weekNow?.by_am[am.area_manager_id];
          const sent = view.weeks.reduce((sum, w) => sum + (w.by_am[am.area_manager_id]?.count ?? 0), 0);
          return (
            <tr key={am.area_manager_id}>
              <td>
                <p className="font-semibold text-foreground">{am.name}</p>
                <p className="text-sm text-muted-foreground">
                  {am.area_manager_id} · {am.city}
                </p>
              </td>
              <td className="text-right font-semibold">{now?.count ?? 0}</td>
              <td className="text-right font-semibold">{formatRupees(now?.rupees ?? 0)}</td>
              <td className="text-right">{sent}</td>
              <td className="text-muted-foreground">{followupSummary(followupCounts(view.followups, am.area_manager_id))}</td>
              {onOpen && (
                <td className="text-right">
                  <Button size="sm" variant="secondary" onClick={() => onOpen(am.area_manager_id)}>
                    Open digest
                  </Button>
                </td>
              )}
            </tr>
          );
        })}
      </DataTable>
    </Card>
  );
}

export function RunLogTable({ runs, limit, title = "Run log" }: { runs: RunLog[]; limit?: number; title?: string }) {
  const ordered = [...runs].reverse();
  const shown = limit ? ordered.slice(0, limit) : ordered;
  return (
    <Card
      title={title}
      aside={
        limit && runs.length > limit ? (
          <Link to="/hq" search={{ tab: "runs" }} className="text-primary hover:underline">
            All {runs.length} runs
          </Link>
        ) : (
          `${runs.length} daily runs`
        )
      }
    >
      <DataTable
        minWidth={620}
        columns={[
          { label: "Day" },
          { label: "Issues", align: "right" },
          ...(limit ? [] : [{ label: "Candidates", align: "right" as const }]),
          { label: "Cards", align: "right" },
          { label: "Max words", align: "right" },
          { label: "Flags", align: "right" },
          ...(limit ? [] : [{ label: "Market", align: "right" as const }]),
          { label: "Seconds", align: "right" },
        ]}
      >
        {shown.map((r) => (
          <tr key={r.replay_date}>
            <td className="text-foreground">{formatWeekdayDayMonth(r.replay_date)}</td>
            <td className="text-right">{r.issues}</td>
            {!limit && <td className="text-right">{r.candidates}</td>}
            <td className="text-right">{r.cards}</td>
            <td className="text-right">{r.max_card_words}</td>
            <td className="text-right">{r.flags}</td>
            {!limit && <td className="text-right">{r.market}</td>}
            <td className="text-right">{r.secs.toFixed(2)}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
