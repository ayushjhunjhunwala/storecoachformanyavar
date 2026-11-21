import { CalendarClock, Database, MapPinned, Store } from "lucide-react";
import type { ManagerView } from "@/lib/coach/types";
import { formatNumber, formatShortDate, formatSignedPct } from "@/lib/coach/format";
import { Panel, StatTile } from "./primitives";

export function HqTiles({ view }: { view: ManagerView }) {
  const weekNow = view.weeks[view.weeks.length - 1];
  const maxPerAm = Math.max(0, ...Object.values(weekNow?.by_am ?? {}).map((x) => x.count));
  const run = view.runs[view.runs.length - 1];
  const net = view.network;
  const change = net && net.ly_bills ? net.bills / net.ly_bills - 1 : null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Runs completed" value={`${view.runs.length} / ${view.dates.length}`} hint="One run every morning, nobody asked" />
      <StatTile
        label="Max issues per AM"
        value={maxPerAm}
        tone={maxPerAm <= 5 ? "good" : "bad"}
        hint={`Cap ≤ 5 · digest of ${formatShortDate(view.digest_date)}`}
      />
      <StatTile
        label="Longest card"
        value={run ? `${run.max_card_words}` : "—"}
        tone={run && run.max_card_words <= 60 ? "good" : "bad"}
        hint="words · cap ≤ 60"
      />
      <StatTile
        label="Network bills vs last year"
        value={formatSignedPct(change, 0)}
        tone="warn"
        hint={net ? `${formatNumber(net.bills)} vs ${formatNumber(net.ly_bills)}, last 4 weeks` : undefined}
      />
    </div>
  );
}

export function NotRaised({ view, scope = "network" }: { view: ManagerView; scope?: "network" | "zone" }) {
  const net = view.network;
  const change = net && net.ly_bills ? net.bills / net.ly_bills - 1 : null;
  const diwali = Object.values(view.upcoming)
    .flat()
    .find((u) => u.festival === "Diwali");
  const newStores = view.store_order
    .map((id) => view.stores[id])
    .filter((b) => b?.kpi?.new_store);
  const run = view.runs[view.runs.length - 1];

  return (
    <Panel
      title="What the system chose not to raise"
      subtitle="Guardrails: none of these reach an area manager as an alert."
    >
      <ul className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {scope === "network" && (
          <li className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-marigold-soft text-marigold-ink">
              <CalendarClock className="size-4" />
            </span>
            <div className="text-sm">
              <p className="font-bold text-foreground">Festival shift · calendar, no alert</p>
              <p className="leading-relaxed text-muted-foreground">
                Network bills are {formatSignedPct(change, 0)} vs the same weeks last year because Diwali moved from 20 Oct
                2025 to {diwali ? formatShortDate(diwali.date) : "8 Nov"} 2026. Seasonal swings alone never fire an alert.
              </p>
            </div>
          </li>
        )}
        <li className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-soft text-teal">
            <MapPinned className="size-4" />
          </span>
          <div className="text-sm">
            <p className="font-bold text-foreground">Market issues · to the zonal head</p>
            {view.market.length ? (
              view.market.map((m) => (
                <p key={m.city} className="leading-relaxed text-muted-foreground">
                  {m.text}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">No city-wide slowdown today.</p>
            )}
          </div>
        </li>
        <li className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-maroon-soft text-maroon">
            <Database className="size-4" />
          </span>
          <div className="text-sm">
            <p className="font-bold text-foreground">Data issues · to Data/IT</p>
            {view.flags.length ? (
              view.flags.map((f) => (
                <p key={f.store_id + f.type} className="leading-relaxed text-muted-foreground">
                  <b className="text-foreground">{f.store_id}</b> · {f.type}. {f.detail}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">No data problems flagged today.</p>
            )}
          </div>
        </li>
        <li className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
            <Store className="size-4" />
          </span>
          <div className="text-sm">
            <p className="font-bold text-foreground">New stores · peers only</p>
            {newStores.length ? (
              newStores.map((b) =>
                b ? (
                  <p key={b.meta.store_id} className="leading-relaxed text-muted-foreground">
                    <b className="text-foreground">{b.meta.store_id}</b> opened {formatShortDate(b.meta.opened_on)}: compared
                    with {b.meta.tier}-tier peers only, not with last year.
                  </p>
                ) : null,
              )
            ) : (
              <p className="text-muted-foreground">No new store in scope on this date.</p>
            )}
          </div>
        </li>
        {run && run.candidates > run.issues && (
          <li className="text-sm text-muted-foreground md:col-span-2">
            {run.candidates - run.issues} candidate issues were held back today by the 5-per-manager cap.
          </li>
        )}
      </ul>
    </Panel>
  );
}
