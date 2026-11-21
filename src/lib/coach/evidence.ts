// Evidence Courtroom rules. Pure: builds a numbered fact packet from engine data that was
// available on the as-of date, runs the deterministic skeptic checks and decides the verdict.
// The AI only writes explanations on top; it never decides the verdict.
import type { DataFlag, FollowupHistory, Issue, MarketIssue, SpStats, StoreKpi, StoreMeta, UpcomingDay } from "./types";

export const PROMPT_VERSION = "courtroom-v1";

export interface Fact {
  id: string;
  label: string;
  text: string;
  source: string;
}

export type CheckStatus = "clear" | "concern" | "unknown" | "not_relevant";
export type CheckId = "market" | "calendar" | "stock" | "sample" | "new_store" | "data_quality" | "attendance" | "comparison";

export interface Check {
  id: CheckId;
  name: string;
  question: string;
  status: CheckStatus;
  finding: string;
  fact_ids: string[];
}

export type Verdict = "supported" | "uncertain" | "rejected";

export interface EvidenceInput {
  issue: Issue;
  weekDate: string;
  asOf: string;
  store: StoreMeta;
  kpi: StoreKpi | null;
  network: { bills: number; ly_bills: number } | null;
  market: MarketIssue[];
  flags: DataFlag[];
  upcoming: UpcomingDay[];
  people: { id: string; stats: SpStats | null }[];
  followups: FollowupHistory[];
}

