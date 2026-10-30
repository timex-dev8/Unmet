import "server-only";
import { plain } from "@/lib/hn";
import type { ResearchSource } from "@/lib/research-types";

// Community forums that run Discourse, which offers a public JSON search (no key). People there
// describe problems with real products in detail. Used for business and developer topics.
export const DISCOURSE_FORUMS = [
  "community.home-assistant.io",
  "forum.obsidian.md",
  "forum.figma.com",
  "community.n8n.io",
  "forum.bubble.io",
  "forum.cursor.com",
  "community.openai.com",
  "forum.freecodecamp.org",
  "community.fly.io",
  "community.bitwarden.com",
];

type Post = { id: number; topic_id: number; post_number?: number; created_at: string; blurb: string; like_count?: number; username?: string };
type Topic = { id: number; slug: string; title: string; posts_count?: number };

export async function searchDiscourse(query: string, sinceIso: string): Promise<Omit<ResearchSource, "id">[]> {
  const after = sinceIso.slice(0, 10);
  const results = await Promise.allSettled(
    DISCOURSE_FORUMS.map(async (host) => {
      const params = new URLSearchParams({ q: `${query} after:${after}` });
      const res = await fetch(`https://${host}/search.json?${params}`, {
        signal: AbortSignal.timeout(7000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return [];
      const { posts = [], topics = [] } = (await res.json()) as { posts?: Post[]; topics?: Topic[] };
      const byId = new Map(topics.map((t) => [t.id, t]));
      return posts.slice(0, 4).flatMap((p) => {
        const t = byId.get(p.topic_id);
        if (!t) return [];
        const likes = p.like_count ?? 0;
        return [
          {
            title: plain(t.title),
            url: `https://${host}/t/${t.slug}/${t.id}${p.post_number ? `/${p.post_number}` : ""}`,
            site: host,
            postedAt: p.created_at,
            text: plain(`${t.title}. ${p.blurb}`),
            origin: "discourse" as const,
            kind: "forum" as const,
            engagement: { score: likes * 2 + (t.posts_count ?? 0), label: `${likes} likes · ${t.posts_count ?? 0} replies in thread` },
          },
        ];
      });
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((s) => s.text.length > 80);
}
