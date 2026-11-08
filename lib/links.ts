import type { Card, Product } from "./types";
import { hostOf } from "./url";

export function digDeeperHref(card: Pick<Card, "slug" | "headline">) {
  const question = `Find more evidence for “${card.headline}” and who already solves it`;
  return `/app/research?about=${encodeURIComponent(card.slug)}&q=${encodeURIComponent(question)}`;
}

export const researchHref = (question: string, depth?: string) => `/app/research?q=${encodeURIComponent(question)}${depth ? `&depth=${depth}` : ""}`;

export const ideaHref = (slug: string) => `/app/idea/${slug}`;

export const searchHref = (query: string) => `/app/search?q=${encodeURIComponent(query)}`;

const clip = (text: string, maxLength: number) => {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trimEnd()}…` : cleaned;
};

// new products have few reviews under their own name, so this passes context to let research look at similar tools
export function productResearchHref(product: Pick<Product, "name" | "url" | "oneLine" | "forWho" | "category">) {
  const host = hostOf(product.url);
  const site = /^[\w-]+(\.[\w-]+)+$/.test(host) ? ` (${host})` : "";
  const question =
    `What do people hate about ${clip(product.name, 60)}${site}? It is ${clip(product.oneLine, 160)}, for ${clip(product.forWho.toLowerCase(), 70)}. ` +
    `Also look at complaints about similar ${product.category.toLowerCase()} tools and why people switch between them.`;
  return researchHref(question);
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
