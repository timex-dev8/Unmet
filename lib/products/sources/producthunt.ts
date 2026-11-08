import "server-only";
import type { RawProduct } from "./types";
import { headers } from "./types";

// only runs with PRODUCT_HUNT_TOKEN, terms limit commercial use so check with them first
type PostNode = {
  name: string;
  tagline: string;
  description?: string;
  votesCount: number;
  website: string;
  url: string;
  thumbnail?: { url?: string | null } | null;
};

export async function productHunt(): Promise<RawProduct[]> {
  const token = process.env.PRODUCT_HUNT_TOKEN;
  if (!token) return [];
  const after = new Date(Date.now() - 7 * 86400_000).toISOString();
  const query = `{ posts(order: VOTES, postedAfter: "${after}", first: 30) { edges { node { name tagline description votesCount website url thumbnail { url } } } } }`;
  const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return [];
  const body = (await response.json()) as { data?: { posts?: { edges?: { node: PostNode }[] } } };
  return (body.data?.posts?.edges ?? [])
    .map((edge) => edge.node)
    .filter((post) => post.votesCount >= 150)
    .map((post) => ({
      name: post.name,
      url: post.website || post.url,
      description: `${post.tagline}. ${(post.description ?? "").slice(0, 500)}`,
      proof: [{ kind: "votes", label: `${post.votesCount} upvotes on Product Hunt this week`, url: post.url, site: "Product Hunt" }],
      rising: true,
      image: post.thumbnail?.url || undefined,
      source: "Product Hunt" as const,
      weight: Math.min(35, post.votesCount / 20),
    }));
}
