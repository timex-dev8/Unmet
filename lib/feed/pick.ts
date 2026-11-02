import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod/v4";
import { generateJson, llmConfigured } from "@/lib/llm";
import { AI_PICK_SYSTEM } from "@/lib/research/prompts";
import type { Card } from "@/lib/types";

const PickSchema = z.object({ slug: z.string(), why: z.string() });

type Compact = {
  slug: string;
  headline: string;
  summary: string;
  who: string;
  verdict: string;
  sources: number;
  pays: number;
  switching: number;
  competition: string;
};

export function compactCards(cards: Card[]): Compact[] {
  return cards.slice(0, 20).map((c) => ({
    slug: c.slug,
    headline: c.headline,
    summary: c.summary,
    who: c.who,
    verdict: c.report?.verdict ?? "unknown",
    sources: c.sources.length,
    pays: c.report?.signals.pays ?? 0,
    switching: c.report?.signals.switching ?? 0,
    competition: c.scores.competition.label,
  }));
}

/** The one problem worth building this week, chosen by the model from the top 20 cards. Cached for hours, so visitors share one call. Null when unavailable. */
export async function getAiPick(cards: Card[]): Promise<{ slug: string; why: string } | null> {
  const list = compactCards(cards);
  if (!list.length || !llmConfigured()) return null;
  return pick(list);
}

// The cache key is the compact list (its slugs and data), not the visitor. A failure caches as null for the same few hours,
// which also keeps a quota-limited model from being hit again per visitor.
async function pick(list: Compact[]): Promise<{ slug: string; why: string } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("feed");
  try {
    const r = await generateJson(PickSchema, { system: AI_PICK_SYSTEM, prompt: JSON.stringify(list), light: true, timeoutMs: 20000 });
    const why = r.why.trim();
    if (!why || !list.some((c) => c.slug === r.slug)) return null;
    return { slug: r.slug, why };
  } catch {
    return null;
  }
}
