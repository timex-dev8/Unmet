import { after } from "next/server";
import { z } from "zod/v4";
import { addToFeed } from "@/lib/feed";
import { exaConfigured } from "@/lib/exa";
import { LlmError, llmConfigured } from "@/lib/llm";
import { runResearch } from "@/lib/research";
import { recordHit, usage, visitorId } from "@/lib/research/store";
import { db, supabaseConfigured } from "@/lib/supabase/server";
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

// Limits that protect the free tiers: 6 per visitor per hour, RESEARCH_DAILY_CAP for everyone per day.
// Counted in Supabase, so they hold across server restarts (lib/research/store.ts).
const PER_HOUR = 6;

async function limited(ip: string, cost: number) {
  const visitor = visitorId(ip);
  const used = await usage(visitor);
  const cap = Number(process.env.RESEARCH_DAILY_CAP ?? 50);
  if (used.today + cost > cap) return "Unmet has reached today's research limit. Try again tomorrow.";
  if (used.hour + cost > PER_HOUR)
    return cost > 1 ? "Not enough research left this hour for High. Try Medium, or wait a bit." : "You've used this hour's research. Try again a bit later.";
  await recordHit(visitor, cost);
  return null;
}

export async function POST(request: Request) {
  if (!llmConfigured() || !exaConfigured()) {
    return Response.json({ error: "Research isn't set up yet: the AI and search keys are missing." }, { status: 503 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please type a question between 2 and 500 characters." }, { status: 400 });

  // Guests (no account) can use everything except deeper research: Medium and High need an account.
  if (parsed.data.depth !== "low" && supabaseConfigured()) {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const { data } = token ? await db().auth.getUser(token) : { data: { user: null } };
    if (!data.user) return Response.json({ error: "Medium and High research need a free account. Sign in, or use Low." }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const blocked = await limited(ip, COST[parsed.data.depth]);
  if (blocked) return Response.json({ error: blocked }, { status: 429 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const found: ResearchEvent[] = [];
      const emit = (e: ResearchEvent) => {
        if (e.type === "result" && !e.cached) found.push(e);
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      };
      try {
        await runResearch(parsed.data, emit);
        // Problems strong enough for everyone's feed are added after the answer is sent
        // (cards hold only public sources, never who asked).
        const cards = found.flatMap((e) => (e.type === "result" ? e.cards : []));
        if (cards.length) after(() => addToFeed(cards, parsed.data.message.slice(0, 80)).catch(() => 0));
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
