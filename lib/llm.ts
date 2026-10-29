import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod/v4";

// One small wrapper for every AI call. Provider and model come from env, so switching is one line.
// Only Gemini is wired up today (free tier); add a branch here for Groq or Claude later.

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "rate_limited" | "bad_output" | "failed",
  ) {
    super(message);
  }
}

export function llmConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.LLM_MODEL);
}

let client: GoogleGenAI | null = null;
function gemini() {
  if (!llmConfigured()) throw new LlmError("GEMINI_API_KEY or LLM_MODEL is missing", "not_configured");
  return (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
}

function jsonSchemaFor(schema: z.ZodType) {
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void $schema;
  return rest;
}

// Free-tier models get busy ("high demand", 503) or rate-limited (429). When that happens,
// or a call is too slow, we retry once on a lighter free model.
const FALLBACK_MODEL = process.env.LLM_FALLBACK_MODEL || "gemini-3.5-flash-lite";

const BUSY_COOLDOWN_MS = 5 * 60_000;
const busyUntil = new Map<string, number>();

const isBusy = (msg: string) => /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|quota|overloaded/i.test(msg);
const isTimeout = (err: unknown) => err instanceof Error && /abort|timeout/i.test(`${err.name} ${err.message}`);

/** Asks the model for JSON matching `schema`; the reply is validated before it is returned. */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  opts: { system: string; prompt: string; timeoutMs?: number },
): Promise<T> {
  const provider = process.env.LLM_PROVIDER ?? "gemini";
  if (provider !== "gemini") throw new LlmError(`LLM_PROVIDER "${provider}" is not supported yet`, "not_configured");

  const all = [...new Set([process.env.LLM_MODEL!, FALLBACK_MODEL])];
  // Skip a model that was busy in the last few minutes, unless it's the only one left.
  const models = all.filter((m) => (busyUntil.get(m) ?? 0) < Date.now());
  if (models.length === 0) models.push(all[all.length - 1]);
  let text: string | undefined;
  let lastError = "";

  for (const model of models) {
    try {
      const res = await gemini().models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchemaFor(schema),
          temperature: 0.3,
          // Thinking makes answers slow; these are extraction tasks, so keep it light.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 22_000),
        },
      });
      text = res.text;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[llm] ${model} failed:`, lastError.slice(0, 200));
      if (!isBusy(lastError) && !isTimeout(err)) {
        throw new LlmError(`AI request failed: ${lastError.slice(0, 200)}`, "failed");
      }
      busyUntil.set(model, Date.now() + BUSY_COOLDOWN_MS);
    }
  }
  if (text === undefined) {
    throw new LlmError("The free AI models are busy right now. Try again in a minute.", "rate_limited");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text ?? "");
  } catch {
    throw new LlmError("The AI returned something that wasn't JSON.", "bad_output");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new LlmError("The AI's answer didn't match the expected shape.", "bad_output");
  return parsed.data;
}
