import type { Card, SourceKind } from "@/lib/types";

// The feed's evidence bar, stricter than research: a problem only reaches everyone's feed when
// several independent people describe it first-hand, on several sites, recently.
const FIRST_HAND: SourceKind[] = ["forum", "qa", "review", "app-review", "issue", "social"];
const MIN_SOURCES = 3;
const MIN_SITES = 2;
const MIN_FIRST_HAND = 2;
const MAX_AGE_DAYS = 180;

export function passesFeedBar(card: Card, now = Date.now()) {
  if (card.signal === "early" || card.sample) return false;
  const sites = new Set(card.sources.map((s) => s.site));
  const firstHand = card.sources.filter((s) => s.kind && FIRST_HAND.includes(s.kind)).length;
  const newest = Math.max(0, ...card.sources.map((s) => (s.postedAt ? Date.parse(s.postedAt) : 0)));
  // Many sources carry no date; only judge freshness when at least one does.
  const fresh = newest === 0 || now - newest < MAX_AGE_DAYS * 86400_000;
  return card.sources.length >= MIN_SOURCES && sites.size >= MIN_SITES && firstHand >= MIN_FIRST_HAND && fresh;
}
