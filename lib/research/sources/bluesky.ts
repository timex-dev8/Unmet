import "server-only";
import type { ResearchSource } from "@/lib/research-types";

// matches keywords so 2-4 words. only posts in the window

type Post = {
  uri: string;
  author: { handle: string };
  record: { text?: string; createdAt?: string };
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
};

const postUrl = (post: Post) => `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}`;

export async function searchBluesky(queries: string[], sinceIso: string): Promise<Omit<ResearchSource, "id">[]> {
  const results = await Promise.allSettled(
    [...new Set(queries.filter(Boolean))].slice(0, 2).map(async (query) => {
      const params = new URLSearchParams({ q: query, limit: "25", sort: "top", since: sinceIso });
      const response = await fetch(`https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return [];
      const { posts = [] } = (await response.json()) as { posts?: Post[] };
      return posts.map((post) => {
        const text = (post.record.text ?? "").replace(/\s+/g, " ").trim();
        const likes = post.likeCount ?? 0;
        const replies = post.replyCount ?? 0;
        return {
          title: text.slice(0, 90),
          url: postUrl(post),
          site: "bsky.app",
          postedAt: post.record.createdAt,
          text,
          origin: "bluesky" as const,
          kind: "social" as const,
          engagement: { score: likes + replies * 3 + (post.repostCount ?? 0) * 2, label: `${likes} likes · ${replies} replies` },
        };
      });
    }),
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])).filter((source) => source.text.length >= 60);
}
