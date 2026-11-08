import type { ResearchSource } from "@/lib/research-types";
import type { SourceKind } from "@/lib/types";

const DAY = 86400_000;

// social, video and "we analyzed reddit for you" aggregators aren't first-hand (reddit itself is kept)
const DROP_DOMAIN =
  /(^|\.)(linkedin\.com|facebook\.com|instagram\.com|tiktok\.com|pinterest\.com|youtube\.com|x\.com|twitter\.com|gummysearch\.com|painonsocial\.com|ideabrowser\.com|explodingtopics\.com|redditinsights\.\w+)$/;

// listicles, comparisons and buying guides repackage problems
const LISTICLE =
  /\b\d+\s+(best|top|common|biggest|ways|tips|tools|apps|alternatives|mistakes|reasons|challenges|problems|pain\s*points|examples)\b|ultimate guide|complete guide|how to choose|buyer'?s guide|\bvs\.?\s|pricing|found on reddit/i;

export function kindOf(site: string, url: string): SourceKind {
  if (site === "news.ycombinator.com") return "hn";
  if (site === "apps.apple.com") return "app-review";
  if (/(^|\.)(stackexchange\.com|stackoverflow\.com|superuser\.com|serverfault\.com|askubuntu\.com|quora\.com)$/.test(site)) return "qa";
  if (/(^|\.)(g2\.com|capterra\.com|getapp\.com|trustpilot\.com|softwareadvice\.com)$/.test(site)) return "review";
  if (site === "github.com") return /\/(issues|discussions)\//.test(url) ? "issue" : "blog";
  if (
    /(^|\.)(reddit\.com|indiehackers\.com|producthunt\.com|lobste\.rs|dev\.to)$/.test(site) ||
    /^(community|forum|forums|discuss|discourse)\./.test(site)
  )
    return "forum";
  if (
    /(^|\.)(techcrunch\.com|theverge\.com|nytimes\.com|wsj\.com|bbc\.co\.uk|bbc\.com|cnbc\.com|reuters\.com|bloomberg\.com|theguardian\.com|forbes\.com|businessinsider\.com|axios\.com|wired\.com|arstechnica\.com)$/.test(
      site,
    )
  )
    return "news";
  return "blog";
}

const KIND_WEIGHT: Record<SourceKind, number> = {
  forum: 1,
  qa: 1,
  review: 1,
  hn: 1,
  "app-review": 0.9,
  social: 0.85,
  issue: 0.9,
  blog: 0.5,
  news: 0.4,
};

type QualityReport = { kept: ResearchSource[]; rejected: { old: number; untrusted: number; thin: number; duplicate: number } };

export function filterSources(sources: Omit<ResearchSource, "id">[], windowDays: number): QualityReport {
  const now = Date.now();
  const rejected = { old: 0, untrusted: 0, thin: 0, duplicate: 0 };
  const seenUrl = new Set<string>();
  const seenText = new Set<string>();
  const kept: ResearchSource[] = [];

  for (const s of sources) {
    const kind = s.kind ?? kindOf(s.site, s.url);
    const fingerprint = s.text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 160);
    if (seenUrl.has(s.url) || seenText.has(fingerprint)) {
      rejected.duplicate++;
      continue;
    }
    if (DROP_DOMAIN.test(s.site) || ((kind === "blog" || kind === "news") && LISTICLE.test(s.title))) {
      rejected.untrusted++;
      continue;
    }
    if (s.text.length < (kind === "app-review" || kind === "social" ? 60 : 120)) {
      rejected.thin++;
      continue;
    }
    const posted = s.postedAt ? Date.parse(s.postedAt) : NaN;
    const ageDays = Number.isNaN(posted) ? null : (now - posted) / DAY;
    if (ageDays !== null && ageDays > windowDays) {
      rejected.old++;
      continue;
    }
    seenUrl.add(s.url);
    seenText.add(fingerprint);
    const freshness = ageDays === null ? 0.6 : ageDays <= 180 ? 1.2 : 1;
    const engagement = s.engagement ? 1 + Math.min(Math.log10(1 + s.engagement.score) / 4, 0.5) : 1;
    kept.push({ ...s, kind, id: 0, weight: Math.round(KIND_WEIGHT[kind] * freshness * engagement * 100) / 100 });
  }
  return { kept, rejected };
}

// no service may crowd out the rest (app store reviews can flood a business topic)
const ORIGIN_CAP: Partial<Record<ResearchSource["origin"], number>> = {
  reddit: 14,
  appstore: 8,
  hn: 10,
  stackexchange: 8,
  github: 8,
  bluesky: 10,
  discourse: 8,
};

export function pickDiverse(sources: ResearchSource[], max: number): ResearchSource[] {
  const byOrigin = new Map<string, ResearchSource[]>();
  for (const s of [...sources].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))) {
    const key = s.group ?? s.origin; // discover-mode sources balance by group, a group key has no cap
    const list = byOrigin.get(key) ?? [];
    if (list.length < (s.group ? Infinity : (ORIGIN_CAP[s.origin] ?? Infinity))) list.push(s);
    byOrigin.set(key, list);
  }
  const out: ResearchSource[] = [];
  while (out.length < max && [...byOrigin.values()].some((l) => l.length)) {
    for (const list of byOrigin.values()) {
      const next = list.shift();
      if (next && out.length < max) out.push(next);
    }
  }
  return out.map((s, i) => ({ ...s, id: i + 1 }));
}
