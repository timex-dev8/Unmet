import sampleCards from "@/data/sample-cards.json";
import { CATEGORIES, type Card, type Category } from "./types";

// Stage 1: cards come from a sample file. Stage 2 swaps this module for Supabase;
// the screens only use these functions, so they won't change.
const cards = sampleCards as Card[];

export const PAGE_SIZE = 10;

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export type FeedFilter = Category | "Trending" | undefined;

export async function getCards({ filter, cursor = 0 }: { filter?: FeedFilter; cursor?: number } = {}) {
  let list = cards;
  if (filter === "Trending") list = list.filter((c) => c.trend === "rising");
  else if (filter) list = list.filter((c) => c.category === filter);
  const page = list.slice(cursor, cursor + PAGE_SIZE);
  const next = cursor + PAGE_SIZE < list.length ? cursor + PAGE_SIZE : null;
  return { cards: page, nextCursor: next, total: list.length };
}

export async function getCard(slug: string) {
  return cards.find((c) => c.slug === slug) ?? null;
}

export async function getAllSlugs() {
  return cards.map((c) => c.slug);
}

// Keyword search: every word must appear somewhere in the card's text.
export async function searchCards(query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return cards.filter((c) => {
    const text = [c.headline, c.summary, c.who, c.category, c.quote, ...c.aiSuggestions.map((s) => s.text)]
      .join(" ")
      .toLowerCase();
    return words.every((w) => text.includes(w));
  });
}
