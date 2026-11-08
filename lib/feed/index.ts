import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod/v4";
import { generateJson, LlmError } from "@/lib/llm";
import { fence } from "@/lib/research/extract";
import { runResearch } from "@/lib/research";
import { DEDUPE_SYSTEM } from "@/lib/research/prompts";
import { publicCard } from "@/lib/research/store";
import type { ResearchEvent } from "@/lib/research-types";
import { db, supabaseConfigured } from "@/lib/supabase/server";
import type { Card } from "@/lib/types";
import { passesFeedBar } from "./bar";
import { SEED_TOPICS } from "./topics";

// daily job researches the most overdue niches (High) and keeps problems that pass the feed bar. cards only hold public sources, never who asked. repeats merge

const STALE_DAYS = 30;
const DedupeSchema = z.object({ cards: z.array(z.object({ index: z.number().int().min(0).max(999), duplicateOf: z.string() })) });

const warn = (what: string, err: unknown) => console.warn(`[feed] ${what}:`, err instanceof Error ? err.message : err);

function pool(card: Card, existing: Card, now: string): Card {
  const base = card.sources.length >= existing.sources.length ? card : existing;
  // base card's sources first so the cut can't drop the one behind its quote
  const other = base === card ? existing : card;
  const sources = [...new Map([...base.sources, ...other.sources].map((source) => [source.url, source])).values()].slice(0, 14);
  return { ...base, slug: existing.slug, sources, evidence: { ...base.evidence, threads: sources.length, updatedAt: now } };
}

// topic is stored publicly so never someone's own question. query is dropped unless keepQuery (an Unmet niche)
export async function addToFeed(
  cards: Card[],
  topic: string,
  options: { keepQuery?: boolean; light?: boolean; signal?: AbortSignal } = {},
): Promise<number> {
  if (!supabaseConfigured()) return 0;
  const fresh = cards.filter((card) => passesFeedBar(card));
  if (!fresh.length) return 0;

  const categories = [...new Set(fresh.map((card) => card.category))];
  const { data: existing, error } = await db()
    .from("feed_cards")
    .select("slug, card")
    .in("category", categories)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) {
    warn("read", error);
    return 0;
  }
  const known = new Map(existing.map((row) => [row.slug as string, row.card as Card]));

  let dupes: Map<number, string> = new Map();
  if (known.size) {
    const response = await generateJson(DedupeSchema, {
      system: DEDUPE_SYSTEM,
      timeoutMs: 25_000,
      light: options.light,
      signal: options.signal,
      prompt: `New cards:\n${fresh.map((card, i) => `${i} | <card>${fence(`${card.headline} | ${card.who}`)}</card>`).join("\n")}\n\nExisting cards:\n${[
        ...known.values(),
      ]
        .map((card) => `${card.slug} | <card>${fence(`${card.headline} | ${card.who}`)}</card>`)
        .join("\n")}`,
    }).catch((err) => {
      if (options.signal?.aborted) throw err; // out of time, saving unchecked cards would add repeats
      warn("dedupe", err);
      return { cards: [] };
    });
    dupes = new Map(response.cards.filter((entry) => known.has(entry.duplicateOf)).map((entry) => [entry.index, entry.duplicateOf]));
  }

  // group by landing slug, two new cards can be one existing problem and one upsert can't write a slug twice
  const now = new Date().toISOString();
  const bySlug = new Map<string, Card>();
  fresh.forEach((card, i) => {
    const target = dupes.get(i) ?? card.slug;
    const existingCard = bySlug.get(target) ?? known.get(target);
    bySlug.set(target, existingCard ? pool(card, existingCard, now) : card);
  });
  const rows = [...bySlug.values()].map((card) => ({
    slug: card.slug,
    card: options.keepQuery ? card : publicCard(card),
    topic,
    category: card.category,
    score: card.scores.demand.value - (card.signal === "early" ? 30 : 0), // early signals rank below proven ones
    updated_at: now,
  }));
  const { error: upsertError } = await db().from("feed_cards").upsert(rows);
  if (upsertError) {
    warn("write", upsertError);
    return 0;
  }
  return rows.length;
}

