import { z } from "zod/v4";
import { exaConfigured } from "@/lib/exa";
import { LlmError, llmConfigured } from "@/lib/llm";
import { runResearch } from "@/lib/research";
import type { ResearchEvent } from "@/lib/research-types";

// High mode runs several AI steps and searches; Vercel Hobby with Fluid compute allows up to 300s.
export const maxDuration = 300;

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
  depth: z.enum(["low", "medium", "high"]).default("medium"),
});

// High mode costs about three normal researches, so it counts as three.
const COST = { low: 1, medium: 1, high: 3 } as const;

// Simple in-memory limits to protect the free tiers (per server instance; good enough for the demo).
const PER_HOUR = 6;
const hits = new Map<string, number[]>();
let day = new Date().toDateString();
let todayCount = 0;

function limited(ip: string, cost: number) {
  const today = new Date().toDateString();
  if (today !== day) {
    day = today;
    todayCount = 0;
  }
  const cap = Number(process.env.RESEARCH_DAILY_CAP ?? 50);
  if (todayCount + cost > cap) return "Unmet has reached today's research limit. Try again tomorrow.";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length + cost > PER_HOUR)
    return cost > 1 ? "Not enough research left this hour for High. Try Medium, or wait a bit." : "You've used this hour's research. Try again a bit later.";
  hits.set(ip, [...recent, ...Array(cost).fill(now)]);
  todayCount += cost;
  return null;
}

export async function POST(request: Request) {
  if (!llmConfigured() || !exaConfigured()) {
    return Response.json({ error: "Research isn't set up yet: the AI and search keys are missing." }, { status: 503 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please type a question between 2 and 500 characters." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const blocked = limited(ip, COST[parsed.data.depth]);
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
