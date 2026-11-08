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

const url = (p: Post) => `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`;

export async function searchBluesky(queries: string[], sinceIso: string): Promise<Omit<ResearchSource, "id">[]> {
  const results = await Promise.allSettled(
    [...new Set(queries.filter(Boolean))].slice(0, 2).map(async (q) => {
      const params = new URLSearchParams({ q, limit: "25", sort: "top", since: sinceIso });
      const res = await fetch(`https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const { posts = [] } = (await res.json()) as { posts?: Post[] };
      return posts.map((p) => {
        const text = (p.record.text ?? "").replace(/\s+/g, " ").trim();
        const likes = p.likeCount ?? 0;
        const replies = p.replyCount ?? 0;
        return {
          title: text.slice(0, 90),
          url: url(p),
          site: "bsky.app",
          postedAt: p.record.createdAt,
          text,
          origin: "bluesky" as const,
          kind: "social" as const,
          engagement: { score: likes + replies * 3 + (p.repostCount ?? 0) * 2, label: `${likes} likes · ${replies} replies` },
        };
      });
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((s) => s.text.length >= 60);
}
