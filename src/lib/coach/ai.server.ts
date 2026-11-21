// "Ask Store Coach": grounding context + Sarvam call with Lovable AI fallback.
import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";
import type { ManagerView } from "./types";
import {
  FOCUS_LABEL,
  RESULT_LABEL,
  formatLongDate,
  formatNumber,
  formatPct,
  formatRupees,
  formatShortDate,
} from "./format";

export const SYSTEM_PROMPT =
  "You are Store Coach, an assistant for Manyavar retail managers. Answer ONLY from the JSON data provided. Copy every number, name, store id and date exactly as written in the data; never calculate new numbers. If the answer is not in the data, say you don't have it. Never mention stores or people that are not in the data. Keep answers under 150 words. When useful, end with one action naming who does what and when. Reply in the same language the user writes in.";

export const SARVAM_URL = "https://api.sarvam.ai/v1/chat/completions";
export const SARVAM_MODEL = "sarvam-105b";
export const SARVAM_TIMEOUT_MS = 20_000;
export const FALLBACK_MODEL = "openai/gpt-6-astra";

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

const fmtIpb = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));

/**
 * The scoped slice, pre-formatted exactly as the dashboard shows it, so the
 * model can copy figures instead of converting raw fractions.
 */
export function buildAiContext(view: ManagerView) {
  const amName = new Map(view.area_managers.map((a) => [a.area_manager_id, a.name]));
  const stores = view.store_order.map((id) => {
    const b = view.stores[id];
    if (!b) return { store_id: id };
    const k = b.kpi;
    return {
      store_id: id,
      city: b.meta.city,
      tier: b.meta.tier,
      area_manager: amName.get(b.meta.area_manager_id) ?? b.meta.area_manager_id,
      store_lead: b.lead_name,
      last_4_weeks: k
        ? {
            bills: formatNumber(k.bills),
            bills_same_weeks_last_year: formatNumber(k.ly_bills),
            walk_ins: formatNumber(k.footfall),
            revenue: formatRupees(k.revenue),
            conversion: formatPct(k.conv),
            conversion_same_weeks_last_year: formatPct(k.ly_conv),
            conversion_tier_average: formatPct(k.conv_tier),
            items_per_bill: fmtIpb(k.ipb),
            items_per_bill_tier_average: fmtIpb(k.ipb_tier),
            average_bill: formatRupees(k.atv),
            average_bill_tier_average: formatRupees(k.atv_tier),
            discount_share_of_mrp: formatPct(k.disc),
            new_store: k.new_store,
          }
        : null,
      team_as_of: view.team_as_of ? formatShortDate(view.team_as_of) : null,
      team: b.team.map((t) => ({
        name: t.name,
        bills_28_days: t.bills28,
        bills_90_days: t.bills90,
        items_per_bill: fmtIpb(t.ipb),
        kurta_set_to_jacket: formatPct(t.kur_rate),
        discount: formatPct(t.disc),
        weekend_days_off: formatPct(t.wkend_off, 0),
        repeat_customers: formatPct(t.repeat),
        last_bill: formatShortDate(t.last_bill),
      })),
      mentor_pairs: b.mentors.map((m) => ({
        mentee: m.mentee_name,
        mentor: m.mentor_name,
        focus: FOCUS_LABEL[m.focus] ?? m.focus,
      })),
      callback_customers_total: b.callbacks.total,
      data_flags: b.flags.map((f) => `${f.type}: ${f.detail} (routed to ${f.routed_to})`),
    };
  });

  const weekNow = view.weeks[view.weeks.length - 1];
  return {
    replay_date: formatLongDate(view.date),
    viewer: { name: view.profile.display_name, role: view.role, scope: view.profile.scope_id },
    weekly_digest: {
      sent_on: formatShortDate(view.digest_date),
      issue_count: view.digest.length,
      issues: view.digest.map((i) => ({
        rank: i.rank,
        store_id: i.store_id,
        city: i.city,
        area_manager: amName.get(i.area_manager_id) ?? i.area_manager_id,
        lever: i.lever,
        rupees_at_stake_per_4_weeks: formatRupees(i.rupees),
        title: i.title,
        cause: i.cause,
        action: i.action,
        who: i.who,
        when: i.when,
        math: i.math,
        kpi: i.kpi,
      })),
    },
    follow_ups: view.followups.map((f) => ({
      store_id: f.store_id,
      issue: f.title,
      sent_on: f.sends.map(formatShortDate),
      latest_result: f.latest
        ? { measured_on: formatShortDate(f.latest.on), result: RESULT_LABEL[f.latest.result], text: f.latest.text }
        : "Not measured yet",
      earlier_results: f.history.slice(0, -1).map((h) => ({
        measured_on: formatShortDate(h.on),
        result: RESULT_LABEL[h.result],
        text: h.text,
      })),
    })),
    stores,
    market_issues_held_back: view.market.map((m) => ({ city: m.city, zone: m.zone, text: m.text })),
    data_issues_held_back: view.flags.map((f) => ({
      store_id: f.store_id,
      type: f.type,
      detail: f.detail,
      routed_to: f.routed_to,
    })),
    repeat_customer_role_models: view.roles.map((r) => ({
      name: r.name,
      store_id: r.store_id,
      city: r.city,
      repeat_rate: formatPct(r.rate),
      city_median: formatPct(r.city_med),
    })),
    area_managers: view.area_managers.map((a) => ({
      name: a.name,
      id: a.area_manager_id,
      city: a.city,
      stores: a.stores,
      issues_this_week: weekNow?.by_am[a.area_manager_id]?.count ?? null,
      rupees_at_stake_this_week:
        weekNow?.by_am[a.area_manager_id] != null
          ? formatRupees(weekNow.by_am[a.area_manager_id]?.rupees ?? 0)
          : null,
    })),
    wedding_and_festival_dates_ahead: Object.fromEntries(
      Object.entries(view.upcoming).map(([state, days]) => [
        state,
        days.slice(0, 12).map((d) => `${formatShortDate(d.date)}${d.festival ? ` (${d.festival})` : ""}${d.wedding ? " wedding date" : ""}`),
      ]),
    ),
    ...(view.network
      ? {
          network_bills_last_4_weeks: formatNumber(view.network.bills),
          network_bills_same_weeks_last_year: formatNumber(view.network.ly_bills),
        }
      : {}),
    ...(view.runs.length
      ? {
          recent_daily_runs: view.runs.slice(-7).map((r) => ({
            date: formatShortDate(r.replay_date),
            issues: r.issues,
            cards: r.cards,
            longest_card_words: r.max_card_words,
            data_flags: r.flags,
            market_issues: r.market,
          })),
        }
      : {}),
  };
}

