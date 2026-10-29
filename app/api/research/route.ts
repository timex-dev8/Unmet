import { z } from "zod/v4";
import { exaConfigured } from "@/lib/exa";
import { LlmError, llmConfigured } from "@/lib/llm";
import { runResearch } from "@/lib/research";
import type { ResearchEvent } from "@/lib/research-types";

// Two AI calls (each may retry on a fallback model) plus web search.
export const maxDuration = 120;

const Body = z.object({
  message: z.string().trim().min(2).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
    .max(12)
    .default([]),
  cards: z
    .array(z.object({ slug: z.string(), headline: z.string().max(200), summary: z.string().max(600) }))
    .max(12)
    .default([]),
  includeReddit: z.boolean().default(false),
});

// Simple in-memory limits to protect the free tiers (per server instance; good enough for the demo).
const PER_HOUR = 5;
const hits = new Map<string, number[]>();
let day = new Date().toDateString();
let todayCount = 0;

function limited(ip: string) {
  const today = new Date().toDateString();
  if (today !== day) {
    day = today;
    todayCount = 0;
  }
  const cap = Number(process.env.RESEARCH_DAILY_CAP ?? 50);
  if (todayCount >= cap) return "Unmet has reached today's research limit. Try again tomorrow.";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= PER_HOUR) return "You've run 5 researches this hour. Try again a bit later.";
  hits.set(ip, [...recent, now]);
  todayCount++;
  return null;
}

export async function POST(request: Request) {
  if (!llmConfigured() || !exaConfigured()) {
    return Response.json({ error: "Research isn't set up yet: the AI and search keys are missing." }, { status: 503 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please type a question between 2 and 500 characters." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const blocked = limited(ip);
  if (blocked) return Response.json({ error: blocked }, { status: 429 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: ResearchEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runResearch(parsed.data, emit);
      } catch (err) {
        const message =
          err instanceof LlmError || err instanceof Error ? err.message : "Something went wrong. Please try again.";
        console.error("[research]", err);
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
