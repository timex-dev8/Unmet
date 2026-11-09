import { sourceCount } from "./text";
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

export function homeIdea(card: Card): HomeIdea {
  return {
    slug: card.slug,
    headline: card.headline,
    summary: card.summary,
    who: card.who,
    category: card.category,
    trend: card.trend,
    scores: { demand: { value: card.scores.demand.value } },
    evidence: { posts: card.evidence.posts, threads: sourceCount(card), site: card.evidence.site },
    sites: new Set(card.sources.map((source) => source.site)).size || 1,
    verdict: card.report?.verdict,
    sample: card.sample || undefined,
  };
}

export function trendingPicks<P extends Pick<Product, "source">>(products: P[]): P[] {
  const productHunt = products.filter((product) => product.source === "Product Hunt");
  const trustMrr = products.filter((product) => product.source === "TrustMRR");
  const rest = products.filter((product) => product.source !== "Product Hunt" && product.source !== "TrustMRR");
  const picked = [...productHunt.slice(0, 2), ...trustMrr.slice(0, 2)];
  const spare = productHunt.length < 2 ? [...trustMrr.slice(2), ...productHunt.slice(2)] : [...productHunt.slice(2), ...trustMrr.slice(2)];
  return [...picked, ...spare, ...rest].slice(0, 4);
}

export function homeProducts(products: Product[]): HomeProduct[] {
  const slim = (product: Product): HomeProduct => ({
    slug: product.slug,
    name: product.name,
    url: product.url,
    oneLine: product.oneLine,
    forWho: product.forWho,
    category: product.category,
    source: product.source,
    image: product.image,
    proof: product.proof.slice(0, 1), // only the first is shown
  });
  return products.length ? [slim(products[0]), ...trendingPicks(products.slice(1)).map(slim)] : [];
}
