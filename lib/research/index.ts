import "server-only";
import { searchWeb } from "@/lib/exa";
import { searchHN } from "@/lib/hn";
import type { Depth, ResearchEvent, ResearchRequest, ResearchSource } from "@/lib/research-types";
import type { Card } from "@/lib/types";
import { buildCard, kindMix, medianAgeMonths, WINDOW_DAYS } from "./build";
import { competitionFrom, findCompetitors, startupsFor } from "./competitors";
import { extractComplaints } from "./extract";
import { critique, groupComplaints } from "./group";
import { makePlan } from "./plan";
import { filterSources, pickDiverse } from "./quality";
import { COMMUNITY_DOMAINS } from "./sources/sites";
import { searchAppReviews } from "./sources/appstore";
import { searchGithubIssues } from "./sources/github";
import { searchStackExchange } from "./sources/stackexchange";

// Research pipeline: plan → gather from several services → quality filter → read sources for
// first-hand complaints (quotes checked) → group into problems → score from real signals
// → (High) competitor check + strict review.

const DAY = 86400;

type Config = {
  exaType: "lite" | "auto";
  openAngles: number;
  communityAngles: number;
  /** Exa searches restricted to reddit.com. */
  reddit: number;
  fullText: boolean;
  stack: boolean;
  apps: boolean;
  github: boolean;
  maxSources: number;
  batchSize: number;
  minSources: number;
  minSites: number;
  high: boolean;
};

const DEPTH: Record<Depth, Config> = {
  low: { exaType: "lite", openAngles: 2, communityAngles: 0, reddit: 1, fullText: false, stack: false, apps: false, github: false, maxSources: 24, batchSize: 12, minSources: 2, minSites: 1, high: false },
  medium: { exaType: "auto", openAngles: 2, communityAngles: 2, reddit: 2, fullText: true, stack: true, apps: true, github: false, maxSources: 45, batchSize: 10, minSources: 3, minSites: 2, high: false },
  high: { exaType: "auto", openAngles: 4, communityAngles: 2, reddit: 3, fullText: true, stack: true, apps: true, github: true, maxSources: 70, batchSize: 10, minSources: 3, minSites: 2, high: true },
};

const NAMES: Record<ResearchSource["origin"], string> = {
  web: "the web",
  reddit: "Reddit",
  hn: "Hacker News",
  stackexchange: "Stack Exchange",
  appstore: "App Store reviews",
  github: "GitHub issues",
};

// In-memory cache per server instance (Supabase later).
const cache = new Map<string, { at: number; value: Extract<ResearchEvent, { type: "result" }> }>();
const CACHE_MS = 6 * 3600 * 1000;

