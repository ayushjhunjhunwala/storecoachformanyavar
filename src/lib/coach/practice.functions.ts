import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { forbid, readProfile } from "./guard.server";
import { ClaudeUnavailable, claudeText } from "./claude.server";

export const SCENARIOS = {
  wedding: "a groom-to-be buying a sherwani for his wedding next month, budget-conscious, has not thought about a safa or mojaris",
  kurta: "a young man buying a kurta set for a friend's sangeet, in a hurry, unsure if he needs a jacket",
  family: "a father shopping with his son for Diwali kurtas, comparing prices, worried about discounts elsewhere",
} as const;

const input = z.object({
  scenario: z.enum(["wedding", "kurta", "family"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(600) })).min(1).max(20),
  finish: z.boolean().optional(),
});

export const practiceTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const profile = await readProfile(context.supabase, context.userId);
    if (profile.role !== "salesperson" && profile.role !== "store_lead" && profile.role !== "am") forbid();
    const persona = SCENARIOS[data.scenario];
    const system = data.finish
      ? "You are a friendly retail sales coach at Manyavar, an Indian ethnic menswear brand. Review the practice conversation (the user was the salesperson, 'assistant' lines were the customer). Give: one thing done well, one thing to improve (e.g. suggesting a matching add-on, asking about the occasion), and a score out of 10. Under 90 words, plain and encouraging. Never invent sales figures."
      : `Role-play as a customer in a Manyavar store: ${persona}. The user is the salesperson. Stay in character as the customer, reply in 1-2 short sentences, Hinglish is fine. Never act as the salesperson. Only buy add-ons if the salesperson suggests them well.`;
    try {
      const r = await claudeText({ system, messages: data.messages, maxTokens: data.finish ? 250 : 120 });
      return { ok: true as const, text: r.text };
    } catch (e) {
      if (e instanceof ClaudeUnavailable) return { ok: false as const, text: "Practice partner is unavailable right now. Try again in a minute." };
      throw e;
    }
  });
