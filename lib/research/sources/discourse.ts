import "server-only";
import { plain } from "@/lib/hn";
import type { ResearchSource } from "@/lib/research-types";

// discourse forums have a public json search, no key. business and developer topics
const DISCOURSE_FORUMS = [
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
      const response = await fetch(`https://${host}/search.json?${params}`, {
        signal: AbortSignal.timeout(7000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return [];
      const { posts = [], topics = [] } = (await response.json()) as { posts?: Post[]; topics?: Topic[] };
      const byId = new Map(topics.map((topic) => [topic.id, topic]));
      return posts.slice(0, 4).flatMap((post) => {
        const topic = byId.get(post.topic_id);
        if (!topic) return [];
        const likes = post.like_count ?? 0;
        return [
          {
            title: plain(topic.title),
            url: `https://${host}/t/${topic.slug}/${topic.id}${post.post_number ? `/${post.post_number}` : ""}`,
            site: host,
            postedAt: post.created_at,
            text: plain(`${topic.title}. ${post.blurb}`),
            origin: "discourse" as const,
            kind: "forum" as const,
            engagement: { score: likes * 2 + (topic.posts_count ?? 0), label: `${likes} likes · ${topic.posts_count ?? 0} replies in thread` },
          },
        ];
      });
    }),
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])).filter((source) => source.text.length > 80);
}
