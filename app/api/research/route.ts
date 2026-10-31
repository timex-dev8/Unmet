import { after } from "next/server";
import { z } from "zod/v4";
import { addToFeed } from "@/lib/feed";
import { exaConfigured } from "@/lib/exa";
import { LlmError, llmConfigured } from "@/lib/llm";
import { clientIp, visitorId } from "@/lib/rate-limit";
import { runResearch } from "@/lib/research";
import { takeMemorySlot, takeResearchSlot, type SlotRequest } from "@/lib/research/store";
import { accountsConfigured, requestUser } from "@/lib/supabase/server";
import type { Depth, ResearchEvent } from "@/lib/research-types";

// High mode runs several AI steps and searches; Vercel Hobby with Fluid compute allows up to 300s.
export const maxDuration = 300;

// AI-written text (card headlines and summaries from earlier answers) is cut to size rather than
// refused, so a long one never breaks a follow-up. The person's own message is still checked.
const cut = (n: number) => z.string().transform((s) => s.slice(0, n));

const Body = z.object({
  message: z.string().trim().min(2).max(800),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: cut(2000) }))
    .max(12)
    .default([]),
  cards: z
    .array(z.object({ slug: cut(120), headline: cut(200), summary: cut(600) }))
    .max(12)
    .default([]),
  depth: z.enum(["low", "medium", "high"]).default("medium"),
});

// High mode costs about three normal researches, so it counts as three.
const COST = { low: 1, medium: 1, high: 3 } as const;

// Limits that protect the free tiers, counted in Supabase (take_research_slot in supabase/schema.sql).
// Guests: 6 per hour each, and RESEARCH_DAILY_CAP for all guests together per day.
// Accounts: their own bucket, so guests can't use up the day for them.
const PER_HOUR = 6;
const GUEST_DAY = 15;
const USER_DAY = Number(process.env.RESEARCH_USER_DAILY_CAP ?? 30);

async function limited(visitor: string, isUser: boolean, depth: Depth) {
  const cost = COST[depth];
  const slot: SlotRequest = {
    visitor,
    isUser,
    cost,
    hourLimit: PER_HOUR,
    dayLimit: isUser ? USER_DAY : GUEST_DAY,
    globalDayLimit: isUser ? Number(process.env.RESEARCH_USERS_DAILY_CAP ?? 300) : Number(process.env.RESEARCH_DAILY_CAP ?? 50),
  };
  let ok = await takeResearchSlot(slot);
  if (ok === null) {
    // The limit couldn't be checked: never open the costly depths; Low only within this server's own count.
    if (depth !== "low") return "Deeper research is paused for a moment. Try Low, or again in a minute.";
    ok = takeMemorySlot(slot);
  }
  if (ok) return null;
  return cost > 1
    ? "Not enough research left right now for High. Try Medium, or wait a bit."
    : "You've used your research for now. Try again a bit later.";
}

export async function POST(request: Request) {
  if (!llmConfigured() || !exaConfigured()) {
    return Response.json({ error: "Research isn't set up yet: the AI and search keys are missing." }, { status: 503 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please type a question between 2 and 800 characters." }, { status: 400 });
  const { depth } = parsed.data;

  // Guests (no account) can use everything except deeper research: Medium and High need an account.
  // When accounts exist but the token can't be verified (no service key, auth down), they stay closed.
  const user = await requestUser(request);
  if (depth !== "low" && accountsConfigured() && !user) {
    return Response.json({ error: "Medium and High research need a free account. Sign in, or use Low." }, { status: 403 });
  }

  const blocked = await limited(user ? `u:${user.id}` : visitorId(clientIp(request)), Boolean(user), depth);
  if (blocked) return Response.json({ error: blocked }, { status: 429 });

  // Closing the tab cancels the stream; the research stops instead of spending on an answer nobody reads.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const found: ResearchEvent[] = [];
      const emit = (e: ResearchEvent) => {
        if (abort.signal.aborted) return;
        if (e.type === "result" && !e.cached) found.push(e);
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      };
      try {
        await runResearch(parsed.data, emit, abort.signal);
        // Problems strong enough for everyone's feed are added after the answer is sent. Cards hold
        // only public sources; the feed gets the planner's short topic (or the category), never the message.
        const cards = found.flatMap((e) => (e.type === "result" ? e.cards : []));
        const topic = (cards[0]?.query || cards[0]?.category || "research").slice(0, 80);
        if (cards.length) after(() => addToFeed(cards, topic).catch(() => 0));
      } catch (err) {
        if (abort.signal.aborted) {
          console.log("[research] stopped: the visitor left");
        } else {
          const message = err instanceof LlmError || err instanceof Error ? err.message : "Something went wrong. Please try again.";
          console.error("[research]", err);
          emit({ type: "error", message });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already cancelled by the browser
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
