// Claude via the Lovable AI gateway (Anthropic Messages surface). Structured JSON output,
// one repair attempt on invalid output, then the caller falls back to a deterministic template.
import { generateMessage, GatewayError } from "@lovable.dev/ai-gateway";
import type { z } from "zod";

export const CLAUDE_REASONING = "anthropic/claude-sonnet-5" as const;
export const CLAUDE_FAST = "anthropic/claude-haiku-4-5" as const;
type ClaudeModel = typeof CLAUDE_REASONING | typeof CLAUDE_FAST;

export interface ClaudeResult<T> {
  data: T;
  model: ClaudeModel;
  latencyMs: number;
  repaired: boolean;
  validations: string[];
}

export class ClaudeUnavailable extends Error {
  constructor(
    message: string,
    readonly validations: string[] = [],
  ) {
    super(message);
    this.name = "ClaudeUnavailable";
  }
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function textOf(response: { content?: unknown }): string {
  const blocks = Array.isArray(response.content) ? (response.content as { type?: string; text?: string }[]) : [];
  return blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function callClaude(model: ClaudeModel, system: string, messages: Msg[], maxTokens: number, schema?: Record<string, unknown>): Promise<string> {
  const payload = {
    model,
    system,
    max_tokens: maxTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    ...(schema ? { output_config: { format: { type: "json_schema" as const, schema } } } : {}),
  };
  const response =
    model === CLAUDE_REASONING
      ? await generateMessage({ ...payload, model: CLAUDE_REASONING, thinking: { type: "disabled" } })
      : await generateMessage({ ...payload, model: CLAUDE_FAST });
  return textOf(response as { content?: unknown });
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in the answer");
  return JSON.parse(trimmed.slice(start, end + 1));
}

/**
 * Asks Claude for JSON matching `schema` (sent as a JSON schema) and `parser` (zod).
 * `check` returns semantic problems (unsupported numbers, unknown fact ids, banned claims).
 */
export async function claudeJson<T>({
  model = CLAUDE_REASONING,
  system,
  prompt,
  jsonSchema,
  parser,
  check,
  maxTokens = 900,
}: {
  model?: ClaudeModel;
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  parser: z.ZodType<T>;
  check: (data: T) => string[];
  maxTokens?: number;
}): Promise<ClaudeResult<T>> {
  const started = Date.now();
  const validations: string[] = [];
  const messages: Msg[] = [{ role: "user", content: prompt }];
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await callClaude(model, system, messages, maxTokens, jsonSchema);
    } catch (error) {
      if (error instanceof GatewayError) {
        console.error("[claude] gateway error", error.code, error.httpStatus, error.ids);
        throw new ClaudeUnavailable(`AI unavailable (${error.code})`, validations);
      }
      throw new ClaudeUnavailable("AI unavailable", validations);
    }
    let problems: string[];
    let parsed: T | null = null;
    try {
      parsed = parser.parse(extractJson(raw));
      problems = check(parsed);
    } catch (error) {
      problems = [`Invalid format: ${error instanceof Error ? error.message.slice(0, 160) : "unreadable"}`];
    }
    if (parsed && problems.length === 0) {
      validations.push(attempt === 0 ? "passed" : "passed after one repair");
      return { data: parsed, model, latencyMs: Date.now() - started, repaired: attempt > 0, validations };
    }
    validations.push(...problems.map((p) => `attempt ${attempt + 1}: ${p}`));
    messages.push({ role: "assistant", content: raw.slice(0, 4000) });
    messages.push({
      role: "user",
      content: `That answer failed validation: ${problems.join("; ")}. Return corrected JSON only. Use only numbers and fact IDs that appear in the facts.`,
    });
  }
  throw new ClaudeUnavailable("AI answer failed validation twice", validations);
}

/** Plain text (practice dialogue). */
export async function claudeText({
  model = CLAUDE_FAST,
  system,
  messages,
  maxTokens = 300,
}: {
  model?: ClaudeModel;
  system: string;
  messages: Msg[];
  maxTokens?: number;
}): Promise<{ text: string; model: ClaudeModel; latencyMs: number }> {
  const started = Date.now();
  try {
    const text = await callClaude(model, system, messages, maxTokens);
    if (!text) throw new ClaudeUnavailable("AI returned an empty answer");
    return { text, model, latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof ClaudeUnavailable) throw error;
    if (error instanceof GatewayError) {
      console.error("[claude] gateway error", error.code, error.httpStatus, error.ids);
      throw new ClaudeUnavailable(`AI unavailable (${error.code})`);
    }
    throw new ClaudeUnavailable("AI unavailable");
  }
}
