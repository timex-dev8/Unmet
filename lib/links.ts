import type { Card } from "./types";

/** Starts a research seeded with a card, so the AI knows exactly which idea to dig into. */
export function digDeeperHref(card: Pick<Card, "slug" | "headline">) {
  const q = `Find more evidence for “${card.headline}” and who already solves it`;
  return `/app/research?about=${encodeURIComponent(card.slug)}&q=${encodeURIComponent(q)}`;
}

export const researchHref = (q: string) => `/app/research?q=${encodeURIComponent(q)}`;
