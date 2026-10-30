import "server-only";
import { plain } from "@/lib/hn";
import type { RawProduct } from "./types";
import { headers } from "./types";

// Show HN launches from the last 30 days that many people upvoted (free Algolia API, no key).
type Hit = { objectID: string; title: string; url?: string | null; story_text?: string | null; points: number; num_comments: number };

export async function showHn(minPoints = 150): Promise<RawProduct[]> {
  const since = Math.floor(Date.now() / 1000) - 30 * 86400;
  const qs = new URLSearchParams({ tags: "show_hn", numericFilters: `points>${minPoints},created_at_i>${since}`, hitsPerPage: "40" });
  const res = await fetch(`https://hn.algolia.com/api/v1/search?${qs}`, { headers, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return [];
  const { hits = [] } = (await res.json()) as { hits?: Hit[] };
  return hits
    .filter((h) => h.url)
    .map((h) => {
      const title = h.title.replace(/^Show HN:\s*/i, "");
      const thread = `https://news.ycombinator.com/item?id=${h.objectID}`;
      return {
        name: title.split(/\s[–—-]\s|:\s|,\s/)[0].trim(),
        url: h.url!,
        description: `${title}. ${plain(h.story_text ?? "").slice(0, 600)}`,
        proof: [{ kind: "votes", label: `${h.points} points on Show HN`, url: thread, site: "Hacker News" }],
        weight: Math.min(40, h.points / 25),
      };
    });
}
