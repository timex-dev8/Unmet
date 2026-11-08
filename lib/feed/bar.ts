import type { Card, SourceKind } from "@/lib/types";

const FIRST_HAND: SourceKind[] = ["forum", "qa", "review", "app-review", "issue", "social"];
const MIN_SOURCES = 3;
const MIN_SITES = 2;
const MIN_FIRST_HAND = 2;
const MAX_AGE_DAYS = 180;

export function passesFeedBar(card: Card, now = Date.now()) {
  if (card.sample) return false;
  const sites = new Set(card.sources.map((source) => source.site));
  const firstHand = card.sources.filter((source) => source.kind && FIRST_HAND.includes(source.kind)).length;
  const newest = Math.max(0, ...card.sources.map((source) => (source.postedAt ? Date.parse(source.postedAt) : 0)));
  // many sources carry no date, only judge freshness when one does
  const fresh = newest === 0 || now - newest < MAX_AGE_DAYS * 86400_000;
  if (!fresh) return false;
  // early signals (2 posts, 2 sites, one first-hand) get in, labeled
  if (card.signal === "early") return card.sources.length >= 2 && sites.size >= 2 && firstHand >= 1;
  return card.sources.length >= MIN_SOURCES && sites.size >= MIN_SITES && firstHand >= MIN_FIRST_HAND;
}
