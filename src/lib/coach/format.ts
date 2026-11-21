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

/** "10 Oct" */
export function formatDayMonth(date: string): string {
  const { m, d } = parseIso(date);
  return `${d} ${MONTHS[m - 1]}`;
}

export const ROLE_LABEL: Record<string, string> = {
  hq: "HQ admin",
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
  kur: "Jacket with kurta set",
  ipb: "Items per bill",
  disc: "Discount control",
  shw: "Sherwani add-ons",
  praise: "Keep it up",
};
