import type { Card, Product } from "./types";
import { hostOf } from "./url";

export function digDeeperHref(card: Pick<Card, "slug" | "headline">) {
  const q = `Find more evidence for “${card.headline}” and who already solves it`;
  return `/app/research?about=${encodeURIComponent(card.slug)}&q=${encodeURIComponent(q)}`;
}

export const researchHref = (q: string, depth?: string) => `/app/research?q=${encodeURIComponent(q)}${depth ? `&depth=${depth}` : ""}`;

export const ideaHref = (slug: string) => `/app/idea/${slug}`;

export const searchHref = (q: string) => `/app/search?q=${encodeURIComponent(q)}`;

const clip = (s: string, n: number) => {
  const t = s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

// new products have few reviews under their own name, so this passes context to let research look at similar tools
export function productResearchHref(product: Pick<Product, "name" | "url" | "oneLine" | "forWho" | "category">) {
  const host = hostOf(product.url);
  const site = /^[\w-]+(\.[\w-]+)+$/.test(host) ? ` (${host})` : "";
  const q =
    `What do people hate about ${clip(product.name, 60)}${site}? It is ${clip(product.oneLine, 160)}, for ${clip(product.forWho.toLowerCase(), 70)}. ` +
    `Also look at complaints about similar ${product.category.toLowerCase()} tools and why people switch between them.`;
  return researchHref(q);
}

// "//x", "/\x" and "/\t/x" read as another website to browsers, so refuse them and keep the result on origin
export function safeNext(raw: unknown, origin = "https://unmet.invalid") {
  if (typeof raw !== "string" || !raw.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(raw)) return "/app";
  try {
    const base = new URL(origin);
    const url = new URL(raw, base);
    const path = url.pathname + url.search + url.hash;
    // "/..//x" resolves to "//x", same problem
    return url.origin === base.origin && !path.startsWith("//") ? path : "/app";
  } catch {
    return "/app";
  }
}