async function pickTopics(limit: number) {
  await db()
    .from("feed_topics")
    .upsert(
      SEED_TOPICS.map((topic) => ({ topic, origin: "seed" })),
      { onConflict: "topic", ignoreDuplicates: true },
    );
  const { data, error } = await db()
    .from("feed_topics")
    .select("topic, origin")
    .order("last_run", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({ topic: row.topic as string, seed: row.origin === "seed" }));
}

async function researchTopic(topic: string, seed: boolean, signal?: AbortSignal) {
  const cards: Card[] = [];
  await runResearch(
    { message: `What problems do ${topic} complain about?`, history: [], cards: [], depth: "high" },
    (event: ResearchEvent) => {
      if (event.type === "result") cards.push(...event.cards);
    },
    signal,
    false,
    true,
  );
  // a watched niche is that person's topic, only seed niches are stored by name
  const stored = seed ? topic : (cards[0]?.category || "research").slice(0, 80);
  return addToFeed(cards, stored, { keepQuery: seed, light: true, signal });
}

// niches one at a time (two at once overloads the free tier), stop starting new ones near the time limit, signal cuts the current one. then drops cards with no new evidence in 30 days
export async function runFeed({ max, deadline, signal }: { max: number; deadline: number; signal?: AbortSignal }) {
  if (!supabaseConfigured()) throw new Error("Supabase isn't connected.");
  const topics = await pickTopics(max);
  const report: { topic: string; added: number; error?: string }[] = [];
  for (const { topic, seed } of topics) {
    if (Date.now() >= deadline || signal?.aborted) break;
    let added = 0;
    try {
      added = await researchTopic(topic, seed, signal).catch(async (err) => {
        // ai busy, wait and retry once if there is time
        const busy = (err instanceof LlmError && err.code === "rate_limited") || /busy/i.test(String(err));
        if (!busy || Date.now() + 90_000 > deadline) throw err;
        await new Promise((resolve) => setTimeout(resolve, 20_000));
        return researchTopic(topic, seed, signal);
      });
      report.push({ topic, added });
    } catch (err) {
      report.push({ topic, added: 0, error: err instanceof Error ? err.message : String(err) });
    }
    // marked as run even on failure so a broken niche doesn't go first every run
    await db().from("feed_topics").update({ last_run: new Date().toISOString(), cards_found: added }).eq("topic", topic);
  }
  if (report.some((entry) => !entry.error)) {
    const cutoff = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
    await db().from("feed_cards").delete().lt("updated_at", cutoff);
  }
  return report;
}

// demand minus points per day since new evidence, so fresh cards reach the top
function freshScore(row: { score: number; updated_at: string }, now: number) {
  const days = Math.max(0, now - new Date(row.updated_at).getTime()) / 86400_000;
  return row.score - Math.min(60, days * 12);
}

// older cards collected HN sources on non-developer topics, hide them
function withoutOffTopicHn(card: Card): Card {
  if (card.category === "Dev tools") return card;
  const sources = card.sources.filter((source) => source.kind !== "hn");
  if (!sources.length || sources.length === card.sources.length) return card;
  const report = card.report && {
    ...card.report,
    reasons: card.report.reasons.map((reason) => (/^\d+ independent sources$/.test(reason) ? `${sources.length} independent sources` : reason)),
  };
  return { ...card, sources, report, evidence: { ...card.evidence, threads: sources.length } };
}

export async function readFeed(options: { category?: string; rising?: boolean; limit?: number } = {}): Promise<Card[]> {
  "use cache";
  cacheLife("days");
  cacheTag("feed");
  if (!supabaseConfigured()) return [];
  let query = db()
    .from("feed_cards")
    .select("card, score, updated_at")
    .order("score", { ascending: false })
    .order("updated_at", { ascending: false });
  if (options.category) query = query.eq("category", options.category);
  const { data, error } = await query.limit(options.limit ?? 120);
  if (error) {
    warn("read feed", error);
    return [];
  }
  const now = Date.now();
  const cards = [...data].sort((a, b) => freshScore(b, now) - freshScore(a, now)).map((row) => withoutOffTopicHn(row.card as Card));
  return options.rising ? cards.filter((card) => card.trend === "rising") : cards;
}

export async function readFeedCard(slug: string): Promise<Card | null> {
  "use cache";
  cacheLife("days");
  cacheTag("feed");
  if (!supabaseConfigured()) return null;
  const { data } = await db().from("feed_cards").select("card").eq("slug", slug).maybeSingle();
  return (data?.card as Card | undefined) ?? null;
}
