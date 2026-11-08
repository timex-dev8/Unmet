import type { Card, Category } from "./types";

type RankSignals = { picked: Category[]; skipped: string[]; saved: Card[]; keywords?: string[] };

type RankCard = Pick<Card, "slug" | "headline" | "summary" | "who" | "category" | "trend"> & { scores: { demand: { value: number } } };

export function profileKeywords(interests: { profile?: { keywords: string[]; audiences: string[]; niches: string[] }; watched?: string[] }) {
  const phrases = [
    ...(interests.profile?.keywords ?? []),
    ...(interests.profile?.audiences ?? []),
    ...(interests.profile?.niches ?? []),
    ...(interests.watched ?? []),
  ];
  return [...new Set(phrases.flatMap((phrase) => phrase.toLowerCase().split(/[^a-z0-9]+/)).filter((word) => word.length > 3))];
}

export function textMatch(card: Pick<Card, "headline" | "summary" | "who">, keywords: string[]) {
  if (!keywords.length) return 0;
  const text = `${card.headline} ${card.summary} ${card.who}`.toLowerCase();
  return Math.min(keywords.filter((keyword) => text.includes(keyword)).length, 3);
}

export function forYou<T extends RankCard>(cards: T[], { picked, skipped, saved, keywords = [] }: RankSignals, limit = 3) {
  const savedSlugs = new Set(saved.map((savedCard) => savedCard.slug));
  const savedByCategory = new Map<string, number>();
  for (const savedCard of saved) savedByCategory.set(savedCard.category, (savedByCategory.get(savedCard.category) ?? 0) + 1);

  return cards
    .filter((card) => !savedSlugs.has(card.slug))
    .map((card) => ({
      card,
      score:
        (picked.includes(card.category) ? 3 : 0) +
        textMatch(card, keywords) * 2 +
        Math.min(savedByCategory.get(card.category) ?? 0, 3) +
        (card.trend === "rising" ? 1 : 0) +
        card.scores.demand.value / 50 -
        (skipped.includes(card.slug) ? 4 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((ranked) => ranked.card);
}

export function growth(card: Card) {
  const weekly = card.evidence.weekly;
  if (weekly.length < 6) return 0;
  const early = weekly.slice(0, 3).reduce((sum, count) => sum + count, 0);
  const late = weekly.slice(-3).reduce((sum, count) => sum + count, 0);
  return Math.round(((late - early) / Math.max(early, 1)) * 100);
}

export function rising(cards: Card[], limit = 4) {
  return cards
    .map((card) => ({ card, growth: growth(card) }))
    .filter((entry) => entry.growth > 0)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, limit);
}
