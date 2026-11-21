import { describe, expect, it } from "vitest";
import type { Issue, StoreKpi, StoreMeta } from "@/lib/coach/types";
import { buildFacts, decideVerdict, runChecks, unsupportedNumbers, type EvidenceInput } from "@/lib/coach/evidence";

const store: StoreMeta = { store_id: "LKO-02", city: "Lucknow", state: "Uttar Pradesh", zone: "North", tier: "S+", opened_on: "2015-01-01", area_manager_id: "AM-01" };
const kpi: StoreKpi = {
  store_id: "LKO-02", city: "Lucknow", tier: "S+", am: "AM-01", bills: 204, footfall: 1935, revenue: 2_000_000, conv: 0.10543, ipb: 1.83, atv: 9800,
  disc: 0.01, ly_bills: 407, ly_conv: 0.12469, new_store: false, conv_tier: 0.12712, ipb_tier: 1.79, atv_tier: 9436,
};
const issue = (detector: string, extra: Partial<Issue> = {}): Issue => ({
  id: `${detector}-LKO-02-2026-10-26`, rank: 1, area_manager_id: "AM-01", store_id: "LKO-02", city: "Lucknow", detector,
  lever: "More bills", title: "t", cause: "Imran C. billed ₹19.6L in the 120 days before the last bill, last bill 13 Sep.", action: "a", who: "w", when: "Today",
  math: "₹8.0L ÷ 2 = ₹4.0L", rupees: 399558, kpi: "Store bills per week", baseline: 1, sp: ["SP1"], ...extra,
});
const base = (over: Partial<EvidenceInput> = {}): EvidenceInput => ({
  issue: issue("D1"), weekDate: "2026-10-26", asOf: "2026-10-31", store, kpi, network: { bills: 3735, ly_bills: 6822 }, market: [], flags: [],
  upcoming: [{ date: "2026-11-08", festival: "Diwali", wedding: false }], people: [{ id: "SP1", stats: null }], followups: [], ...over,
});

describe("evidence courtroom verdicts", () => {
  it("an absent seller with no market or data concern is supported, with attendance left unverified", () => {
    const input = base();
    const v = decideVerdict(input, runChecks(input, buildFacts(input)));
    expect(v.verdict).toBe("supported");
    expect(v.missing).toContain("attendance");
  });

  it("a city-wide slowdown makes a bills issue uncertain", () => {
    const input = base({ market: [{ city: "Lucknow", zone: "North", value: -0.46, others: -0.38, weeks: 5, weekly: [0, 0, 0, 0, 0, 0], text: "" }] });
    expect(decideVerdict(input, runChecks(input, buildFacts(input))).verdict).toBe("uncertain");
  });

  it("a conversion issue at a store with faulty door counts is rejected", () => {
    const input = base({ issue: issue("D7"), flags: [{ type: "Door camera recorded 0 walk-ins", store_id: "LKO-02", detail: "11 days", routed_to: "Data/IT" }] });
    expect(decideVerdict(input, runChecks(input, buildFacts(input))).verdict).toBe("rejected");
  });

  it("an attach-rate issue with a tiny sample is uncertain", () => {
    const stats = { name: "Sanjay K.", store_id: "LKO-02", bills90: 40, bills28: 12, ipb: 1.5, disc: 0.01, kur_rate: 0.14, kur: 12, wkend_off: 0, last_bill: "2026-10-30", repeat: 0.03 };
    const input = base({ issue: issue("D4", { lever: "Bigger baskets", cause: "Jacket was in stock." }), people: [{ id: "SP1", stats }] });
    const checks = runChecks(input, buildFacts(input));
    expect(checks.find((c) => c.id === "sample")?.status).toBe("concern");
    expect(checks.find((c) => c.id === "stock")?.status).toBe("unknown");
    expect(decideVerdict(input, checks).verdict).toBe("uncertain");
  });

  it("flags numbers the AI wrote that aren't in the facts", () => {
    const facts = buildFacts(base());
    expect(unsupportedNumbers("Imran C. billed ₹19.6L; last bill 13 Sep.", facts)).toEqual([]);
    expect(unsupportedNumbers("Sales fell 37.5% because of him.", facts)).toEqual(["37.5"]);
  });
});
