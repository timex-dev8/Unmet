import type { ResearchSource } from "@/lib/research-types";
import type { Card, Score, SourceKind, Trend } from "@/lib/types";
import type { Complaint } from "./extract";
import type { DraftProblem } from "./group";
import { MAX_QUOTE_WORDS } from "./verify";

// Turns a grouped problem into a card. Every number here is computed from the sources,
// never taken from the AI.

const DAY = 86400;
export const WINDOW_DAYS = 365;

const label = (v: number): Score["label"] => (v >= 67 ? "High" : v >= 40 ? "Medium" : "Low");
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

function slugify(text: string) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function trendOf(dates: number[], now: number): Trend {
  if (dates.length < 3) return "steady";
  const half = now - (WINDOW_DAYS / 2) * DAY;
  const recent = dates.filter((d) => d >= half).length;
  const older = dates.length - recent;
  return recent > older * 1.5 ? "rising" : older > recent * 1.5 ? "falling" : "steady";
}

/** Mentions per month over the window, oldest first. */
function monthly(dates: number[], now: number) {
  const buckets = Array(12).fill(0);
  for (const d of dates) {
    const i = 11 - Math.floor((now - d) / (30.5 * DAY));
    if (i >= 0 && i < 12) buckets[i]++;
  }
  return buckets;
}

export function medianAgeMonths(sources: ResearchSource[], now: number) {
  const ages = sources
    .map((s) => (s.postedAt ? (now - Date.parse(s.postedAt) / 1000) / (30.5 * DAY) : NaN))
    .filter((a) => !Number.isNaN(a))
    .sort((a, b) => a - b);
  return ages.length ? Math.max(0, Math.round(ages[Math.floor(ages.length / 2)])) : null;
}

export const KIND_LABEL: Record<SourceKind, [string, string]> = {
  forum: ["forum post", "forum posts"],
  qa: ["Q&A question", "Q&A questions"],
  review: ["review", "reviews"],
  "app-review": ["App Store review", "App Store reviews"],
  issue: ["GitHub issue", "GitHub issues"],
  hn: ["Hacker News post", "Hacker News posts"],
  news: ["news article", "news articles"],
  blog: ["blog post", "blog posts"],
};

export function kindMix(sources: ResearchSource[]) {
  const counts = new Map<SourceKind, number>();
  for (const s of sources) counts.set(s.kind ?? "blog", (counts.get(s.kind ?? "blog") ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${KIND_LABEL[k][n === 1 ? 0 : 1]}`)
    .join(", ");
}

export function buildCard(
  p: DraftProblem,
  complaints: Complaint[],
  sources: ResearchSource[],
  opts: { topic: string; now: number; minSources: number; minSites: number },
): Card | null {
  const cById = new Map(complaints.map((c) => [c.id, c]));
  const sById = new Map(sources.map((s) => [s.id, s]));
  const own = [...new Set(p.complaintIds)].map((id) => cById.get(id)).filter((c): c is Complaint => Boolean(c));
  const used = [...new Set(own.map((c) => c.sourceId))].map((id) => sById.get(id)!).filter(Boolean);
  const sites = new Set(used.map((s) => s.site));
  if (used.length < opts.minSources || sites.size < opts.minSites) return null;

  used.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const dates = used.map((s) => (s.postedAt ? Date.parse(s.postedAt) / 1000 : NaN)).filter((d) => !Number.isNaN(d));

  // Best quote: from the strongest source, short enough to show.
  const quoteFrom = [...own]
    .filter((c) => c.quote.split(/\s+/).length <= MAX_QUOTE_WORDS)
    .sort((a, b) => (sById.get(b.sourceId)?.weight ?? 0) - (sById.get(a.sourceId)?.weight ?? 0))[0];

  // Demand from real signals: how many independent sources, how many different sites,
  // how much engagement they got, and how fresh they are.
  const engagement = used.reduce((sum, s) => sum + (s.engagement?.score ?? 0), 0);
  const recent = dates.filter((d) => d > opts.now - 180 * DAY).length;
  const demand = clamp(15 + used.length * 7 + (sites.size - 1) * 6 + Math.min(Math.log10(1 + engagement) * 6, 15) + (recent / Math.max(used.length, 1)) * 10, 5, 95);
  const engagementNote = engagement > 0 ? `, ${used.filter((s) => s.engagement && s.engagement.score > 1).length} with real engagement` : "";

  return {
    slug: slugify(p.headline),
    headline: p.headline,
    summary: p.summary,
    who: p.who,
    category: p.category,
    trend: trendOf(dates, opts.now),
    quote: quoteFrom?.quote ?? "",
    highlight: "",
    query: opts.topic,
    evidence: {
      posts: own.length,
      threads: used.length,
      days: WINDOW_DAYS,
      weekly: monthly(dates, opts.now),
      site: sites.size === 1 ? [...sites][0] : `${sites.size} sites`,
      updatedAt: new Date(opts.now * 1000).toISOString(),
    },
    scores: {
      demand: {
        value: demand,
        label: label(demand),
        basis: "data",
        reason: `${used.length} sources on ${sites.size} ${sites.size === 1 ? "site" : "sites"}${engagementNote}, last 12 months`,
      },
      competition: { value: p.competition.value, label: label(p.competition.value), basis: "ai", reason: p.competition.reason },
      difficulty: { value: p.difficulty.value, label: label(p.difficulty.value), basis: "ai", reason: p.difficulty.reason },
    },
    aiSuggestions: p.ideas,
    sources: used.map((s) => ({ title: s.title, url: s.url, site: s.site, kind: s.kind, engagement: s.engagement?.label, postedAt: s.postedAt })),
    fresh: true,
  };
}
