import "server-only";
import type { ResearchSource } from "./research-types";

// free algolia api, no key. same source as scripts/refresh-evidence.mjs
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
  const response = await fetch(`${API}/search?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return [];
  const { hits } = (await response.json()) as { hits: Hit[] };

  return hits
    .map((hit) => {
      const isStory = Boolean(hit.title);
      const text = plain(hit.comment_text ?? [hit.title, hit.story_text].filter(Boolean).join(". ")).slice(0, 2000);
      const points = hit.points ?? 0;
      return {
        title: hit.title || `Comment on “${hit.story_title ?? "a thread"}”`,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        site: "news.ycombinator.com",
        postedAt: hit.created_at,
        text,
        origin: "hn" as const,
        kind: "hn" as const,
        engagement: isStory
          ? { score: points + (hit.num_comments ?? 0), label: `${points} points · ${hit.num_comments ?? 0} comments` }
          : { score: 1, label: "HN comment" },
      };
    })
    .filter((hit) => hit.text.length > 60);
}
