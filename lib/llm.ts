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
// a call is too slow, or the reply comes back empty (blocked), we retry once on a lighter free model.
const FALLBACK_MODEL = process.env.LLM_FALLBACK_MODEL || "gemini-3.5-flash-lite";

// A demand spike (503) passes quickly; a daily quota doesn't, and a per-minute limit is in between.
const cooldownMs = (msg: string) => (/per ?day/i.test(msg) ? 5 * 60_000 : /\b429\b|RESOURCE_EXHAUSTED/.test(msg) ? 60_000 : 20_000);
const busyUntil = new Map<string, number>();

const isBusy = (msg: string) => /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|quota|overloaded/i.test(msg);
// Only real overload puts a model on cooldown; one slow or empty answer doesn't.
const isOverloaded = (msg: string) => /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(msg);
const isTimeout = (err: unknown) => err instanceof Error && /abort|timeout/i.test(`${err.name} ${err.message}`);

// The free tier allows few requests a minute, so this server sends only a few at a time and the rest wait their turn.
const MAX_RUNNING = 3;
let running = 0;
const waiting: (() => void)[] = [];
async function takeTurn() {
  if (running < MAX_RUNNING) running++;
  else await new Promise<void>((go) => waiting.push(go)); // the finishing call hands over its turn
  return () => {
    const next = waiting.shift();
    if (next) next();
    else running--;
  };
}

const MAX_WAIT_MS = 35_000; // a per-minute limit clears within this
/** How long to wait before trying the same model again. Null when waiting won't help: a daily quota, or a wait too long for someone watching. */
function retryWait(msg: string) {
  if (!isOverloaded(msg) || /per ?day/i.test(msg)) return null;
  const asked = msg.match(/retry\w*[^0-9]{0,12}(\d+(?:\.\d+)?)\s*s/i);
  const ms = (asked ? Number(asked[1]) * 1000 : 2000) + Math.random() * 1000;
  return ms <= MAX_WAIT_MS ? ms : null;
}
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise((done) => {
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), done(undefined)), { once: true });
  });

/** Asks the model for JSON matching `schema`; the reply is validated before it is returned. */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  opts: { system: string; prompt: string; timeoutMs?: number; signal?: AbortSignal; light?: boolean; temperature?: number },
): Promise<T> {
  const provider = process.env.LLM_PROVIDER ?? "gemini";
  if (provider !== "gemini") throw new LlmError(`LLM_PROVIDER "${provider}" is not supported yet`, "not_configured");

  // The main model allows very few free requests a day, so `light` calls (reading, planning, ideas) start on the lighter one.
  const all = [...new Set(opts.light ? [FALLBACK_MODEL, process.env.LLM_MODEL!] : [process.env.LLM_MODEL!, FALLBACK_MODEL])];
  // Skip a model that was busy in the last few minutes, unless it's the only one left.
  const models = all.filter((m) => (busyUntil.get(m) ?? 0) < Date.now());
  if (models.length === 0) models.push(all[all.length - 1]);
  let text: string | undefined;
  let lastError = "";
  const stopped = () => new LlmError("The research was stopped.", "failed");

  for (const model of models) {
    for (let attempt = 0; attempt < 2 && text === undefined; attempt++) {
      const done = await takeTurn();
      if (opts.signal?.aborted) {
        done();
        throw stopped();
      }
      let wait: number | null = null;
      try {
        const timeout = AbortSignal.timeout(opts.timeoutMs ?? 22_000);
        const res = await gemini().models.generateContent({
          model,
          contents: opts.prompt,
          config: {
            systemInstruction: opts.system,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchemaFor(schema),
            temperature: opts.temperature ?? 0.3,
            // Thinking makes answers slow; these are extraction tasks, so keep it light.
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout,
          },
        });
        const used = res.usageMetadata;
        console.log(`[llm] ${model}: ${used?.promptTokenCount ?? "?"} in, ${used?.totalTokenCount ?? "?"} total`);
        if (!res.text?.trim()) {
          // Blocked by a safety filter or simply empty: the other model may still answer.
          lastError = "empty reply";
          console.warn(`[llm] ${model} returned no text`);
          break;
        }
        text = res.text;
      } catch (err) {
        if (opts.signal?.aborted) throw stopped();
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[llm] ${model} failed:`, lastError.replace(/\s+/g, " ").slice(0, 300));
        if (!isBusy(lastError) && !isTimeout(err)) {
          throw new LlmError(`AI request failed: ${lastError.slice(0, 200)}`, "failed");
        }
        wait = attempt === 0 ? retryWait(lastError) : null;
        if (wait === null && isOverloaded(lastError)) busyUntil.set(model, Date.now() + cooldownMs(lastError));
      } finally {
        done();
      }
      if (text !== undefined) break;
      if (wait === null) break; // on to the other model
      await sleep(wait, opts.signal); // outside our turn, so other calls keep moving
    }
    if (text !== undefined) break;
  }
  if (text === undefined) {
    if (lastError === "empty reply") throw new LlmError("The AI returned an empty answer. Try rewording, or try again.", "bad_output");
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