export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "")
    .trim();
}

async function callSarvam(messages: ChatTurn[], apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SARVAM_TIMEOUT_MS);
  try {
    const res = await fetch(SARVAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-subscription-key": apiKey },
      body: JSON.stringify({
        model: SARVAM_MODEL,
        temperature: 0.2,
        max_tokens: 600,
        // Reasoning tokens count toward max_tokens; turn thinking off so the
        // 600-token budget goes to the answer itself.
        reasoning_effort: null,
        messages,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sarvam ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = stripThinking(json.choices?.[0]?.message?.content ?? "");
    if (!content) throw new Error("Sarvam returned an empty answer");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

async function callLovableAi(messages: ChatTurn[]): Promise<string> {
  const response = await generateResponse({
    model: FALLBACK_MODEL,
    input: messages.map((m) => ({ role: m.role, content: m.content })),
    max_output_tokens: 1200,
    reasoning: { effort: "low" },
  });
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content) {
      if (c.type === "output_text") parts.push(c.text);
    }
  }
  const text = stripThinking(parts.join("\n"));
  if (!text) throw new Error("Built-in AI returned an empty answer");
  return text;
}

export async function askModel(messages: ChatTurn[]): Promise<{ answer: string; provider: string }> {
  const key = process.env["SARVAM_API_KEY"];
  if (key) {
    try {
      return { answer: await callSarvam(messages, key), provider: "sarvam" };
    } catch (error) {
      console.error("[ask-coach] Sarvam failed, retrying with Lovable AI", error);
    }
  } else {
    console.warn("[ask-coach] SARVAM_API_KEY not set, using Lovable AI");
  }
  try {
    return { answer: await callLovableAi(messages), provider: "lovable-ai" };
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error("[ask-coach] Lovable AI failed", error.code, error.httpStatus, error.ids);
    } else {
      console.error("[ask-coach] Lovable AI failed", error);
    }
    throw new Error("The assistant could not answer right now. Please try again in a minute.");
  }
}
