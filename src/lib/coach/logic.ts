// Pure helpers over the engine data. Client-safe (no server imports).
import type {
  CoachRecord,
  CoachRole,
  DayRecord,
  Followup,
  FollowupHistory,
  Issue,
  MetaRecord,
  SalespersonMeta,
  StoreMeta,
  AreaManager,
  TrendRecord,
} from "./types";

export interface CoachIndex {
  meta: MetaRecord;
  trend: TrendRecord["trend"];
  days: DayRecord[];
  dates: string[];
  dayByDate: Map<string, DayRecord>;
  storeById: Map<string, StoreMeta>;
  amById: Map<string, AreaManager>;
  spById: Map<string, SalespersonMeta>;
}

export function indexCoachData(records: CoachRecord[]): CoachIndex {
  const meta = records.find((r): r is MetaRecord => r.k === "meta");
  const trend = records.find((r): r is TrendRecord => r.k === "trend");
  if (!meta || !trend) throw new Error("data.json is missing the meta or trend record");
  const days = records
    .filter((r): r is DayRecord => r.k === "day")
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    meta,
    trend: trend.trend,
    days,
    dates: days.map((d) => d.date),
    dayByDate: new Map(days.map((d) => [d.date, d])),
    storeById: new Map(meta.meta.stores.map((s) => [s.store_id, s])),
    amById: new Map(meta.meta.area_managers.map((a) => [a.area_manager_id, a])),
    spById: new Map(meta.meta.salespeople.map((s) => [s.salesperson_id, s])),
  };
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Digest dates: every Monday in the replay, plus the first replay day (1 Oct counts as a Monday). */
export function digestDates(dates: string[]): string[] {
  return dates.filter((d, i) => i === 0 || weekdayOf(d) === 1);
}

/** The weekly digest shown for a date is the issues of the most recent Monday on or before it. */
export function digestDateFor(dates: string[], date: string): string {
  let found: string | undefined;
  for (const d of digestDates(dates)) {
    if (d <= date) found = d;
  }
  return found ?? dates[0] ?? date;
}

/** followup.key === `${detector}-${store_id}-${title cut before " has not"}` */
export function followupKey(issue: Pick<Issue, "detector" | "store_id" | "title">): string {
  const cut = issue.title.split(" has not")[0] ?? issue.title;
  return `${issue.detector}-${issue.store_id}-${cut}`;
}

export function historyUpTo(f: Followup, date: string): FollowupHistory[] {
  return f.history.filter((h) => h.on <= date).sort((a, b) => a.on.localeCompare(b.on));
}

export function latestFollowup(f: Followup, date: string): FollowupHistory | null {
  const h = historyUpTo(f, date);
  return h[h.length - 1] ?? null;
}

/** Team stats (sp) exist on Mondays, 1 Oct and 31 Oct only: use the latest on or before the date. */
export function teamDayFor(index: CoachIndex, date: string): DayRecord | null {
  let found: DayRecord | null = null;
  for (const d of index.days) {
    if (d.date <= date && d.sp) found = d;
  }
  return found;
}

/**
 * Store lead = longest-serving salesperson at the store who billed in the
 * last 21 days before the reference date (the engine's generated date).
 */
export function storeLeadFor(index: CoachIndex, storeId: string): SalespersonMeta | null {
  const ref = index.meta.generated;
  const refDay = teamDayFor(index, ref);
  if (!refDay?.sp) return null;
  const cutoff = addDays(ref, -21);
  const candidates: SalespersonMeta[] = [];
  for (const [id, stats] of Object.entries(refDay.sp)) {
    if (stats.store_id !== storeId) continue;
    if (!stats.last_bill || stats.last_bill < cutoff || stats.last_bill > ref) continue;
    const person = index.spById.get(id);
    if (person) candidates.push(person);
  }
  candidates.sort(
    (a, b) =>
      a.join_date.localeCompare(b.join_date) || a.salesperson_id.localeCompare(b.salesperson_id),
  );
  return candidates[0] ?? null;
}

export const HOME_FOR_ROLE: Record<CoachRole, "/hq" | "/zone" | "/am" | "/store" | "/me"> = {
  hq: "/hq",
  zonal: "/zone",
  am: "/am",
  store_lead: "/store",
  salesperson: "/me",
};

export function homeFor(role: CoachRole | string | null | undefined) {
  if (role && role in HOME_FOR_ROLE) return HOME_FOR_ROLE[role as CoachRole];
  return "/login" as const;
}

export function isCoachRole(value: unknown): value is CoachRole {
  return (
    value === "hq" ||
    value === "zonal" ||
    value === "am" ||
    value === "store_lead" ||
    value === "salesperson"
  );
}
