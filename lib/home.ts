import type { Card, Product, ProductProof, Report } from "./types";

// slim copy of cards, the full ones would ride along in the page for nothing

export type HomeIdea = Pick<Card, "slug" | "headline" | "summary" | "who" | "category" | "trend"> & {
  scores: { demand: { value: number } };
  evidence: { posts: number; threads: number; site: string };
  sites: number;
  verdict?: Report["verdict"];
  sample?: boolean;
};

export type HomeProduct = Pick<Product, "slug" | "name" | "url" | "oneLine" | "forWho" | "category" | "source" | "image"> & { proof: ProductProof[] };

export function homeIdea(c: Card): HomeIdea {
  return {
    slug: c.slug,
    headline: c.headline,
    summary: c.summary,
    who: c.who,
    category: c.category,
    trend: c.trend,
    scores: { demand: { value: c.scores.demand.value } },
    evidence: { posts: c.evidence.posts, threads: c.evidence.threads, site: c.evidence.site },
    sites: new Set(c.sources.map((x) => x.site)).size || 1,
    verdict: c.report?.verdict,
    sample: c.sample || undefined,
  };
}

export function trendingPicks<P extends Pick<Product, "source">>(products: P[]): P[] {
  const ph = products.filter((p) => p.source === "Product Hunt");
  const mrr = products.filter((p) => p.source === "TrustMRR");
  const rest = products.filter((p) => p.source !== "Product Hunt" && p.source !== "TrustMRR");
  const picked = [...ph.slice(0, 2), ...mrr.slice(0, 2)];
  const spare = ph.length < 2 ? [...mrr.slice(2), ...ph.slice(2)] : [...ph.slice(2), ...mrr.slice(2)];
  return [...picked, ...spare, ...rest].slice(0, 4);
}

export function homeProducts(products: Product[]): HomeProduct[] {
  const slim = (p: Product): HomeProduct => ({
    slug: p.slug,
    name: p.name,
    url: p.url,
    oneLine: p.oneLine,
    forWho: p.forWho,
    category: p.category,
    source: p.source,
    image: p.image,
    proof: p.proof.slice(0, 1), // only the first is shown
  });
  return products.length ? [slim(products[0]), ...trendingPicks(products.slice(1)).map(slim)] : [];
}
