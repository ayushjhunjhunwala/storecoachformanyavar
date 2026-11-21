// @vitest-environment node
import { describe, expect, it } from "vitest";
import { loadTestCoachData } from "./coach-data";
import { indexCoachData, digestDateFor, followupKey, storeLeadFor } from "@/lib/coach/logic";
import { buildView, ScopeError } from "@/lib/coach/slice.server";
import { buildDemoAccounts, DEMO_PASSWORD } from "@/lib/coach/accounts.server";
import { buildAiContext } from "@/lib/coach/ai.server";
import { formatPct, formatRupees } from "@/lib/coach/format";
import type { CoachRole, ManagerView, MyView, ViewProfile } from "@/lib/coach/types";

const records = await loadTestCoachData();
const index = records ? indexCoachData(records) : null;
const LAST = "2026-10-31";

function profile(role: CoachRole, scope_id: string | null): ViewProfile {
  return { email: "test@storecoach.demo", display_name: "Test", role, scope_id };
}
function manager(role: CoachRole, scope: string | null, date = LAST): ManagerView {
  const v = buildView(index!, profile(role, scope), date);
  if (v.kind !== "manager") throw new Error("expected manager view");
  return v;
}

describe("number formatting (PRD: ₹4.0L / ₹12K / ₹1.2Cr, 1-decimal %)", () => {
  it("formats rupees and percentages", () => {
    expect(formatRupees(399558)).toBe("₹4.0L");
    expect(formatRupees(34345)).toBe("₹34K");
    expect(formatRupees(12_000_000)).toBe("₹1.2Cr");
    expect(formatPct(0.10156)).toBe("10.2%");
  });
});

