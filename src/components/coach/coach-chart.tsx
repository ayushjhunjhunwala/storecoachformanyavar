import type { TrendPoint } from "@/lib/coach/types";
import { formatDayMonth } from "@/lib/coach/format";

export type CoachKpi = "ipb" | "kur" | "disc";

export const KPI_LABEL: Record<CoachKpi, string> = {
  ipb: "Items per bill",
  kur: "Kurta sets with a jacket",
  disc: "Discount",
};

export function formatKpi(key: CoachKpi, v: number): string {
  return key === "ipb" ? v.toFixed(2) : `${(v * 100).toFixed(1)}%`;
}

/**
 * "Up from 1.27 on 19 Sep." Picks the person's own weakest week from their series and
 * names it, when today's value is better. Discount: lower is better.
 */
export function trendCaption(mine: TrendPoint[], kpi: CoachKpi): string | null {
  const last = mine[mine.length - 1];
  if (!last || mine.length < 3) return null;
  const lowerIsBetter = kpi === "disc";
  const worst = mine.reduce((w, p) => ((lowerIsBetter ? p[kpi] > w[kpi] : p[kpi] < w[kpi]) ? p : w), mine[0]!);
  if (worst.w === last.w || worst[kpi] === last[kpi]) return null;
  return `${lowerIsBetter ? "Down" : "Up"} from ${formatKpi(kpi, worst[kpi])} on ${formatDayMonth(worst.w)}.`;
}

/** Clean line chart: your line in blue with an end dot, the store median dotted grey. */
export function CoachChart({ mine, store, kpi }: { mine: TrendPoint[]; store: TrendPoint[]; kpi: CoachKpi }) {
  const W = 600;
  const H = 230;
  const pad = { l: 10, r: 12, t: 16, b: 12 };
  const weeks = Array.from(new Set([...mine.map((p) => p.w), ...store.map((p) => p.w)])).sort();
  if (weeks.length < 2) {
    return <p className="py-8 text-center text-[0.95rem] text-muted-foreground">Not enough weeks yet to draw a trend.</p>;
  }
  const values = [...mine, ...store].map((p) => p[kpi]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= kpi === "ipb" ? 0.1 : 0.01;
    max += kpi === "ipb" ? 0.1 : 0.01;
  }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;
  const x = (w: string) => pad.l + (weeks.indexOf(w) / (weeks.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const path = (pts: TrendPoint[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.w).toFixed(1)},${y(p[kpi]).toFixed(1)}`).join(" ");
  const last = mine[mine.length - 1];
  const lastStore = store[store.length - 1];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`${KPI_LABEL[kpi]}: you vs the store median, by week`}>
        <path d={path(store)} fill="none" className="stroke-chart-2" strokeWidth={3} strokeDasharray="3 9" strokeLinecap="round" />
        <path d={path(mine)} fill="none" className="stroke-primary" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        {last && <circle cx={x(last.w)} cy={y(last[kpi])} r={8} className="fill-primary" />}
      </svg>
      <figcaption className="mt-4 flex items-center justify-between gap-3 text-[0.95rem] text-muted-foreground">
        <span>{formatDayMonth(weeks[0]!)}</span>
        <span className="tabular text-center">
          {last ? `You ${formatKpi(kpi, last[kpi])}` : ""}
          {lastStore ? ` · store ${formatKpi(kpi, lastStore[kpi])}` : ""}
        </span>
        <span>{formatDayMonth(weeks[weeks.length - 1]!)}</span>
      </figcaption>
    </figure>
  );
}
