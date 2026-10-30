import "server-only";
import type { RawProduct } from "./types";
import { headers } from "./types";

// Apple's free top-grossing charts (US), per genre: apps people pay for, right now. No key needed.
const GENRES: [number, string][] = [
  [6000, "Business"],
  [6007, "Productivity"],
  [6015, "Finance"],
  [6013, "Health & Fitness"],
  [6017, "Education"],
  [6002, "Utilities"],
];

type Entry = {
  "im:name": { label: string };
  summary?: { label: string };
  "im:artist"?: { label: string };
  id: { label: string };
};

export async function appStoreGrossing(perGenre = 25): Promise<RawProduct[]> {
  const lists = await Promise.allSettled(
    GENRES.map(async ([id, genre]) => {
      const res = await fetch(`https://itunes.apple.com/us/rss/topgrossingapplications/limit=${perGenre}/genre=${id}/json`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { feed?: { entry?: Entry[] } };
      return (body.feed?.entry ?? []).map((e, i): RawProduct => ({
        name: e["im:name"].label.split(/[:–—-]\s/)[0].trim(),
        url: e.id.label.split("?")[0],
        description: `${e["im:artist"]?.label ?? ""}. ${(e.summary?.label ?? "").slice(0, 600)}`,
        hint: genre,
        proof: [{ kind: "grossing", label: `#${i + 1} top-grossing in ${genre} (US)`, url: e.id.label.split("?")[0], site: "App Store" }],
        weight: 60 - i * 1.5,
      }));
    }),
  );
  return lists.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
