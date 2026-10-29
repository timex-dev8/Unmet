import type { Card, Category } from "./types";

// Personal ranking for Home and the feed. Pure functions: no storage, easy to tune.

export type RankSignals = { picked: Category[]; skipped: string[]; saved: Card[] };

export function forYou(cards: Card[], { picked, skipped, saved }: RankSignals, limit = 3) {
  const savedSlugs = new Set(saved.map((c) => c.slug));
  const savedByCategory = new Map<string, number>();
  for (const c of saved) savedByCategory.set(c.category, (savedByCategory.get(c.category) ?? 0) + 1);

  return cards
    .filter((c) => !savedSlugs.has(c.slug))
    .map((c) => ({
      card: c,
      score:
        (picked.includes(c.category) ? 3 : 0) +
        Math.min(savedByCategory.get(c.category) ?? 0, 3) +
        (c.trend === "rising" ? 1 : 0) +
        c.scores.demand.value / 50 -
        (skipped.includes(c.slug) ? 4 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.card);
}

/** Change in mentions: the last 3 periods vs the first 3, as a percentage. */
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
