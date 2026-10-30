import "server-only";
import { searchProducts } from "@/lib/exa";
import { listStartups, trustmrrConfigured, type Startup } from "@/lib/trustmrr";
import type { Card, Competitor } from "@/lib/types";
import { kindOf } from "./quality";

// High mode: for the top problems, look for products that already solve them, on the web
// and among TrustMRR's revenue-verified startups. Competition then becomes a checked number.

const LISTICLE = /\b\d+\s+(best|top)\b|alternatives|\bvs\.?\s|review|guide|how to|%|\bwhy\b|\bstop\b|template|lessons/i;
const STOP = new Set(["their", "about", "which", "there", "would", "could", "people", "every", "after", "before", "without"]);
const keywords = (s: string) => new Set(s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4 && !STOP.has(w)));

// A product page is a homepage or a shallow page (example.com/ or example.com/features), not an article.
const isProductPage = (url: string) => {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).length <= 1;
  } catch {
    return false;
  }
};

// Use the short brand part of the title; fall back to the domain name when the title reads like a sentence.
export function productName(title: string, site: string) {
  const parts = title.split(/\s[|–—-]\s|:\s/).map((p) => p.trim()).filter(Boolean);
  const short = parts.find((p) => p.split(/\s+/).length <= 3 && !/^(how|why|what|the)\b/i.test(p));
  if (short) return short.slice(0, 40);
  const label = site.split(".").slice(-2, -1)[0] ?? site;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export async function findCompetitors(card: Card, startups: Startup[]): Promise<Competitor[]> {
  const since = new Date(Date.now() - 3 * 365 * 86400_000).toISOString();
  const pages = await searchProducts(`${card.headline}. Software or app for ${card.who}`, since).catch(() => []);
  const seen = new Set<string>();
  const web: Competitor[] = [];
  for (const p of pages) {
    const kind = kindOf(p.site, p.url);
    if (kind !== "blog" || !isProductPage(p.url) || LISTICLE.test(p.title) || seen.has(p.site)) continue;
    seen.add(p.site);
    web.push({ name: productName(p.title, p.site), url: p.url, note: p.text.slice(0, 120) || undefined });
    if (web.length >= 4) break;
  }

  // Revenue-verified startups whose description overlaps with the problem.
  const words = keywords(`${card.headline} ${card.summary}`);
  const verified: Competitor[] = startups
    .map((s) => ({ s, overlap: [...keywords(s.description)].filter((w) => words.has(w)).length }))
    .filter((x) => x.overlap >= 3 && !/^stealth/i.test(x.s.name))
    .sort((a, b) => b.overlap - a.overlap || b.s.mrr - a.s.mrr)
    .slice(0, 2)
    .map(({ s }) => ({ name: s.name, url: s.website, note: s.description.slice(0, 120), mrr: s.mrr }));

  return [...verified, ...web].slice(0, 5);
}

export async function startupsFor(category: string) {
  if (!category || !trustmrrConfigured()) return [];
  return listStartups({ category, sort: "revenue-desc", pages: 3 }).catch(() => []);
}

/** Competition score from what was actually found. */
export function competitionFrom(found: Competitor[]) {
  const verified = found.filter((c) => c.mrr);
  const top = verified.reduce((m, c) => Math.max(m, c.mrr ?? 0), 0);
  const value = Math.min(92, 20 + found.length * 13 + (top > 1_000_000 ? 10 : 0));
  const reason = found.length
    ? `${found.length} existing ${found.length === 1 ? "product" : "products"} found${top ? `, top verified revenue $${Math.round(top / 100).toLocaleString("en-US")}/mo` : ""}`
    : "Few existing products found in a quick search";
  return { value, reason };
}
