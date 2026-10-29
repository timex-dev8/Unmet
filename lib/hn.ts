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
  created_at: string;
};

function plain(html: string) {
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

export async function searchHN(query: string, sinceSeconds: number): Promise<Omit<ResearchSource, "id">[]> {
  const params = new URLSearchParams({
    query,
    tags: "(story,comment)",
    numericFilters: `created_at_i>${sinceSeconds}`,
    hitsPerPage: "10",
  });
  const res = await fetch(`${API}/search?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const { hits } = (await res.json()) as { hits: Hit[] };

  return hits
    .map((h) => {
      const text = plain(h.comment_text ?? [h.title, h.story_text].filter(Boolean).join(". ")).slice(0, 900);
      return {
        title: h.title || `Comment on “${h.story_title ?? "a thread"}”`,
        url: `https://news.ycombinator.com/item?id=${h.objectID}`,
        site: "news.ycombinator.com",
        postedAt: h.created_at,
        text,
        origin: "hn" as const,
      };
    })
    .filter((h) => h.text.length > 40);
}
