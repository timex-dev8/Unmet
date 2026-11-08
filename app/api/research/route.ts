import { after } from "next/server";
import { z } from "zod/v4";
import { addToFeed } from "@/lib/feed";
import { exaConfigured } from "@/lib/exa";
import { LlmError, llmConfigured } from "@/lib/llm";
import { clientIp, visitorId } from "@/lib/rate-limit";
import { peekCached, runResearch } from "@/lib/research";
import { takeMemorySlot, takeResearchSlot, type SlotRequest } from "@/lib/research/store";
import { accountsConfigured, requestUser } from "@/lib/supabase/server";
import type { Depth, ResearchEvent } from "@/lib/research-types";

// hobby with fluid compute caps at 300s
export const maxDuration = 300;

// ai text is cut, not refused, so a long one never breaks a follow up
const cut = (maxLength: number) => z.string().transform((text) => text.slice(0, maxLength));

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

const COST = { low: 1, medium: 1, high: 3 } as const;

// guests 6/hr (accounts 12) plus a daily cap for all guests, accounts get their own bucket
const PER_HOUR = 6;
const USER_HOUR = 12;
const GUEST_DAY = 15;
const USER_DAY = Number(process.env.RESEARCH_USER_DAILY_CAP ?? 60);

async function limited(visitor: string, isUser: boolean, depth: Depth) {
  const cost = COST[depth];
  const slot: SlotRequest = {
    visitor,
    isUser,
    cost,
    hourLimit: isUser ? USER_HOUR : PER_HOUR,
    dayLimit: isUser ? USER_DAY : GUEST_DAY,
    globalDayLimit: isUser ? Number(process.env.RESEARCH_USERS_DAILY_CAP ?? 600) : Number(process.env.RESEARCH_DAILY_CAP ?? 50),
  };
  let allowed = await takeResearchSlot(slot);
  if (allowed === null) {
    // cant check the limit: no costly depths
    if (depth !== "low") return "Deeper research is paused for a moment. Try Quick, or again in a minute.";
    allowed = takeMemorySlot(slot);
  }
  if (allowed) return null;
  return cost > 1
    ? "Not enough research left right now for Deepest. Try Deep, or wait a bit."
    : "You've used your research for now. Try again a bit later.";
}

export async function POST(request: Request) {
  if (!llmConfigured() || !exaConfigured()) {
    return Response.json({ error: "Research isn't set up yet: the AI and search keys are missing." }, { status: 503 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please type a question between 2 and 800 characters." }, { status: 400 });
  const { depth } = parsed.data;

  // medium and high need an account, stay closed if the token cant be verified
  const user = await requestUser(request);
  if (depth !== "low" && accountsConfigured() && !user) {
    return Response.json({ error: "Deep and Deepest research need a free account. Sign in, or use Quick." }, { status: 403 });
  }

  // saved answers dont cost a slot
  const saved = await peekCached(parsed.data).catch(() => null);
  if (saved)
    return new Response(JSON.stringify({ ...saved, cached: true }) + "\n", {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
    });

  const blocked = await limited(user ? `u:${user.id}` : visitorId(clientIp(request)), Boolean(user), depth);
  if (blocked) return Response.json({ error: blocked }, { status: 429 });

  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const found: ResearchEvent[] = [];
      const emit = (event: ResearchEvent) => {
        if (abort.signal.aborted) return;
        if (event.type === "result" && !event.cached) found.push(event);
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await runResearch(parsed.data, emit, abort.signal);
        // feed gets the category as topic, never anything from the persons message
        const cards = found.flatMap((event) => (event.type === "result" ? event.cards : []));
        const topic = (cards[0]?.category || "research").slice(0, 80);
        if (cards.length) after(() => addToFeed(cards, topic).catch(() => 0));
      } catch (err) {
        if (abort.signal.aborted) {
          console.log("[research] stopped: the visitor left");
        } else {
          const busy = err instanceof LlmError && err.code === "rate_limited";
          const message = busy ? "The AI is busy right now. Please try again in a minute." : "Something went wrong. Please try again.";
          console.error("[research]", err);
          emit({ type: "error", message });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // browser already cancelled
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
