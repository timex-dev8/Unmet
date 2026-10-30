import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod/v4";
import { generateJson } from "@/lib/llm";
import { runResearch } from "@/lib/research";
import { DEDUPE_SYSTEM } from "@/lib/research/prompts";
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

/** Adds the cards that pass the bar; merges each into an existing card when it's the same problem. */
export async function addToFeed(cards: Card[], topic: string): Promise<number> {
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

  const now = new Date().toISOString();
  const rows = fresh.map((card, i) => {
    const into = dupes.get(i);
    const old = into ? known.get(into) : undefined;
    // Same problem: keep the old slug (shared links keep working) and pool the sources.
    const merged: Card = old
      ? (() => {
          const base = card.sources.length >= old.sources.length ? card : old;
          const sources = [...new Map([...card.sources, ...old.sources].map((s) => [s.url, s])).values()].slice(0, 14);
          return { ...base, slug: old.slug, sources, evidence: { ...base.evidence, threads: sources.length, updatedAt: now } };
        })()
      : card;
    return { slug: merged.slug, card: merged, topic, category: merged.category, score: merged.scores.demand.value, updated_at: now };
  });
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
  return addToFeed(cards, topic);
}

/**
 * One feed run: researches up to `max` niches, two at a time, and stops starting new ones near the
 * time limit. Then drops cards with no new evidence in 30 days.
 */
export async function runFeed({ max, deadline }: { max: number; deadline: number }) {
  if (!supabaseConfigured()) throw new Error("Supabase isn't connected.");
  const topics = await pickTopics(max);
  const report: { topic: string; added: number; error?: string }[] = [];
  let next = 0;
  await Promise.all(
    [0, 1].map(async () => {
      while (next < topics.length && Date.now() < deadline) {
        const topic = topics[next++];
        try {
          const added = await researchTopic(topic);
          report.push({ topic, added });
          await db().from("feed_topics").update({ last_run: new Date().toISOString(), cards_found: added }).eq("topic", topic);
        } catch (err) {
          report.push({ topic, added: 0, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }),
  );
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
  await db().from("feed_cards").delete().lt("updated_at", cutoff);
  return report;
}

/** Live feed cards, best first. Cached for a few minutes (tag "feed"; the feed job refreshes it). */
export async function readFeed(opts: { category?: string; rising?: boolean; limit?: number } = {}): Promise<Card[]> {
  "use cache";
  cacheLife("minutes");
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
  cacheLife("minutes");
  cacheTag("feed");
  if (!supabaseConfigured()) return null;
  const { data } = await db().from("feed_cards").select("card").eq("slug", slug).maybeSingle();
  return (data?.card as Card | undefined) ?? null;
}