describe.skipIf(!index)("Store Coach scoping on the real data", () => {
  it("weekly digest is the most recent Monday on or before the date (1 Oct counts)", () => {
    expect(digestDateFor(index!.dates, "2026-10-31")).toBe("2026-10-26");
    expect(digestDateFor(index!.dates, "2026-10-03")).toBe("2026-10-01");
    expect(digestDateFor(index!.dates, "2026-10-12")).toBe("2026-10-12");
  });

  it("matches a follow-up by detector-store-title cut before ' has not'", () => {
    const view = manager("am", "AM-01");
    const imran = view.digest.find((i) => i.store_id === "LKO-02");
    expect(imran).toBeDefined();
    expect(followupKey(imran!)).toBe("D1-LKO-02-Imran C.");
    const f = view.followups.find((x) => x.key === followupKey(imran!));
    expect(f?.latest?.on).toBe("2026-10-26");
    expect(f?.latest?.result).toBe("no_change");
  });

  it("store lead is the longest-serving salesperson who billed in the last 21 days", () => {
    expect(storeLeadFor(index!, "LKO-02")?.name).toBe("Jitendra V.");
    expect(storeLeadFor(index!, "KNP-03")?.name).toBe("Sumit S.");
  });

  it("builds the demo accounts exactly as specified", () => {
    const accounts = buildDemoAccounts(index!);
    const byEmail = new Map(accounts.map((a) => [a.email, a]));
    expect(DEMO_PASSWORD).toBe("Demo@2026");
    expect(byEmail.get("hq@storecoach.demo")?.role).toBe("hq");
    expect(byEmail.get("zonal.north@storecoach.demo")?.scope_id).toBe("North");
    expect(byEmail.get("zonal.east@storecoach.demo")?.scope_id).toBe("East");
    expect(byEmail.get("zonal.south@storecoach.demo")?.scope_id).toBe("South");
    expect(byEmail.get("am01@storecoach.demo")?.scope_id).toBe("AM-01");
    expect(byEmail.get("am06@storecoach.demo")?.scope_id).toBe("AM-06");
    expect(byEmail.get("lead.lko02@storecoach.demo")).toMatchObject({
      role: "store_lead",
      scope_id: "LKO-02",
      display_name: "Jitendra V.",
    });
    expect(accounts.filter((a) => a.role === "store_lead")).toHaveLength(20);
    expect(byEmail.get("sp1019@storecoach.demo")).toMatchObject({ role: "salesperson", scope_id: "SP1019" });
    expect(accounts.filter((a) => a.role === "salesperson")).toHaveLength(122);
    expect(new Set(accounts.map((a) => a.email)).size).toBe(accounts.length);
  });

  it("salesperson gets only their own card, trend, stats and callbacks", () => {
    const view = buildView(index!, profile("salesperson", "SP1019"), LAST) as MyView;
    expect(view.kind).toBe("salesperson");
    expect(view.salesperson_id).toBe("SP1019");
    expect(view.store_id).toBe("LKO-02");
    expect(view.card?.sp ?? "SP1019").toBe("SP1019");
    expect(view.trend).toEqual(index!.trend["SP1019"]);
    expect(view.store_trend).toEqual(index!.trend["_store_LKO-02"]);
    expect(view.stats?.name).toBe(view.name);
    expect(view.callbacks.items.every((c) => c.owner === "SP1019")).toBe(true);
    const json = JSON.stringify(view);
    for (const key of ["digest", "stores", "team", "followups", "market", "flags", "rupees"]) {
      expect(json).not.toContain(`"${key}"`);
    }
    // No other salesperson's stats objects leak in.
    expect(view.card?.peer ?? null).toBeNull();
    const otherIds = [...index!.spById.keys()].filter((id) => id !== "SP1019");
    for (const id of otherIds) expect(json).not.toContain(`"${id}"`);
  });

  it("am01 sees only Lucknow (LKO) stores and issues", () => {
    const view = manager("am", "AM-01");
    expect(view.store_order).toEqual(["LKO-01", "LKO-02", "LKO-03", "LKO-04"]);
    expect(Object.keys(view.stores).every((id) => id.startsWith("LKO-"))).toBe(true);
    expect(view.digest.length).toBeGreaterThan(0);
    expect(view.digest.every((i) => i.store_id.startsWith("LKO-"))).toBe(true);
    expect(view.followups.every((f) => f.store_id.startsWith("LKO-"))).toBe(true);
    expect(view.market.every((m) => m.city === "Lucknow")).toBe(true);
    expect(view.area_managers.map((a) => a.area_manager_id)).toEqual(["AM-01"]);
    expect(view.runs).toEqual([]);
    expect(view.network).toBeNull();
  });

  it("store lead sees only their store, with no market issues or other stores", () => {
    const view = manager("store_lead", "LKO-02");
    expect(view.store_order).toEqual(["LKO-02"]);
    expect(view.digest.every((i) => i.store_id === "LKO-02")).toBe(true);
    expect(view.market).toEqual([]);
    expect(view.weeks).toEqual([]);
  });

  it("zonal head sees only stores and market issues in their zone", () => {
    const view = manager("zonal", "North");
    expect(view.store_order.every((id) => id.startsWith("LKO-") || id.startsWith("KNP-"))).toBe(true);
    expect(view.store_order).toHaveLength(7);
    expect(view.market.every((m) => m.zone === "North")).toBe(true);
    expect(view.runs.length).toBe(31);
  });

  it("hq sees every store and the network bills vs last year", () => {
    const view = manager("hq", "ALL");
    expect(view.store_order).toHaveLength(20);
    expect(view.network).toEqual({ bills: 3735, ly_bills: 6822 });
  });

  it("refuses unknown dates and out-of-scope accounts", () => {
    expect(() => buildView(index!, profile("am", "AM-01"), "2026-11-05")).toThrow(ScopeError);
    expect(() => buildView(index!, profile("zonal", "West"), LAST)).toThrow(ScopeError);
    expect(() => buildView(index!, profile("salesperson", "SP9999"), LAST)).toThrow(ScopeError);
  });

  it("assistant context copies the issue card's rupees exactly", () => {
    const view = manager("am", "AM-01");
    const ctx = buildAiContext(view);
    const lko02 = ctx.weekly_digest.issues.find((i) => i.store_id === "LKO-02");
    expect(lko02?.rupees_at_stake_per_4_weeks).toBe("₹4.0L");
    expect(ctx.stores.map((s) => s.store_id)).toEqual(["LKO-01", "LKO-02", "LKO-03", "LKO-04"]);
  });
});
