import type { Card, Product } from "./types";
import { hostOf } from "./url";

/** Starts a research seeded with a card, so the AI knows exactly which idea to dig into. */
export function digDeeperHref(card: Pick<Card, "slug" | "headline">) {
  const q = `Find more evidence for “${card.headline}” and who already solves it`;
  return `/app/research?about=${encodeURIComponent(card.slug)}&q=${encodeURIComponent(q)}`;
}

export const researchHref = (q: string, depth?: string) => `/app/research?q=${encodeURIComponent(q)}${depth ? `&depth=${depth}` : ""}`;

export const ideaHref = (slug: string) => `/app/idea/${slug}`;

export const searchHref = (q: string) => `/app/search?q=${encodeURIComponent(q)}`;

/** Research link that digs into what people dislike about a product. */
export const gapsHref = (name: string) => researchHref(`What do people hate about ${name}?`);

const clip = (s: string, n: number) => {
  const t = s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/**
 * Like `gapsHref`, but the question carries what we know about the product (site, what it does, who it's for,
 * category). A new product has few reviews under its own name, so this lets the research look at similar tools too.
 */
export function productResearchHref(product: Pick<Product, "name" | "url" | "oneLine" | "forWho" | "category">) {
  const host = hostOf(product.url);
  const site = /^[\w-]+(\.[\w-]+)+$/.test(host) ? ` (${host})` : "";
  const q =
    `What do people hate about ${clip(product.name, 60)}${site}? It is ${clip(product.oneLine, 160)}, for ${clip(product.forWho.toLowerCase(), 70)}. ` +
    `Also look at complaints about similar ${product.category.toLowerCase()} tools and why people switch between them.`;
  return researchHref(q);
}

/**
 * Where to go after sign-in: a path on this site, or "/app". Browsers read "//x", "/\x" and paths
 * with tabs or newlines ("/\t/x") as another website, so those are refused, and the parsed result
 * must stay on `origin`. Returns only the path, query and hash.
 */
export function safeNext(raw: unknown, origin = "https://unmet.invalid") {
  if (typeof raw !== "string" || !raw.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(raw)) return "/app";
  try {
    const base = new URL(origin);
    const url = new URL(raw, base);
    const path = url.pathname + url.search + url.hash;
    // "/..//x" resolves to the path "//x", which a browser would again read as another website.
    return url.origin === base.origin && !path.startsWith("//") ? path : "/app";
  } catch {
    return "/app";
  }
}
