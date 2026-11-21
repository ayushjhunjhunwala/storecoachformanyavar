import type { ReactNode } from "react";
import type { ManagerView } from "@/lib/coach/types";
import { formatDateWithYear, formatNumber, formatSignedPct } from "@/lib/coach/format";
import { Chip, type ChipTone, StatTile } from "./primitives";

export function HqTiles({ view }: { view: ManagerView }) {
  const maxPerAm = Math.max(0, ...view.weeks.flatMap((w) => Object.values(w.by_am).map((x) => x.count)));
  const cap = Math.max(...view.area_managers.map((a) => Number(a.max_alerts_per_week) || 5), 5);
  const longest = Math.max(0, ...view.runs.map((r) => r.max_card_words));
  const slowest = Math.max(0, ...view.runs.map((r) => r.secs));
  const net = view.network;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Daily runs"
        value={`${view.runs.length} of ${view.dates.length}`}
        delta={slowest < 1 ? "under 1 second each" : `slowest ${slowest.toFixed(2)} seconds`}
      />
      <StatTile
        label="Most issues to one manager"
        value={`${maxPerAm} / ${cap}`}
        delta={maxPerAm <= cap ? "cap held every week" : "cap broken"}
        tone={maxPerAm <= cap ? "neutral" : "bad"}
      />
      <StatTile label="Longest card" value={`${longest} words`} delta="limit 60" tone={longest <= 60 ? "neutral" : "bad"} />
      <StatTile
        label="Network bills · 28 days"
        value={net ? formatNumber(net.bills) : "—"}
        delta={net ? `${formatNumber(net.ly_bills)} same weeks last year` : undefined}
      />
    </div>
  );
}

function GuardCard({ tag, tone, title, children }: { tag: string; tone: ChipTone; title: string; children: ReactNode }) {
  return (
    <article className="surface flex flex-col gap-3 p-6">
      <Chip tone={tone} size="sm" className="w-fit">
        {tag}
      </Chip>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="text-[1.02rem] leading-relaxed text-foreground/80">{children}</div>
    </article>
  );
}

/** "What it chose not to raise": calendar, market, data and new-store guardrails, plus the weekly cap. */
export function NotRaised({ view, scope = "network" }: { view: ManagerView; scope?: "network" | "zone" }) {
  const net = view.network;
  const change = net && net.ly_bills ? net.bills / net.ly_bills - 1 : null;
  const diwali = Object.values(view.upcoming)
    .flat()
    .find((u) => u.festival === "Diwali");
  const cities = new Map<string, { bills: number; ly: number }>();
  for (const id of view.store_order) {
    const k = view.stores[id]?.kpi;
    if (!k || k.new_store || !k.ly_bills) continue;
    const c = cities.get(k.city) ?? { bills: 0, ly: 0 };
    c.bills += k.bills;
    c.ly += k.ly_bills;
    cities.set(k.city, c);
  }
  const everyCityDown = cities.size > 0 && [...cities.values()].every((c) => c.bills < c.ly);
  const newStores = view.store_order.map((id) => view.stores[id]).filter((b) => b?.kpi?.new_store);
  const run = view.runs[view.runs.length - 1];
  const zoneOfCity = (city: string) => view.market.find((m) => m.city === city)?.zone;

  const cards: ReactNode[] = [];
  if (scope === "network" && change != null && change < 0 && diwali && everyCityDown) {
    cards.push(
      <GuardCard key="cal" tag="Calendar" tone="neutral" title="Festival shift">
        Bills are {formatSignedPct(change, 0).replace("−", "")} below last year in every city at once. Diwali moved from 20 Oct 2025 to{" "}
        {formatDateWithYear(diwali.date)}. No store is alerted.
      </GuardCard>,
    );
  }
  for (const m of view.market) {
    const stores = view.store_order.filter((id) => view.stores[id]?.meta.city === m.city).length;
    cards.push(
      <GuardCard key={`m-${m.city}`} tag={`To ${zoneOfCity(m.city) ?? m.zone} zonal head`} tone="info" title={`${m.city} market slowdown`}>
        Walk-ins {formatSignedPct(m.value, 0)} vs {formatSignedPct(m.others, 0)} for other cities
        {m.weeks ? `; trails in ${m.weeks} of ${m.weekly?.length ?? 6} weeks` : ""}
        {m.share_down === 1 && stores ? `; all ${stores} stores move together` : ""}. Store alerts held back.
      </GuardCard>,
    );
  }
  for (const f of view.flags) {
    cards.push(
      <GuardCard key={`f-${f.store_id}-${f.type}`} tag={`To ${f.routed_to}`} tone="warn" title={`${f.store_id}: ${f.type.toLowerCase()}`}>
        {f.detail}
      </GuardCard>,
    );
  }
  for (const b of newStores) {
    if (!b) continue;
    cards.push(
      <GuardCard key={`n-${b.meta.store_id}`} tag="New store" tone="neutral" title={b.meta.store_id}>
        Opened {formatDateWithYear(b.meta.opened_on)}. Compared only with {b.meta.tier}-tier peers; no year-on-year alerts.
      </GuardCard>,
    );
  }
  if (run && run.candidates > run.issues) {
    cards.push(
      <GuardCard key="cap" tag="Weekly cap" tone="neutral" title={`${run.candidates - run.issues} candidates held back`}>
        Found today but below the line: each area manager gets at most five ranked issues a week.
      </GuardCard>,
    );
  }

  return (
    <section aria-labelledby="not-raised" className="flex flex-col gap-4">
      <h2 id="not-raised" className="text-2xl font-semibold text-foreground sm:text-[1.75rem]">
        What it chose not to raise
      </h2>
      {cards.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>
      ) : (
        <p className="surface p-6 text-[1.05rem] text-muted-foreground">Nothing was held back on this date.</p>
      )}
    </section>
  );
}
