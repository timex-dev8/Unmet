import "server-only";
import type { RawProduct } from "./types";
import { headers } from "./types";

// only runs with PRODUCT_HUNT_TOKEN, terms limit commercial use so check with them first
type Node = {
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
  const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const body = (await res.json()) as { data?: { posts?: { edges?: { node: Node }[] } } };
  return (body.data?.posts?.edges ?? [])
    .map((e) => e.node)
    .filter((n) => n.votesCount >= 150)
    .map((n) => ({
      name: n.name,
      url: n.website || n.url,
      description: `${n.tagline}. ${(n.description ?? "").slice(0, 500)}`,
      proof: [{ kind: "votes", label: `${n.votesCount} upvotes on Product Hunt this week`, url: n.url, site: "Product Hunt" }],
      rising: true,
      image: n.thumbnail?.url || undefined,
      source: "Product Hunt" as const,
      weight: Math.min(35, n.votesCount / 20),
    }));
}
