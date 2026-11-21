import { describe, expect, it } from "vitest";
import type { UpcomingDay } from "@/lib/coach/types";
import { applyMoves, decodeOffs, encodeOffs, offsOnWeddingDates, onFloor, plannerWeek, suggestMoves } from "@/lib/coach/roster";

// Uttar Pradesh calendar from the data: Diwali 8 Nov, wedding dates 20–30 Nov.
const UP: UpcomingDay[] = [
  { date: "2026-11-08", festival: "Diwali", wedding: false },
  ...Array.from({ length: 11 }, (_, i) => ({ date: `2026-11-${String(20 + i)}`, festival: null, wedding: true })),
];

describe("roster planner", () => {
  const week = plannerWeek(UP, "2026-10-31")!;

  it("plans the seven days from the first wedding date: Fri 20 – Thu 26 Nov", () => {
    expect(week.days[0]).toBe("2026-11-20");
    expect(week.days[6]).toBe("2026-11-26");
    expect(week.days.every((d) => week.weddingDays.has(d))).toBe(true);
  });

  it("flags weekly offs that fall on wedding dates", () => {
    const plan = { A: ["2026-11-21"], B: ["2026-11-24"], C: [] };
    expect(offsOnWeddingDates(plan, week)).toEqual([
      { sp: "A", date: "2026-11-21" },
      { sp: "B", date: "2026-11-24" },
    ]);
  });

  it("moves three wedding-date offs to Tue 17, Wed 18 and Thu 19 Nov", () => {
    const plan = { varun: ["2026-11-21"], faizan: ["2026-11-24"], arif: ["2026-11-25"] };
    const moves = suggestMoves(plan, week, "2026-10-31");
    expect(moves.map((m) => [m.sp, m.to])).toEqual([
      ["varun", "2026-11-17"],
      ["faizan", "2026-11-18"],
      ["arif", "2026-11-19"],
    ]);
    const next = applyMoves(plan, moves);
    expect(offsOnWeddingDates(next, week)).toEqual([]);
    expect(onFloor(next, ["varun", "faizan", "arif"], "2026-11-21")).toBe(3);
  });

  it("never suggests a festival day", () => {
    const near: UpcomingDay[] = [
      { date: "2026-11-19", festival: "Chhath Puja", wedding: false },
      { date: "2026-11-20", festival: null, wedding: true },
    ];
    const w = plannerWeek(near, "2026-10-31")!;
    const moves = suggestMoves({ a: ["2026-11-20"] }, w, "2026-10-31");
    expect(moves[0]?.to).toBe("2026-11-18");
  });

  it("saves offs as day offsets and reads them back", () => {
    const offs = ["2026-11-17", "2026-11-21"];
    expect(encodeOffs(offs, "2026-11-20")).toBe("-3,1");
    expect(decodeOffs("-3,1", "2026-11-20")).toEqual(offs);
  });
});

describe("roster planner team", () => {
  it("leaves off people with no bill in the 21 days before the data date", async () => {
    const { splitActive } = await import("@/lib/coach/roster");
    const team = [
      { name: "Imran C.", last_bill: "2026-09-13" },
      { name: "Sumit A.", last_bill: "2026-10-30" },
      { name: "Edge", last_bill: "2026-10-10" },
      { name: "Never", last_bill: null },
    ];
    const { active, inactive } = splitActive(team, "2026-10-31");
    expect(active.map((t) => t.name)).toEqual(["Sumit A."]);
    expect(inactive.map((t) => t.name)).toEqual(["Imran C.", "Edge", "Never"]);
    expect(splitActive(team, "2026-10-31").active).toHaveLength(1);
    expect(splitActive([{ name: "Day 20", last_bill: "2026-10-11" }], "2026-10-31").active).toHaveLength(1);
  });
});
