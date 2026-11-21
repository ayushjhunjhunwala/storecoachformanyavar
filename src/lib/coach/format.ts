// Display formatting only. Values come from the engine; these helpers never
// change a number, they only render it the way the PRD specifies
// (₹4.0L / ₹12K / ₹1.2Cr, percentages to 1 decimal, "Sat 10 Oct").

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatRupees(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "−" : "";
  const n = Math.abs(value);
  if (n >= 1e7) return `${sign}₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${sign}₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${sign}₹${Math.round(n / 1e3)}K`;
  return `${sign}₹${Math.round(n)}`;
}

/** Like formatRupees, but thousands keep one decimal under ₹1L ("₹9.8K"). For KPI tiles. */
export function formatRupeesPrecise(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const n = Math.abs(value);
  if (n >= 1e3 && n < 1e5) {
    const sign = value < 0 ? "−" : "";
    return `${sign}₹${(n / 1e3).toFixed(1)}K`;
  }
  return formatRupees(value);
}

/** Fraction (0.1016) to "10.2%". */
export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** Signed change between two fractions/ratios, e.g. -0.452 -> "−45.2%". */
export function formatSignedPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  const pct = (value * 100).toFixed(digits);
  return value > 0 ? `+${pct}%` : pct.replace("-", "−") + "%";
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function parseIso(date: string): { y: number; m: number; d: number; wd: number } {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, wd };
}

/** "Sat, 31 Oct, 2026" */
export function formatLongDate(date: string): string {
  const { y, m, d, wd } = parseIso(date);
  return `${DAYS[wd]}, ${d} ${MONTHS[m - 1]}, ${y}`;
}

/** "Sat 10 Oct" */
export function formatShortDate(date: string | null | undefined): string {
  if (!date) return "—";
  const { m, d, wd } = parseIso(date);
  return `${DAYS[wd]} ${d} ${MONTHS[m - 1]}`;
}

/** "9 Nov 2025": for dates outside the replay month, where the year matters. */
export function formatDateWithYear(date: string | null | undefined): string {
  if (!date) return "—";
  const { y, m, d } = parseIso(date);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Sat, 31 Oct" */
export function formatWeekdayDayMonth(date: string): string {
  const { m, d, wd } = parseIso(date);
  return `${DAYS[wd]}, ${d} ${MONTHS[m - 1]}`;
}

/** "Sat, 31 Oct 2026" — header date. */
export function formatHeaderDate(date: string): string {
  const { y, m, d, wd } = parseIso(date);
  return `${DAYS[wd]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "20–26 Sep" or "27 Sep–3 Oct" for an inclusive range. */
export function formatRange(start: string, end: string): string {
  const a = parseIso(start);
  const b = parseIso(end);
  if (a.m === b.m) return `${a.d}–${b.d} ${MONTHS[b.m - 1]}`;
  return `${a.d} ${MONTHS[a.m - 1]}–${b.d} ${MONTHS[b.m - 1]}`;
}

/** "Fri 20" */
export function formatWeekdayDay(date: string): string {
  const { d, wd } = parseIso(date);
  return `${DAYS[wd]} ${d}`;
}

/** "10 Oct" */
export function formatDayMonth(date: string): string {
  const { m, d } = parseIso(date);
  return `${d} ${MONTHS[m - 1]}`;
}

export const ROLE_LABEL: Record<string, string> = {
  hq: "HQ",
  zonal: "Zonal head",
  am: "Area manager",
  store_lead: "Store lead",
  salesperson: "Salesperson",
};

export const RESULT_LABEL: Record<string, string> = {
  improved: "Improved",
  no_change: "No change",
  worse: "Worse",
};

export const FOCUS_LABEL: Record<string, string> = {
  kur: "Kurta + jacket",
  ipb: "Items per bill",
  disc: "Discount",
  shw: "Sherwani add-ons",
  praise: "Recognised",
};

/** "Faizan M." -> "Faizan" */
export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

/** "AS" initials for an avatar. */
export function initials(name: string): string {
  return name
    .replace(/\./g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Cards are written "Faizan M., your bills…". On a screen that already names the
 * person, show the same sentence without the leading name. Text is otherwise unchanged.
 */
export function cardBody(text: string, name: string): string {
  const prefix = `${name}, `;
  if (!text.startsWith(prefix)) return text;
  const rest = text.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Consecutive ISO dates grouped into ranges: ["2026-11-20".."2026-11-30"] -> ["20–30 Nov"]. */
export function dateRuns(dates: string[]): { start: string; end: string }[] {
  const sorted = [...dates].sort();
  const runs: { start: string; end: string }[] = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last) {
      const next = new Date(`${last.end}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      if (next.toISOString().slice(0, 10) === d) {
        last.end = d;
        continue;
      }
    }
    runs.push({ start: d, end: d });
  }
  return runs;
}

/** "20–30 Nov, plus Diwali on 8 Nov" from the calendar ahead. */
export function describeUpcoming(days: { date: string; festival: string | null; wedding: boolean }[]): string | null {
  const weddings = dateRuns(days.filter((d) => d.wedding).map((d) => d.date)).map((r) =>
    r.start === r.end ? formatDayMonth(r.start) : formatRange(r.start, r.end),
  );
  const festivals = days.filter((d) => d.festival).map((d) => `${d.festival} on ${formatDayMonth(d.date)}`);
  if (!weddings.length && !festivals.length) return null;
  if (!weddings.length) return festivals.join(" and ");
  return `${weddings.join(", ")}${festivals.length ? `, plus ${festivals.join(" and ")}` : ""}`;
}

/** Follow-up measures: store bills are a ratio to other stores (×); rates and shares are percentages. */
export function formatMeasure(kpi: string, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "too few to judge";
  if (/bills per week/i.test(kpi)) return `${value.toFixed(2)}×`;
  return `${(value * 100).toFixed(1)}%`;
}

/** "2 min ago", "3 h ago", "Mon 2 Nov" for older events. */
export function formatWhen(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(t).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
