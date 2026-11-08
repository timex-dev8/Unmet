import "server-only";
import type { RawProduct } from "./types";
import { headers } from "./types";

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
  "im:image"?: { label: string; attributes?: { height?: string } }[];
};

// apple serves any size from the same URL, ask for 256px (sharp on retina)
const iconOf = (entry: Entry) =>
  [...(entry["im:image"] ?? [])]
    .sort((a, b) => Number(b.attributes?.height ?? 0) - Number(a.attributes?.height ?? 0))[0]
    ?.label.replace(/\/\d+x\d+bb\.(png|jpg)$/, "/256x256bb.$1");

export async function appStoreGrossing(perGenre = 25): Promise<RawProduct[]> {
  const lists = await Promise.allSettled(
    GENRES.map(async ([id, genre]) => {
      const response = await fetch(`https://itunes.apple.com/us/rss/topgrossingapplications/limit=${perGenre}/genre=${id}/json`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];
      const body = (await response.json()) as { feed?: { entry?: Entry[] } };
      return (body.feed?.entry ?? []).map((entry, i): RawProduct => ({
        name: entry["im:name"].label.split(/[:–—-]\s/)[0].trim(),
        url: entry.id.label.split("?")[0],
        description: `${entry["im:artist"]?.label ?? ""}. ${(entry.summary?.label ?? "").slice(0, 600)}`,
        hint: genre,
        proof: [{ kind: "grossing", label: `#${i + 1} top-grossing in ${genre} (US)`, url: entry.id.label.split("?")[0], site: "App Store" }],
        image: iconOf(entry),
        source: "App Store",
        weight: 60 - i * 1.5,
      }));
    }),
  );
  return lists.flatMap((list) => (list.status === "fulfilled" ? list.value : []));
}
