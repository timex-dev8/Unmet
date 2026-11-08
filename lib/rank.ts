import type { Card, Category } from "./types";

type RankSignals = { picked: Category[]; skipped: string[]; saved: Card[]; keywords?: string[] };

type RankCard = Pick<Card, "slug" | "headline" | "summary" | "who" | "category" | "trend"> & { scores: { demand: { value: number } } };

export function profileKeywords(i: { profile?: { keywords: string[]; audiences: string[]; niches: string[] }; watched?: string[] }) {
  const phrases = [...(i.profile?.keywords ?? []), ...(i.profile?.audiences ?? []), ...(i.profile?.niches ?? []), ...(i.watched ?? [])];
  return [...new Set(phrases.flatMap((p) => p.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length > 3))];
}

export function textMatch(card: Pick<Card, "headline" | "summary" | "who">, keywords: string[]) {
  if (!keywords.length) return 0;
  const text = `${card.headline} ${card.summary} ${card.who}`.toLowerCase();
  return Math.min(keywords.filter((w) => text.includes(w)).length, 3);
}

export function forYou<T extends RankCard>(cards: T[], { picked, skipped, saved, keywords = [] }: RankSignals, limit = 3) {
  const savedSlugs = new Set(saved.map((c) => c.slug));
  const savedByCategory = new Map<string, number>();
  for (const c of saved) savedByCategory.set(c.category, (savedByCategory.get(c.category) ?? 0) + 1);

  return cards
    .filter((c) => !savedSlugs.has(c.slug))
    .map((c) => ({
      card: c,
      score:
        (picked.includes(c.category) ? 3 : 0) +
        textMatch(c, keywords) * 2 +
        Math.min(savedByCategory.get(c.category) ?? 0, 3) +
        (c.trend === "rising" ? 1 : 0) +
        c.scores.demand.value / 50 -
        (skipped.includes(c.slug) ? 4 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.card);
}

export function growth(card: Card) {
  const w = card.evidence.weekly;
  if (w.length < 6) return 0;
  const early = w.slice(0, 3).reduce((a, b) => a + b, 0);
  const late = w.slice(-3).reduce((a, b) => a + b, 0);
  return Math.round(((late - early) / Math.max(early, 1)) * 100);
}

export function rising(cards: Card[], limit = 4) {
  return cards
    .map((card) => ({ card, growth: growth(card) }))
    .filter((x) => x.growth > 0)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, limit);
}
