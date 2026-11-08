import type { ResearchSource } from "@/lib/research-types";
import { slugify } from "@/lib/text";
import type { Card, Report, Score, Signal, SourceKind, Trend } from "@/lib/types";
import type { Complaint } from "./extract";
import type { DraftProblem } from "./group";
import { MAX_QUOTE_WORDS } from "./verify";

const DAY = 86400;
export const WINDOW_DAYS = 365;

const label = (value: number): Score["label"] => (value >= 67 ? "High" : value >= 40 ? "Medium" : "Low");
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, Math.round(value)));

function trendOf(dates: number[], now: number, windowDays: number): Trend {
  if (dates.length < 3) return "steady";
  const half = now - (windowDays / 2) * DAY;
  const recent = dates.filter((date) => date >= half).length;
  const older = dates.length - recent;
  return recent > older * 1.5 ? "rising" : older > recent * 1.5 ? "falling" : "steady";
}

function monthly(dates: number[], now: number, windowDays: number) {
  const buckets = Array(12).fill(0);
  for (const date of dates) {
    const i = 11 - Math.floor((now - date) / ((windowDays / 12) * DAY));
    if (i >= 0 && i < 12) buckets[i]++;
  }
  return buckets;
}

const KIND_LABEL: Record<SourceKind, [string, string]> = {
  forum: ["forum post", "forum posts"],
  qa: ["Q&A question", "Q&A questions"],
  review: ["review", "reviews"],
  "app-review": ["App Store review", "App Store reviews"],
  issue: ["GitHub issue", "GitHub issues"],
  social: ["Bluesky post", "Bluesky posts"],
  hn: ["Hacker News post", "Hacker News posts"],
  news: ["news article", "news articles"],
  blog: ["blog post", "blog posts"],
};

export function kindMix(sources: ResearchSource[]) {
  const counts = new Map<SourceKind, number>();
  for (const source of sources) counts.set(source.kind ?? "blog", (counts.get(source.kind ?? "blog") ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => `${count} ${KIND_LABEL[kind][count === 1 ? 0 : 1]}`)
    .join(", ");
}

function reportFor(own: Complaint[], used: ResearchSource[], sites: number, trend: Trend, today: string): Report {
  const signals: Record<Signal, number> = { pays: 0, switching: 0, price: 0, workaround: 0 };
  for (const complaint of own) if (complaint.signal) signals[complaint.signal]++;
  const money = signals.pays + signals.switching + signals.price;

  let points = 0;
  const reasons: string[] = [];
  const add = (earned: number, reason: string) => {
    points += earned;
    reasons.push(reason);
  };
  if (used.length >= 3) add(used.length >= 5 ? 2 : 1, `${used.length} independent sources`);
  else add(0, `Only ${used.length} ${used.length === 1 ? "source" : "sources"} so far`);
  if (sites >= 3) add(1, `Shows up on ${sites} different sites`);
  if (money >= 1)
    add(money >= 2 ? 2 : 1, money === 1 ? "1 person mentions paying, switching or price" : `${money} people mention paying, switching or price`);
  else add(0, "No one mentions paying for a fix yet");
  if (signals.workaround) add(1, `${signals.workaround} ${signals.workaround === 1 ? "person built a workaround" : "people built workarounds"}`);
  if (trend === "rising") add(1, "Mentions are rising");

  const workarounds = [...new Set(own.filter((complaint) => complaint.signal === "workaround").map((complaint) => complaint.pain))].slice(0, 3);
  return { verdict: points >= 5 ? "strong" : points >= 3 ? "maybe" : "weak", reasons, signals, today: today || undefined, workarounds };
}

export function buildCard(
  problem: DraftProblem,
  complaints: Complaint[],
  sources: ResearchSource[],
  options: { topic: string; now: number; minSources: number; minSites: number; windowDays?: number },
): Card | null {
  const windowDays = options.windowDays ?? WINDOW_DAYS;
  const complaintById = new Map(complaints.map((complaint) => [complaint.id, complaint]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const own = [...new Set(problem.complaintIds)].map((id) => complaintById.get(id)).filter((complaint): complaint is Complaint => Boolean(complaint));
  const used = [...new Set(own.map((complaint) => complaint.sourceId))].map((id) => sourceById.get(id)!).filter(Boolean);
  const sites = new Set(used.map((source) => source.site));
  if (used.length < options.minSources || sites.size < options.minSites) return null;

  used.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const dates = used.map((source) => (source.postedAt ? Date.parse(source.postedAt) / 1000 : NaN)).filter((date) => !Number.isNaN(date));

  // grouping step's clearest quote, else one from the strongest source
  const showable = own.filter((complaint) => complaint.quote.split(/\s+/).length <= MAX_QUOTE_WORDS);
  const quoteFrom =
    showable.find((complaint) => complaint.id === problem.quoteId) ??
    [...showable].sort((a, b) => (sourceById.get(b.sourceId)?.weight ?? 0) - (sourceById.get(a.sourceId)?.weight ?? 0))[0];

  const engagement = used.reduce((sum, source) => sum + (source.engagement?.score ?? 0), 0);
  const recent = dates.filter((date) => date > options.now - 180 * DAY).length;
  const demand = clamp(
    15 + used.length * 7 + (sites.size - 1) * 6 + Math.min(Math.log10(1 + engagement) * 6, 15) + (recent / Math.max(used.length, 1)) * 10,
    5,
    95,
  );
  const engaged = used.filter((source) => source.engagement && source.engagement.score > 2).length;
  const engagementNote = engaged > 0 ? `, ${engaged} with votes or replies` : "";

  const trend = trendOf(dates, options.now, windowDays);
  return {
    slug: `${slugify(problem.headline, 48)}-${Math.random().toString(36).slice(2, 6)}`,
    headline: problem.headline,
    summary: problem.summary,
    who: problem.who,
    category: problem.category,
    trend,
    quote: quoteFrom?.quote ?? "",
    highlight: "",
    query: options.topic,
    evidence: {
      posts: own.length,
      threads: used.length,
      days: windowDays,
      weekly: monthly(dates, options.now, windowDays),
      site: sites.size === 1 ? [...sites][0] : `${sites.size} sites`,
      updatedAt: new Date(options.now * 1000).toISOString(),
    },
    scores: {
      demand: {
        value: demand,
        label: label(demand),
        basis: "data",
        reason: `${used.length} ${used.length === 1 ? "source" : "sources"} on ${sites.size} ${sites.size === 1 ? "site" : "sites"}${engagementNote}, last ${Math.round(windowDays / 30.4)} months`,
      },
      competition: { value: problem.competition.value, label: label(problem.competition.value), basis: "ai", reason: problem.competition.reason },
      difficulty: { value: problem.difficulty.value, label: label(problem.difficulty.value), basis: "ai", reason: problem.difficulty.reason },
    },
    aiSuggestions: [], // only older saved cards have these, ideas now come from generateIdeas
    sources: used.map((source) => ({
      title: source.title,
      url: source.url,
      site: source.site,
      kind: source.kind,
      engagement: source.engagement?.label,
      postedAt: source.postedAt,
    })),
    report: reportFor(own, used, sites.size, trend, problem.today),
    fresh: true,
  };
}
