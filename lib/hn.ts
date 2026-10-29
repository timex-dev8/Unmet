import "server-only";
import type { ResearchSource } from "./research-types";

// Hacker News via the free Algolia API (no key). Same source as scripts/refresh-evidence.mjs.
const API = "https://hn.algolia.com/api/v1";

type Hit = {
  objectID: string;
  title?: string | null;
  story_title?: string | null;
  story_text?: string | null;
  comment_text?: string | null;
  points?: number | null;
  num_comments?: number | null;
  created_at: string;
};

export function plain(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchHN(query: string, sinceSeconds: number, limit = 12): Promise<Omit<ResearchSource, "id">[]> {
  const params = new URLSearchParams({
    query,
    tags: "(story,comment)",
    numericFilters: `created_at_i>${sinceSeconds}`,
    hitsPerPage: String(limit),
  });
  const res = await fetch(`${API}/search?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const { hits } = (await res.json()) as { hits: Hit[] };

  return hits
    .map((h) => {
      const isStory = Boolean(h.title);
      const text = plain(h.comment_text ?? [h.title, h.story_text].filter(Boolean).join(". ")).slice(0, 2000);
      const points = h.points ?? 0;
      return {
        title: h.title || `Comment on “${h.story_title ?? "a thread"}”`,
        url: `https://news.ycombinator.com/item?id=${h.objectID}`,
        site: "news.ycombinator.com",
        postedAt: h.created_at,
        text,
        origin: "hn" as const,
        kind: "hn" as const,
        engagement: isStory
          ? { score: points + (h.num_comments ?? 0), label: `${points} points · ${h.num_comments ?? 0} comments` }
          : { score: 1, label: "HN comment" },
      };
    })
    .filter((h) => h.text.length > 60);
}