export async function runResearch(req: ResearchRequest, emit: (e: ResearchEvent) => void) {
  const cfg = DEPTH[req.depth];
  const isFirst = req.history.length === 0;
  const key = `${req.depth}:${req.message.toLowerCase().replace(/\s+/g, " ").trim()}`;
  const hit = isFirst ? cache.get(key) : undefined;
  if (hit && Date.now() - hit.at < CACHE_MS) {
    emit({ ...hit.value, cached: true });
    return;
  }

  // 1. Plan
  emit({ type: "step", label: "Planning the research" });
  const plan = await makePlan(req);
  if (plan.mode === "answer" && req.cards.length) {
    emit({ type: "result", answer: plan.answer, cards: [], sourceCount: 0 });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const since = now - WINDOW_DAYS * DAY;
  const sinceIso = new Date(since * 1000).toISOString();

  // 2. Gather from every service that fits this topic, in parallel.
  const open = plan.angles.slice(0, cfg.openAngles);
  const community = cfg.communityAngles
    ? [plan.communityQuery, ...plan.angles.filter((a) => a.type === "review" || a.type === "wish").map((a) => a.query)].slice(0, cfg.communityAngles)
    : [];
  const reddit = [...new Set([plan.communityQuery, ...plan.angles.map((a) => a.query)])].filter(Boolean).slice(0, cfg.reddit);
  const useApps = cfg.apps && plan.segment !== "developer" && plan.appTerms.length > 0;
  const useStack = cfg.stack && plan.stackSites.length > 0 && plan.stackQuery.length > 0;
  const useGithub = cfg.github && plan.segment !== "consumer" && plan.githubPhrase.length > 0;

  const jobs: { name: string; run: Promise<Omit<ResearchSource, "id">[]> }[] = [
    ...open.map((a) => ({ name: NAMES.web, run: searchWeb(a.query, a.objective, { since: sinceIso, type: cfg.exaType, fullText: cfg.fullText }) })),
    ...community.map((q) => ({
      name: "forums & review sites",
      run: searchWeb(q, `First-hand posts, questions and reviews from ${plan.audience} about their problems.`, {
        since: sinceIso,
        type: "auto",
        fullText: cfg.fullText,
        includeDomains: COMMUNITY_DOMAINS,
      }),
    })),
    ...reddit.map((q) => ({
      name: NAMES.reddit,
      run: searchWeb(q, `First-hand Reddit posts and comments where ${plan.audience} describe their own problems, frustrations and workarounds.`, {
        since: sinceIso,
        type: "auto",
        fullText: cfg.fullText,
        includeDomains: ["reddit.com"],
        origin: "reddit",
      }),
    })),
    // Hacker News rarely discusses consumer topics (pets, salons…), so it only joins those in High.
    ...(plan.segment !== "consumer" || cfg.high ? [{ name: NAMES.hn, run: searchHN(plan.hnQuery, since, cfg.high ? 15 : 10) }] : []),
    ...(useStack ? [{ name: NAMES.stackexchange, run: searchStackExchange(plan.stackQuery, plan.stackSites, since) }] : []),
    ...(useApps ? [{ name: NAMES.appstore, run: searchAppReviews(plan.appTerms, since) }] : []),
    ...(useGithub ? [{ name: NAMES.github, run: searchGithubIssues(plan.githubPhrase, since) }] : []),
  ];
  const startupsJob = cfg.high ? startupsFor(plan.trustmrrCategory) : Promise.resolve([]);

  emit({ type: "step", label: `Searching ${[...new Set(jobs.map((j) => j.name))].join(", ")}` });
  const settled = await Promise.allSettled(jobs.map((j) => j.run));
  const raw = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (settled.every((r) => r.status === "rejected")) throw new Error("Search failed. Check the EXA_API_KEY and try again.");

  // 3. Quality filter
  const quality = filterSources(raw, WINDOW_DAYS);
  const sources = pickDiverse(quality.kept, cfg.maxSources);
  const rejectedCount = Object.values(quality.rejected).reduce((a, b) => a + b, 0);
  emit({
    type: "step",
    label: `Found ${raw.length} sources, kept ${sources.length} after quality checks${rejectedCount ? ` (${quality.rejected.old} too old, ${quality.rejected.untrusted} vendor pages or listicles, ${quality.rejected.duplicate + quality.rejected.thin} duplicates or too thin)` : ""}`,
  });
  if (sources.length === 0) {
    emit({ type: "result", answer: `I couldn't find recent first-hand posts about “${plan.topic}”. Try different wording or a narrower audience.`, cards: [], sourceCount: 0 });
    return;
  }

  // 4. Read sources for first-hand complaints
  emit({ type: "step", label: `Reading ${sources.length} sources for first-hand complaints` });
  const extracted = await extractComplaints(sources, {
    topic: plan.topic,
    audience: plan.audience,
    batchSize: cfg.batchSize,
    onBatch: (done, total) => total > 1 && emit({ type: "step", label: `Read ${Math.min(done * cfg.batchSize, sources.length)} of ${sources.length} sources` }),
  });
  const withComplaints = new Set(extracted.complaints.map((c) => c.sourceId));
  emit({
    type: "step",
    label: `${extracted.complaints.length} verified complaints from ${withComplaints.size} sources (${extracted.offTopic} off-topic, ${extracted.secondHand} not first-hand, ${extracted.unverified} quotes failed the check)`,
  });
  if (extracted.complaints.length < 2) {
    emit({
      type: "result",
      answer: `I read ${sources.length} recent sources about “${plan.topic}” but found too few first-hand complaints to form a problem. Try a more specific audience or problem.`,
      cards: [],
      sourceCount: sources.length,
      mix: mixLine(sources, now),
    });
    return;
  }

  // 5. Group into problems (+ strict review in High)
  emit({ type: "step", label: `Grouping ${extracted.complaints.length} complaints into problems` });
  const grouped = await groupComplaints(extracted.complaints, sources, { topic: plan.topic, request: req.message });
  let problems = grouped.problems;
  if (cfg.high && problems.length > 1) {
    emit({ type: "step", label: "Reviewing the problems: dropping generic ones, merging duplicates" });
    problems = await critique(problems, extracted.complaints).catch(() => problems);
  }

  // 6. Build cards with scores from real signals. Problems that meet the bar come first;
  // ones backed by exactly 2 sources follow as clearly tagged "early signals".
  const opts = { topic: plan.topic, now, minSources: cfg.minSources, minSites: cfg.minSites };
  const strong: Card[] = [];
  const early: Card[] = [];
  for (const p of problems) {
    const card = buildCard(p, extracted.complaints, sources, opts);
    if (card) strong.push(card);
    else if (cfg.minSources > 2) {
      const weak = buildCard(p, extracted.complaints, sources, { ...opts, minSources: 2, minSites: 1 });
      if (weak) early.push({ ...weak, signal: "early" });
    }
  }
  const byDemand = (a: Card, b: Card) => b.scores.demand.value - a.scores.demand.value;
  const cards = [...strong.sort(byDemand), ...early.sort(byDemand)].slice(0, 6);

  // 7. High: who already solves the top problems (web + TrustMRR verified revenue)
  if (cfg.high && cards.length) {
    emit({ type: "step", label: "Checking who already solves the top problems" });
    const startups = await startupsJob;
    await Promise.all(
      cards.slice(0, 3).map(async (card) => {
        const found = await findCompetitors(card, startups).catch(() => []);
        card.competitors = found;
        const c = competitionFrom(found);
        card.scores.competition = { value: c.value, label: c.value >= 67 ? "High" : c.value >= 40 ? "Medium" : "Low", basis: "data", reason: c.reason };
      }),
    );
  }

  if (cards.length === 0) {
    emit({
      type: "result",
      answer: `I read ${sources.length} recent sources and found ${extracted.complaints.length} first-hand complaints about “${plan.topic}”, but none came up in two different sources yet, so there’s no card.${req.depth === "high" ? " Try a more specific audience." : " Try Medium or High to search more places."}`,
      cards: [],
      sourceCount: sources.length,
      mix: mixLine(sources, now),
    });
    return;
  }

  const dropped = problems.length - cards.length;
  const earlyCount = cards.filter((c) => c.signal === "early").length;
  const notes = [
    grouped.answer,
    earlyCount
      ? `${earlyCount === cards.length ? "All" : earlyCount} of these ${earlyCount === 1 ? "is an early signal" : "are early signals"}: backed by only two sources, or by posts from a single site.`
      : "",
    dropped > 0 ? `${dropped} more ${dropped === 1 ? "problem was" : "problems were"} left out for having too little independent evidence.` : "",
    grouped.notFound,
  ].filter(Boolean);

  const result = { type: "result" as const, answer: notes.join(" "), cards, sourceCount: sources.length, mix: mixLine(sources, now) };
  if (isFirst && cards.length) cache.set(key, { at: Date.now(), value: result });
  console.log(`[research] ${req.depth} "${plan.topic}": ${raw.length} found, ${sources.length} kept, ${extracted.complaints.length} complaints, ${cards.length} cards`);
  emit(result);
}

function mixLine(sources: ResearchSource[], now: number) {
  const age = medianAgeMonths(sources, now);
  return `Read ${sources.length} sources: ${kindMix(sources)}${age !== null ? ` · median age ${age === 0 ? "under a month" : `${age} ${age === 1 ? "month" : "months"}`}` : ""}`;
}
