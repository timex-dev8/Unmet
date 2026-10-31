import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod/v4";
import { generateJson, LlmError } from "@/lib/llm";
import { runResearch } from "@/lib/research";
import { DEDUPE_SYSTEM } from "@/lib/research/prompts";
import { publicCard } from "@/lib/research/store";
import type { ResearchEvent } from "@/lib/research-types";
import { db, supabaseConfigured } from "@/lib/supabase/server";
import type { Card } from "@/lib/types";
import { passesFeedBar } from "./bar";
import { SEED_TOPICS } from "./topics";

// The live feed: a daily job researches the most overdue niches (Medium depth) and keeps only
// problems that pass the feed bar. Research anyone runs can add to it too (cards hold only public
// sources, never who asked). Repeats are merged, so evidence grows instead of duplicating.

const STALE_DAYS = 30;
const DedupeSchema = z.object({ cards: z.array(z.object({ index: z.number().int(), duplicateOf: z.string() })) });

const warn = (what: string, err: unknown) => console.warn(`[feed] ${what}:`, err instanceof Error ? err.message : err);

/** Same problem: keep the old slug (shared links keep working) and pool the sources. */
function pool(card: Card, old: Card, now: string): Card {
  const base = card.sources.length >= old.sources.length ? card : old;
  const sources = [...new Map([...card.sources, ...old.sources].map((s) => [s.url, s])).values()].slice(0, 14);
  return { ...base, slug: old.slug, sources, evidence: { ...base.evidence, threads: sources.length, updatedAt: now } };
}

/**
 * Adds the cards that pass the bar; merges each into an existing card when it's the same problem.
 * `topic` is stored publicly, so it must never be someone's own question. Cards lose `query` (what
 * was searched) unless `keepQuery` says it's one of Unmet's own niches.
 */
export async function addToFeed(cards: Card[], topic: string, opts: { keepQuery?: boolean } = {}): Promise<number> {
  if (!supabaseConfigured()) return 0;
  const fresh = cards.filter((c) => passesFeedBar(c));
  if (!fresh.length) return 0;

  const categories = [...new Set(fresh.map((c) => c.category))];
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
  const known = new Map(existing.map((r) => [r.slug as string, r.card as Card]));

  let dupes: Map<number, string> = new Map();
  if (known.size) {
    const out = await generateJson(DedupeSchema, {
      system: DEDUPE_SYSTEM,
      timeoutMs: 25_000,
      prompt: `New cards:\n${fresh.map((c, i) => `${i} | ${c.headline} | ${c.who}`).join("\n")}\n\nExisting cards:\n${[...known.values()]
        .map((c) => `${c.slug} | ${c.headline} | ${c.who}`)
        .join("\n")}`,
    }).catch((err) => {
      warn("dedupe", err);
      return { cards: [] };
    });
    dupes = new Map(out.cards.filter((d) => known.has(d.duplicateOf)).map((d) => [d.index, d.duplicateOf]));
  }

  // Group by the slug each card lands on: two new cards can be the same existing problem, and one
  // upsert can't write the same slug twice.
  const now = new Date().toISOString();
  const bySlug = new Map<string, Card>();
  fresh.forEach((card, i) => {
    const target = dupes.get(i) ?? card.slug;
    const old = bySlug.get(target) ?? known.get(target);
    bySlug.set(target, old ? pool(card, old, now) : card);
  });
  const rows = [...bySlug.values()].map((card) => ({
    slug: card.slug,
    card: opts.keepQuery ? card : publicCard(card),
    topic,
    category: card.category,
    score: card.scores.demand.value,
    updated_at: now,
  }));
  const { error: upsertError } = await db().from("feed_cards").upsert(rows);
  if (upsertError) {
    warn("write", upsertError);
    return 0;
  }
  return rows.length;
}

/** The niches researched least recently (seed list + niches people watch). */
async function pickTopics(n: number) {
  await db()
    .from("feed_topics")
    .upsert(
      SEED_TOPICS.map((topic) => ({ topic, origin: "seed" })),
      { onConflict: "topic", ignoreDuplicates: true },
    );
  const { data, error } = await db().from("feed_topics").select("topic").order("last_run", { ascending: true, nullsFirst: true }).limit(n);
  if (error) throw error;
  return data.map((r) => r.topic as string);
}

async function researchTopic(topic: string) {
  const cards: Card[] = [];
  await runResearch({ message: `What problems do ${topic} complain about?`, history: [], cards: [], depth: "medium" }, (e: ResearchEvent) => {
    if (e.type === "result") cards.push(...e.cards);
  });
  return addToFeed(cards, topic, { keepQuery: true }); // Unmet's own niche, not anyone's question
}

/**
 * One feed run: researches up to `max` niches one at a time (two at once overloads the free AI
 * tier), and stops starting new ones near the time limit. Then drops cards with no new evidence in 30 days.
 */
export async function runFeed({ max, deadline }: { max: number; deadline: number }) {
  if (!supabaseConfigured()) throw new Error("Supabase isn't connected.");
  const topics = await pickTopics(max);
  const report: { topic: string; added: number; error?: string }[] = [];
  for (const topic of topics) {
    if (Date.now() >= deadline) break;
    let added = 0;
    try {
      added = await researchTopic(topic).catch(async (err) => {
        // The AI was busy: wait a little and try this niche once more, if there's time
        const busy = (err instanceof LlmError && err.code === "rate_limited") || /busy/i.test(String(err));
        if (!busy || Date.now() + 90_000 > deadline) throw err;
        await new Promise((r) => setTimeout(r, 20_000));
        return researchTopic(topic);
      });
      report.push({ topic, added });
    } catch (err) {
      report.push({ topic, added: 0, error: err instanceof Error ? err.message : String(err) });
    }
    // Marked as run even when it failed, so a broken niche waits its turn instead of going first every run.
    await db().from("feed_topics").update({ last_run: new Date().toISOString(), cards_found: added }).eq("topic", topic);
  }
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
  await db().from("feed_cards").delete().lt("updated_at", cutoff);
  return report;
}

/** Live feed cards, best first. Cached for days (tag "feed"; the feed job revalidates it). */
export async function readFeed(opts: { category?: string; rising?: boolean; limit?: number } = {}): Promise<Card[]> {
  "use cache";
  cacheLife("days");
  cacheTag("feed");
  if (!supabaseConfigured()) return [];
  let q = db().from("feed_cards").select("card").order("score", { ascending: false }).order("updated_at", { ascending: false });
  if (opts.category) q = q.eq("category", opts.category);
  const { data, error } = await q.limit(opts.limit ?? 120);
  if (error) {
    warn("read feed", error);
    return [];
  }
  const cards = data.map((r) => r.card as Card);
  return opts.rising ? cards.filter((c) => c.trend === "rising") : cards;
}

export async function readFeedCard(slug: string): Promise<Card | null> {
  "use cache";
  cacheLife("days");
  cacheTag("feed");
  if (!supabaseConfigured()) return null;
  const { data } = await db().from("feed_cards").select("card").eq("slug", slug).maybeSingle();
  return (data?.card as Card | undefined) ?? null;
}