const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "n/a" : `${(v * 100).toFixed(d)}%`);
const int = (v: number) => Math.round(v).toLocaleString("en-IN");
const change = (now: number, before: number) => (before ? now / before - 1 : null);
const signed = (v: number | null) => (v == null ? "n/a" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** Which detector raised it decides which checks matter. */
export function detectorKind(issue: Issue): "absence" | "weekend" | "discount" | "attach" | "conversion" | "other" {
  switch (issue.detector) {
    case "D1":
      return "absence";
    case "D2":
      return "weekend";
    case "D3":
      return "discount";
    case "D4":
      return "attach";
    case "D7":
      return "conversion";
    default:
      return "other";
  }
}

export function buildFacts(input: EvidenceInput): Fact[] {
  const { issue, kpi, store } = input;
  const facts: Fact[] = [
    { id: "F1", label: "What the engine observed", text: issue.cause, source: `Engine run, week of ${day(input.weekDate)}` },
    {
      id: "F2",
      label: "How the rupees are estimated",
      text: `${issue.math}. This is an opportunity estimate over 4 weeks, not measured or recovered revenue.`,
      source: "Engine formula",
    },
  ];
  if (kpi) {
    facts.push({
      id: "F3",
      label: "Store conversion, last 28 days",
      text: kpi.new_store
        ? `${pct(kpi.conv)}; new store, so no last-year comparison. Tier ${kpi.tier} peers ${pct(kpi.conv_tier)}.`
        : `${pct(kpi.conv)} vs ${pct(kpi.ly_conv)} in the same weeks last year and ${pct(kpi.conv_tier)} for tier ${kpi.tier} peers. ${int(kpi.footfall)} walk-ins.`,
      source: `Store KPIs to ${day(input.asOf)}`,
    });
    facts.push({
      id: "F4",
      label: "Store bills, last 28 days",
      text: kpi.ly_bills ? `${int(kpi.bills)} vs ${int(kpi.ly_bills)} same weeks last year (${signed(change(kpi.bills, kpi.ly_bills))}).` : `${int(kpi.bills)}; no last-year figure.`,
      source: `Store KPIs to ${day(input.asOf)}`,
    });
    facts.push({
      id: "F5",
      label: "Basket and discount",
      text: `Items per bill ${kpi.ipb.toFixed(2)} (tier ${kpi.ipb_tier.toFixed(2)}); average bill ₹${int(kpi.atv)} (tier ₹${int(kpi.atv_tier)}); discount ${pct(kpi.disc)} of MRP${kpi.disc_tier != null ? ` (tier ${pct(kpi.disc_tier)})` : ""}.`,
      source: `Store KPIs to ${day(input.asOf)}`,
    });
  }
  if (input.network) {
    facts.push({
      id: "F6",
      label: "Network bills, last 28 days",
      text: `${int(input.network.bills)} vs ${int(input.network.ly_bills)} same weeks last year (${signed(change(input.network.bills, input.network.ly_bills))}) across all stores.`,
      source: `All stores to ${day(input.asOf)}`,
    });
  }
  const cityMarket = input.market.find((m) => m.city === store.city);
  facts.push({
    id: "F7",
    label: `${store.city} market check`,
    text: cityMarket
      ? `${store.city} walk-ins ${signed(cityMarket.value)} vs ${signed(cityMarket.others)} for other cities${cityMarket.weeks ? `; behind in ${cityMarket.weeks} of ${cityMarket.weekly?.length ?? 6} weeks` : ""}. Flagged as a city-wide slowdown.`
      : `No city-wide slowdown was flagged for ${store.city} on this date.`,
    source: `Market test, ${day(input.asOf)}`,
  });
  const diwali = input.upcoming.find((u) => u.festival === "Diwali");
  const weddings = input.upcoming.filter((u) => u.wedding);
  facts.push({
    id: "F8",
    label: "Calendar",
    text: [
      diwali ? `Diwali falls on ${day(diwali.date)} this year; in 2025 it fell on 20 Oct, inside last year's comparison weeks.` : "No Diwali date in the state calendar ahead.",
      weddings.length ? `${weddings.length} wedding dates ahead, from ${day(weddings[0]!.date)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    source: `${store.state} calendar (Diwali 2025 date from the public calendar)`,
  });
  const storeFlags = input.flags.filter((f) => f.store_id === store.store_id);
  facts.push({
    id: "F9",
    label: "Data quality",
    text: storeFlags.length ? storeFlags.map((f) => `${f.type}: ${f.detail}`).join(" ") : `No data-quality flags for ${store.store_id} on this date.`,
    source: "Data checks",
  });
  facts.push({
    id: "F10",
    label: "Store history",
    text: kpi?.new_store ? `New store, opened ${day(store.opened_on)}. Compared only with tier peers.` : `Opened ${day(store.opened_on)}; mature history.`,
    source: "Store master",
  });
  input.people.forEach((p, i) => {
    const s = p.stats;
    facts.push({
      id: `P${i + 1}`,
      label: s ? `${s.name}` : `Salesperson ${i + 1}`,
      text: s
        ? `${s.bills28} bills in the last 28 days, ${s.bills90} in 90 days; last bill ${s.last_bill ? day(s.last_bill) : "none"}${s.kur_rate != null ? `; kurta-set jacket attach ${pct(s.kur_rate, 0)} of ${s.kur}` : ""}${s.disc != null ? `; discount ${pct(s.disc)} of MRP` : ""}${s.wkend_off != null ? `; weekend days off ${pct(s.wkend_off, 0)}` : ""}.`
        : "No individual figures for this person on this date.",
      source: "Team figures (latest Monday on or before the date)",
    });
  });
  input.followups.forEach((h, i) => {
    facts.push({
      id: `U${i + 1}`,
      label: `Follow-up ${i + 1}`,
      text: h.text,
      source: `Measured ${day(h.on)}, 7 days after the ${day(h.sent_on)} send`,
    });
  });
  facts.push({
    id: "S1",
    label: "Stock",
    text: /in stock/i.test(issue.cause)
      ? "The engine's text says the item was in stock, but stock rows are not in this project, so it can't be re-checked here."
      : "Stock rows are not in this project, so availability can't be checked here.",
    source: "Not connected",
  });
  facts.push({
    id: "S2",
    label: "Roster and attendance",
    text: "Daily roster rows are not in this project. Any roster statement comes from the engine's text and needs the store lead to confirm.",
    source: "Not connected",
  });
  return facts;
}

const has = (facts: Fact[], id: string) => facts.some((f) => f.id === id);
const peopleIds = (facts: Fact[]) => facts.filter((f) => /^P\d+$/.test(f.id)).map((f) => f.id);

export function runChecks(input: EvidenceInput, facts: Fact[]): Check[] {
  const kind = detectorKind(input.issue);
  const kpi = input.kpi;
  const cityMarket = input.market.find((m) => m.city === input.store.city);
  const storeFlags = input.flags.filter((f) => f.store_id === input.store.store_id);
  const people = input.people.map((p) => p.stats).filter((s): s is SpStats => !!s);
  const checks: Check[] = [];

  // 1. Market movement
  checks.push({
    id: "market",
    name: "Market movement",
    question: "Is this city-wide?",
    status: kind === "discount" || kind === "attach" ? "not_relevant" : cityMarket ? "concern" : "clear",
    finding:
      kind === "discount" || kind === "attach"
        ? "Compared with colleagues in the same store and weeks, so a city-wide change affects both sides equally."
        : cityMarket
          ? `${input.store.city} is in a city-wide slowdown, which could explain part of this.`
          : `No city-wide slowdown for ${input.store.city}, so the market doesn't explain it.`,
    fact_ids: ["F7"],
  });

  // 2. Calendar shift
  let calStatus: CheckStatus = "not_relevant";
  let calFinding = "A share within the same weeks isn't moved by the festival calendar.";
  if (kind === "absence") {
    calFinding = "One person stopped billing while the store kept billing; a calendar shift would move everyone.";
  } else if (kind === "conversion" || kind === "other" || kind === "weekend") {
    const net = input.network && input.network.ly_bills ? input.network.bills / input.network.ly_bills - 1 : null;
    const st = kpi && kpi.ly_bills ? kpi.bills / kpi.ly_bills - 1 : null;
    if (kind === "weekend") {
      calStatus = "not_relevant";
      calFinding = "Weekend days off are compared with colleagues in the same weeks.";
    } else if (net != null && net < -0.2 && st != null && Math.abs(st - net) < 0.1) {
      calStatus = "concern";
      calFinding = `Store bills moved with the whole network (${signed(st)} vs ${signed(net)}), which fits the Diwali shift. Conversion is less affected, but treat the gap with care.`;
    } else {
      calStatus = "clear";
      calFinding = "The store isn't simply moving with the network, so the calendar doesn't explain it.";
    }
  }
  checks.push({ id: "calendar", name: "Calendar shift", question: "Is it the festival calendar?", status: calStatus, finding: calFinding, fact_ids: ["F8", ...(has(facts, "F6") ? ["F6"] : []), ...(has(facts, "F4") ? ["F4"] : [])] });

  // 3. Stock
  checks.push({
    id: "stock",
    name: "Stock and sizes",
    question: "Could stock explain it?",
    status: kind === "attach" || kind === "conversion" ? "unknown" : "not_relevant",
    finding:
      kind === "attach" || kind === "conversion"
        ? "Stock rows aren't in this project. The engine's own text is the only stock evidence; confirm on the floor before blaming anyone."
        : "This issue isn't about selling a particular item.",
    fact_ids: ["S1"],
  });

  // 4. Sample size
  let sampleStatus: CheckStatus = "clear";
  let sampleFinding = "Enough bills behind the comparison.";
  if (kind === "discount" || kind === "attach") {
    const small = people.filter((s) => (kind === "attach" ? s.kur : s.bills90) < (kind === "attach" ? 20 : 30));
    if (small.length) {
      sampleStatus = "concern";
      sampleFinding = `${small.map((s) => s.name).join(", ")} ${small.length === 1 ? "has" : "have"} few relevant bills, so the rate can swing by chance.`;
    } else if (!people.length) {
      sampleStatus = "unknown";
      sampleFinding = "No individual figures on this date to check the sample.";
    }
  } else if (kind === "conversion") {
    if (kpi && kpi.footfall < 1000) {
      sampleStatus = "concern";
      sampleFinding = `Only ${int(kpi.footfall)} walk-ins in 28 days; a few buyers either way move the rate.`;
    } else sampleFinding = kpi ? `${int(kpi.footfall)} walk-ins in 28 days is a solid base.` : sampleFinding;
  } else if (kind === "absence") {
    sampleFinding = "A run of 21+ days without a bill is clear-cut, not a sampling question.";
  }
  checks.push({ id: "sample", name: "Sample size", question: "Is the sample big enough?", status: sampleStatus, finding: sampleFinding, fact_ids: [...peopleIds(facts), ...(has(facts, "F3") ? ["F3"] : [])] });

  // 5. New store
  checks.push({
    id: "new_store",
    name: "New store",
    question: "Is this a new store without history?",
    status: kpi?.new_store ? "concern" : "clear",
    finding: kpi?.new_store ? "New store: no year-on-year history, so trends are less reliable." : "Mature store with a full year of history.",
    fact_ids: ["F10"],
  });

  // 6. Data quality
  const dq = storeFlags.length > 0;
  checks.push({
    id: "data_quality",
    name: "Data quality",
    question: "Is the data trustworthy?",
    status: dq ? "concern" : "clear",
    finding: dq
      ? kind === "conversion"
        ? "Door-count problems at this store affect conversion directly."
        : "This store has a data flag; the issue doesn't rely on the flagged figure, but check it."
      : "No data flags for this store.",
    fact_ids: ["F9"],
  });

  // 7. Attendance
  checks.push({
    id: "attendance",
    name: "Attendance",
    question: "Could attendance explain it?",
    status: kind === "absence" || kind === "weekend" ? "unknown" : "not_relevant",
    finding:
      kind === "absence"
        ? "No bills isn't proof someone left. Roster rows aren't here; ask the store lead to confirm before moving their customers."
        : kind === "weekend"
          ? "Roster rows aren't in this project; the engine reports the weekend offs. Confirm with the store lead."
          : "Not an attendance question.",
    fact_ids: ["S2", ...peopleIds(facts)],
  });

  // 8. Comparison / attribution
  checks.push({
    id: "comparison",
    name: "Fair comparison",
    question: "Is it compared with the right people?",
    status: kind === "absence" ? "not_relevant" : "clear",
    finding:
      kind === "discount" || kind === "attach" || kind === "weekend"
        ? "Compared with colleagues in the same store over the same days, never a nationwide ranking."
        : kind === "conversion"
          ? "Compared with the store's own last year and same-tier peers."
          : "One person against their own past billing.",
    fact_ids: ["F1"],
  });
  return checks;
}

/** Verdict from the checks. A concern means an alternative explanation is live. */
export function decideVerdict(input: EvidenceInput, checks: Check[]): { verdict: Verdict; reason: string; missing: string[]; contradictions: string[] } {
  const kind = detectorKind(input.issue);
  const by = (id: CheckId) => checks.find((c) => c.id === id);
  const concerns = checks.filter((c) => c.status === "concern");
  const unknowns = checks.filter((c) => c.status === "unknown");
  const missing = unknowns.map((c) => c.name.toLowerCase());
  const contradictions = concerns.map((c) => c.finding);

  if (kind === "conversion" && by("data_quality")?.status === "concern") {
    return { verdict: "rejected", reason: "Conversion depends on door counts that are flagged as faulty at this store.", missing, contradictions };
  }
  if (kind === "conversion" && by("new_store")?.status === "concern") {
    return { verdict: "rejected", reason: "A year-on-year conversion gap can't be judged for a new store.", missing, contradictions };
  }
  if (concerns.length) {
    return {
      verdict: "uncertain",
      reason: `The observation stands, but ${concerns.map((c) => c.name.toLowerCase()).join(" and ")} could explain part of it.`,
      missing,
      contradictions,
    };
  }
  if (unknowns.length) {
    return {
      verdict: "supported",
      reason: `The observation is supported by every check that can run here. Not verifiable here: ${missing.join(" and ")}, so treat the cause as a hypothesis to confirm on the floor.`,
      missing,
      contradictions,
    };
  }
  return { verdict: "supported", reason: "The observation is supported by every check that can run here.", missing, contradictions };
}

/** Numbers as written (₹4.0L, 10.2%, 43, 1,804) normalised for comparison. */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "")).filter((n) => n.length > 0);
}

