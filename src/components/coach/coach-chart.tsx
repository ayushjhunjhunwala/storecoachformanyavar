import type { TrendPoint } from "@/lib/coach/types";
import { formatDayMonth } from "@/lib/coach/format";

const LABEL: Record<"ipb" | "kur" | "disc", string> = {
  ipb: "Items per bill",
  kur: "Kurta sets with a jacket",
  disc: "Discount, share of MRP",
};

function fmt(key: "ipb" | "kur" | "disc", v: number): string {
  return key === "ipb" ? v.toFixed(2) : `${(v * 100).toFixed(1)}%`;
}

/** SVG line chart: own line solid maroon with dots, store median dotted marigold. */
export function CoachChart({
  mine,
  store,
  kpi,
}: {
  mine: TrendPoint[];
  store: TrendPoint[];
  kpi: "ipb" | "kur" | "disc";
}) {
  const W = 560;
  const H = 220;
  const pad = { l: 46, r: 14, t: 14, b: 30 };
  const weeks = Array.from(new Set([...mine.map((p) => p.w), ...store.map((p) => p.w)])).sort();
  if (weeks.length < 2) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Not enough weeks yet to draw a trend.</p>;
  }
  const values = [...mine, ...store].map((p) => p[kpi]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min = min - (kpi === "ipb" ? 0.1 : 0.01);
    max = max + (kpi === "ipb" ? 0.1 : 0.01);
  }
  const span = max - min;
  min = Math.max(0, min - span * 0.12);
  max = max + span * 0.12;
  const x = (w: string) => pad.l + (weeks.indexOf(w) / (weeks.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const path = (pts: TrendPoint[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.w).toFixed(1)},${y(p[kpi]).toFixed(1)}`).join(" ");
  const ticks = [min, (min + max) / 2, max];
  const labelEvery = Math.ceil(weeks.length / 6);
  const last = mine[mine.length - 1];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${LABEL[kpi]} trend`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {fmt(kpi, t)}
            </text>
          </g>
        ))}
        {weeks.map((w, i) =>
          i % labelEvery === 0 || i === weeks.length - 1 ? (
            <text key={w} x={x(w)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {formatDayMonth(w)}
            </text>
          ) : null,
        )}
        <path d={path(store)} fill="none" className="stroke-marigold" strokeWidth={2.5} strokeDasharray="2 6" strokeLinecap="round" />
        <path d={path(mine)} fill="none" className="stroke-maroon" strokeWidth={2.5} strokeLinejoin="round" />
        {mine.map((p) => (
          <circle key={p.w} cx={x(p.w)} cy={y(p[kpi])} r={3.5} className="fill-card stroke-maroon" strokeWidth={2} />
        ))}
        {last && (
          <text x={x(last.w)} y={y(last[kpi]) - 10} textAnchor="end" className="fill-maroon text-[12px] font-bold">
            {fmt(kpi, last[kpi])}
          </text>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded bg-maroon" /> You
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-5 border-t-2 border-dotted border-marigold" /> Store median
        </span>
        <span>Rolling 4 weeks, every Saturday</span>
      </figcaption>
    </figure>
  );
}

export const KPI_LABEL = LABEL;
