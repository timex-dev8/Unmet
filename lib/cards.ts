import sampleCards from "@/data/sample-cards.json";
import { readFeed, readFeedCard } from "./feed";
import { CATEGORIES, type Card, type Category } from "./types";

// live feed from supabase, topped up with sample cards until there are enough real ones
const samples = sampleCards as Card[];
const ENOUGH_LIVE = 30;

const PAGE_SIZE = 30;

async function allCards(options: { category?: string; rising?: boolean } = {}) {
  const live = await readFeed(options);
  if (live.length >= ENOUGH_LIVE) return live;
  let fill = samples;
  if (options.rising) fill = fill.filter((card) => card.trend === "rising");
  else if (options.category) fill = fill.filter((card) => card.category === options.category);
  return [...live, ...fill];
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export type FeedFilter = Category | "Trending" | undefined;

export async function getCards({ filter, cursor = 0 }: { filter?: FeedFilter; cursor?: number } = {}) {
  const list = await allCards(filter === "Trending" ? { rising: true } : filter ? { category: filter } : {});
  const page = list.slice(cursor, cursor + PAGE_SIZE);
  const next = cursor + PAGE_SIZE < list.length ? cursor + PAGE_SIZE : null;
  return { cards: page, nextCursor: next, total: list.length };
}

export async function getAllCards() {
  return allCards();
}

export async function getCard(slug: string) {
  return samples.find((card) => card.slug === slug) ?? (await readFeedCard(slug));
}

export async function getAllSlugs() {
  return samples.map((card) => card.slug);
}

export async function searchCards(query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return (await allCards()).filter((card) => {
    const text = [card.headline, card.summary, card.who, card.category, card.quote, ...card.aiSuggestions.map((suggestion) => suggestion.text)]
      .join(" ")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
