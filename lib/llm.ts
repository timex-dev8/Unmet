import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod/v4";

// one wrapper for every ai call, only gemini is wired up (free tier)

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

function jsonSchemaFor(schema: z.ZodType, notes = true) {
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void $schema;
  return notes ? rest : stripNotes(rest);
}

// big schemas with field notes get refused by the light model, so large batches send them bare
function stripNotes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNotes);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "description")
      .map(([key, child]) => [key, stripNotes(child)]),
  );
}

// free tier gets busy (503) or rate limited (429): retry once on the lighter model
const FALLBACK_MODEL = process.env.LLM_FALLBACK_MODEL || "gemini-3.5-flash-lite";

// 503 spikes pass fast, a daily quota doesn't, per-minute is in between
const cooldownMs = (message: string) => (/per ?day/i.test(message) ? 5 * 60_000 : /\b429\b|RESOURCE_EXHAUSTED/.test(message) ? 60_000 : 20_000);
const busyUntil = new Map<string, number>();

const isBusy = (message: string) => /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|quota|overloaded/i.test(message);
// only real overload puts a model on cooldown
const isOverloaded = (message: string) => /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(message);
const isTimeout = (err: unknown) => err instanceof Error && /abort|timeout/i.test(`${err.name} ${err.message}`);
// a 400 (usually the schema) moves on to the other model
const isBadRequest = (err: unknown, message: string) => (err instanceof ApiError && err.status === 400) || /INVALID_ARGUMENT/.test(message);

// free tier allows few requests a minute, so only a few go at once
const MAX_RUNNING = 3;
let running = 0;
const waiting: (() => void)[] = [];
async function takeTurn() {
  if (running < MAX_RUNNING) running++;
  else await new Promise<void>((resume) => waiting.push(resume));
  return () => {
    const next = waiting.shift();
    if (next) next();
    else running--;
  };
}

const MAX_WAIT_MS = 35_000; // a per-minute limit clears within this
// null = waiting won't help (daily quota or too long)
function retryWait(message: string) {
  if (!isOverloaded(message) || /per ?day/i.test(message)) return null;
  const asked = message.match(/retry\w*[^0-9]{0,12}(\d+(?:\.\d+)?)\s*s/i);
  const ms = (asked ? Number(asked[1]) * 1000 : 2000) + Math.random() * 1000;
  return ms <= MAX_WAIT_MS ? ms : null;
}
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), resolve(undefined)), { once: true });
  });

function parseReply<T>(schema: z.ZodType<T>, text: string): { data: T } | { problem: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { problem: "The AI returned something that wasn't JSON." };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? { data: parsed.data } : { problem: "The AI's answer didn't match the expected shape." };
}

export async function generateJson<T>(
  schema: z.ZodType<T>,
  options: { system: string; prompt: string; timeoutMs?: number; signal?: AbortSignal; light?: boolean; temperature?: number; schemaNotes?: boolean },
): Promise<T> {
  const provider = process.env.LLM_PROVIDER ?? "gemini";
  if (provider !== "gemini") throw new LlmError(`LLM_PROVIDER "${provider}" is not supported yet`, "not_configured");

  // main model gets very few free requests a day, so light calls start on the lighter one
  const all = [...new Set(options.light ? [FALLBACK_MODEL, process.env.LLM_MODEL!] : [process.env.LLM_MODEL!, FALLBACK_MODEL])];
  // skip a model that was busy recently unless it's the only one left
  const models = all.filter((candidate) => (busyUntil.get(candidate) ?? 0) < Date.now());
  if (models.length === 0) models.push(all[all.length - 1]);
  let reply: { data: T } | undefined;
  let failure: LlmError | undefined; // why the last model gave nothing usable, none = busy or slow
  let lastError = "";
  const stopped = () => new LlmError("The research was stopped.", "failed");

  for (const model of models) {
    for (let attempt = 0; attempt < 2 && !reply; attempt++) {
      const release = await takeTurn();
      if (options.signal?.aborted) {
        release();
        throw stopped();
      }
      let wait: number | null = null;
      try {
        const timeout = AbortSignal.timeout(options.timeoutMs ?? 22_000);
        const response = await gemini().models.generateContent({
          model,
          contents: options.prompt,
          config: {
            systemInstruction: options.system,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchemaFor(schema, options.schemaNotes !== false),
            temperature: options.temperature ?? 0.3,
            // thinking makes answers slow, these are extraction tasks
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: options.signal ? AbortSignal.any([timeout, options.signal]) : timeout,
          },
        });
        const used = response.usageMetadata;
        console.log(`[llm] ${model}: ${used?.promptTokenCount ?? "?"} in, ${used?.totalTokenCount ?? "?"} total`);
        if (!response.text?.trim()) {
          // safety block or empty, the other model may answer
          failure = new LlmError("The AI returned an empty answer. Try rewording, or try again.", "bad_output");
          console.warn(`[llm] ${model} returned no text`);
          break;
        }
        const parsed = parseReply(schema, response.text);
        if ("problem" in parsed) {
          failure = new LlmError(parsed.problem, "bad_output");
          console.warn(`[llm] ${model} bad output: ${parsed.problem}`);
          break;
        }
        reply = parsed;
      } catch (err) {
        if (options.signal?.aborted) throw stopped();
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[llm] ${model} failed:`, lastError.replace(/\s+/g, " ").slice(0, 300));
        if (isBadRequest(err, lastError)) {
          console.error(`[llm] ${model} rejected the request (400):`, lastError.slice(0, 4000));
          failure = new LlmError("The AI couldn't process this request. Try again.", "failed");
          break;
        }
        if (!isBusy(lastError) && !isTimeout(err)) throw new LlmError("The AI request failed. Try again.", "failed");
        failure = undefined;
        wait = attempt === 0 ? retryWait(lastError) : null;
        if (wait === null && isOverloaded(lastError)) busyUntil.set(model, Date.now() + cooldownMs(lastError));
      } finally {
        release();
      }
      if (reply) break;
      if (wait === null) break;
      await sleep(wait, options.signal); // outside our turn so other calls keep moving
    }
    if (reply) break;
  }
  if (reply) return reply.data;
  throw failure ?? new LlmError("The free AI models are busy right now. Try again in a minute.", "rate_limited");
}
