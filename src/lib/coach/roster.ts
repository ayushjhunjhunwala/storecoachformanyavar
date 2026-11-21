// Roster planner rules for the wedding-date week. Pure and client-safe.
import type { UpcomingDay } from "./types";
import { addDays } from "./logic";

/** Salesperson id -> ISO dates they are off. */
export type RosterPlan = Record<string, string[]>;

export interface PlannerWeek {
  /** Seven consecutive days starting on the first wedding date after today. */
  days: string[];
  weddingDays: Set<string>;
  /** Wedding dates and festivals: offs are never suggested on these. */
  busyDays: Set<string>;
}

export function plannerWeek(upcoming: UpcomingDay[], today: string): PlannerWeek | null {
  const first = upcoming.filter((u) => u.wedding && u.date > today).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!first) return null;
  const days = Array.from({ length: 7 }, (_, i) => addDays(first.date, i));
  const weddingDays = new Set(upcoming.filter((u) => u.wedding).map((u) => u.date));
  const busyDays = new Set(upcoming.filter((u) => u.wedding || u.festival).map((u) => u.date));
  return { days, weddingDays, busyDays };
}

export interface OffConflict {
  sp: string;
  date: string;
}

/** Every weekly off that falls on a wedding date, earliest first. */
export function offsOnWeddingDates(plan: RosterPlan, week: PlannerWeek): OffConflict[] {
  const out: OffConflict[] = [];
  for (const [sp, offs] of Object.entries(plan)) {
    for (const date of offs) if (week.weddingDays.has(date)) out.push({ sp, date });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.sp.localeCompare(b.sp));
}

export interface OffMove extends OffConflict {
  to: string;
}

/**
 * Suggest moving each off that falls on a wedding date to the nearest free days just
 * before the wedding dates begin: never a wedding or festival day, never today or
 * earlier, and a different day for each person so the floor stays covered.
 */
export function suggestMoves(plan: RosterPlan, week: PlannerWeek, today: string): OffMove[] {
  const conflicts = offsOnWeddingDates(plan, week);
  if (!conflicts.length) return [];
  const taken = new Set(Object.values(plan).flat());
  const candidates: string[] = [];
  let day = addDays(week.days[0]!, -1);
  while (candidates.length < conflicts.length && day > today) {
    if (!week.busyDays.has(day) && !taken.has(day)) candidates.push(day);
    day = addDays(day, -1);
  }
  candidates.sort();
  return conflicts.slice(0, candidates.length).map((c, i) => ({ ...c, to: candidates[i]! }));
}

export function applyMoves(plan: RosterPlan, moves: OffMove[]): RosterPlan {
  const next: RosterPlan = Object.fromEntries(Object.entries(plan).map(([sp, offs]) => [sp, [...offs]]));
  for (const m of moves) {
    const offs = (next[m.sp] ?? []).filter((d) => d !== m.date);
    if (!offs.includes(m.to)) offs.push(m.to);
    next[m.sp] = offs.sort();
  }
  return next;
}

export function toggleOff(plan: RosterPlan, sp: string, date: string): RosterPlan {
  const offs = plan[sp] ?? [];
  const next = offs.includes(date) ? offs.filter((d) => d !== date) : [...offs, date].sort();
  return { ...plan, [sp]: next };
}

export function onFloor(plan: RosterPlan, team: string[], date: string): number {
  return team.filter((sp) => !(plan[sp] ?? []).includes(date)).length;
}

/** Saved compactly as day offsets from the week start: "-3,1". */
export function encodeOffs(offs: string[], weekStart: string): string | null {
  if (!offs.length) return null;
  const base = Date.parse(`${weekStart}T00:00:00Z`);
  return offs
    .map((d) => Math.round((Date.parse(`${d}T00:00:00Z`) - base) / 86_400_000))
    .sort((a, b) => a - b)
    .join(",");
}

export function decodeOffs(value: string | null | undefined, weekStart: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isFinite(n) && Math.abs(n) < 60)
    .map((n) => addDays(weekStart, n))
    .sort();
}

/** Days without a bill after which someone is treated as no longer on the floor (same rule as store leads). */
export const ACTIVE_WINDOW_DAYS = 21;

/** Splits a team into people who billed in the last 21 days and people who have not. */
export function splitActive<T extends { last_bill: string | null }>(team: T[], asOf: string): { active: T[]; inactive: T[] } {
  const cutoff = addDays(asOf, -ACTIVE_WINDOW_DAYS);
  const active: T[] = [];
  const inactive: T[] = [];
  for (const t of team) (t.last_bill && t.last_bill > cutoff ? active : inactive).push(t);
  return { active, inactive };
}