/** Every number the model wrote must appear in the facts; returns the ones that don't. */
export function unsupportedNumbers(text: string, facts: Fact[]): string[] {
  const allowed = new Set(facts.flatMap((f) => numbersIn(`${f.text} ${f.label}`)));
  // Small counting words written as digits (1 action, 2 people, 4 weeks, 7 days) are fine.
  for (const n of ["1", "2", "3", "4", "5", "7", "28", "60", "90"]) allowed.add(n);
  return [...new Set(numbersIn(text).filter((n) => !allowed.has(n)))];
}

const BANNED = /(\d+\s*%\s*off|extra discount for the customer|guarantee|definitely caused|proves that|fire (him|her|them)|terminate|misconduct|theft|stole|lazy)/i;

export function bannedPhrase(text: string): string | null {
  const m = text.match(BANNED);
  return m ? m[0] : null;
}

/** Cheap stable hash of the facts for the audit trail. */
export function evidenceHash(facts: Fact[]): string {
  const s = JSON.stringify(facts.map((f) => [f.id, f.text]));
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return `fnv1a-${(h1 >>> 0).toString(16).padStart(8, "0")}-${s.length}`;
}

export const CHALLENGE_PRESETS: { id: CheckId; label: string }[] = [
  { id: "stock", label: "Could stock explain it?" },
  { id: "market", label: "Is this city-wide?" },
  { id: "calendar", label: "Is it the festival calendar?" },
  { id: "sample", label: "Is the sample big enough?" },
  { id: "data_quality", label: "Is the data trustworthy?" },
  { id: "attendance", label: "Could attendance explain it?" },
];
