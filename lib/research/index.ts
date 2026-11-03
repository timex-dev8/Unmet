import "server-only";
import { searchWeb } from "@/lib/exa";
import { searchHN } from "@/lib/hn";
import { EXAMPLE_SEARCHES, type Depth, type ResearchEvent, type ResearchRequest, type ResearchSource } from "@/lib/research-types";
import { formatMrr } from "@/lib/text";
import type { Card } from "@/lib/types";
import { buildCard, kindMix, WINDOW_DAYS } from "./build";
import { competitionFrom, findCompetitors, startupsFor } from "./competitors";
import { extractComplaints, type Complaint } from "./extract";
import { critique, groupComplaints } from "./group";
import { generateIdeas, generateOneIdeaEach } from "./ideas";
import { makePlan } from "./plan";
import { filterSources, pickDiverse } from "./quality";
import { getCached, saveIdeas, setCached } from "./store";
import { COMMUNITY_DOMAINS } from "./sources/sites";
import { searchAppReviews } from "./sources/appstore";
import { searchBluesky } from "./sources/bluesky";
import { searchDiscourse } from "./sources/discourse";
import { searchGithubIssues } from "./sources/github";
import { searchStackExchange } from "./sources/stackexchange";

// Research pipeline: plan → gather from several services → quality filter → read sources for
// first-hand complaints (quotes checked) → group into problems → score from real signals
// → (High) competitor check + strict review. Every search ends with problems and ideas, or with searches to try next.

const DAY = 86400;
/** In gap mode the search for the product itself looks back this far (24 months). */
const PRODUCT_WINDOW_DAYS = 730;
const EXAMPLE_CACHE_MS = 30 * 3600 * 1000;

type Config = {
  openAngles: number;
  communityAngles: number;
  /** Exa searches restricted to reddit.com. Off (0) for now: Exa returns no Reddit text, so these came back empty. */
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
  low: {
    openAngles: 2,
    communityAngles: 1,
    reddit: 0,
    fullText: true,
    stack: false,
    apps: false,
    github: false,
    maxSources: 24,
    batchSize: 12,
    minSources: 3,
    minSites: 2,
    high: false,
  },
  medium: {
    openAngles: 2,
    communityAngles: 2,
    reddit: 0,
    fullText: true,
    stack: true,
    apps: true,
    github: false,
    maxSources: 45,
    batchSize: 10,
    minSources: 3,
    minSites: 2,
    high: false,
  },
  high: {
    openAngles: 4,
    communityAngles: 2,
    reddit: 0,
    fullText: true,
    stack: true,
    apps: true,
    github: true,
    maxSources: 70,
    batchSize: 10,
    minSources: 3,
    minSites: 2,
    high: true,
  },
};

const NAMES: Record<ResearchSource["origin"], string> = {
  web: "the web",
  reddit: "Reddit",
  hn: "Hacker News",
  stackexchange: "Stack Exchange",
  appstore: "App Store reviews",
  github: "GitHub issues",
  bluesky: "Bluesky",
  discourse: "community forums",
};

const CLARIFY_OPTIONS = [
  "Surprise me with a mix of problems",
  "Problems in healthcare",
  "Problems for local shops and trades",
  "Problems for parents and families",
];

/** `signal` aborts when the visitor leaves: the pipeline stops between steps (and inside AI calls). */
export async function runResearch(req: ResearchRequest, emit: (e: ResearchEvent) => void, signal?: AbortSignal, fresh = false, background = fresh) {
  const base = DEPTH[req.depth];
  const check = () => signal?.throwIfAborted();
  const isFirst = req.history.length === 0;
  const key = `v2:${req.depth}:${req.message.toLowerCase().replace(/\s+/g, " ").trim()}`;
  // Same first question at the same depth in the last 6 hours: answer from the cache (lib/research/store.ts).
  // The example searches are refreshed by a daily job, so they keep longer. `fresh` is that job, skipping the cache.
  const isExample = req.depth === "low" && EXAMPLE_SEARCHES.some((e) => e.toLowerCase() === req.message.trim().toLowerCase());
  const hit = isFirst && !fresh ? await getCached(key, isExample ? EXAMPLE_CACHE_MS : undefined) : null;
  if (hit) {
    emit({ ...hit, cached: true });
    return;
  }

  // 1. Plan
  emit({ type: "step", label: "Planning the research" });
  const plan = await makePlan(req, signal);
  check();
  if (plan.mode === "answer" && req.cards.length) {
    emit({ type: "result", answer: plan.answer, cards: [], sourceCount: 0 });
    return;
  }

  // First message with no audience named: ask who to look at instead of searching.
  if ((plan.mode === "clarify" || plan.mode === "discover") && isFirst) {
    const result = {
      type: "result" as const,
      answer: "Happy to help. Ideas work best in a world you know, so who should we look at? Pick one, or type your job or a hobby.",
      cards: [],
      sourceCount: 0,
      suggestions: CLARIFY_OPTIONS,
    };
    await setCached(key, result);
    emit(result);
    return;
  }

  // Discover mode casts a wide net, one search per group of people. A later "clarify" turn is treated as "discover".
  const discover = plan.mode === "discover" || plan.mode === "clarify";
  const cfg: Config = discover ? { ...base, openAngles: Math.max(base.openAngles, 4) } : base;

  const now = Math.floor(Date.now() / 1000);
  const since = now - WINDOW_DAYS * DAY;
  const sinceIso = new Date(since * 1000).toISOString();
  // A product's own name gets a wider net: any site, last 24 months (launch threads, reviews and changelog complaints).
  const wideSinceIso = new Date((now - PRODUCT_WINDOW_DAYS * DAY) * 1000).toISOString();
  const productDomain = plan.product
    ? req.message.match(/\b(?:[a-z0-9-]+\.)+(?:com|io|co|app|ai|dev|net|org|so|xyz|tech|me|sh)\b/i)?.[0].toLowerCase()
    : undefined;

  // 2. Gather from every service that fits this topic, in parallel.
  const open = plan.angles.slice(0, cfg.openAngles);
  const community = cfg.communityAngles
    ? [plan.communityQuery, ...plan.angles.filter((a) => a.type === "review" || a.type === "wish").map((a) => a.query)].slice(0, cfg.communityAngles)
    : [];
  const reddit = [...new Set([plan.communityQuery, ...plan.angles.map((a) => a.query)])].filter(Boolean).slice(0, cfg.reddit);
  const useApps = cfg.apps && plan.segment !== "developer" && plan.appTerms.length > 0;
  const useStack = cfg.stack && plan.stackSites.length > 0 && plan.stackQuery.length > 0;
  // Discourse forums are about products and tools, so they fit business and developer topics.
  const useDiscourse = cfg.stack && plan.segment !== "consumer";
  const useGithub = cfg.github && plan.segment !== "consumer" && plan.githubPhrase.length > 0;

  const jobs: { name: string; run: Promise<Omit<ResearchSource, "id">[]> }[] = [
    ...open.map((a) => ({
      name: NAMES.web,
      run: searchWeb(a.query, a.objective, { since: sinceIso, type: "auto", fullText: cfg.fullText }).then((r) =>
        discover ? r.map((x) => ({ ...x, group: a.query })) : r,
      ),
    })),
    ...(discover
      ? []
      : [
          ...(plan.product
            ? [
                {
                  name: NAMES.web,
                  run: searchWeb(
                    `${plan.product}${productDomain && !plan.product.toLowerCase().includes(productDomain) ? ` ${productDomain}` : ""} review problems complaints`,
                    `Posts, reviews and discussions by people who used ${plan.product}${productDomain ? ` (${productDomain})` : ""}, or compared it with alternatives: what frustrated them.`,
                    { since: wideSinceIso, type: "auto", fullText: cfg.fullText },
                  ),
                },
              ]
            : []),
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
            run: searchWeb(
              q,
              `First-hand Reddit posts and comments where ${plan.audience} describe their own problems, frustrations and workarounds.`,
              {
                since: sinceIso,
                type: "auto",
                fullText: cfg.fullText,
                includeDomains: ["reddit.com"],
                origin: "reddit",
              },
            ),
          })),
          // Hacker News leans technical, so it only runs on developer topics.
          ...(plan.segment === "developer" ? [{ name: NAMES.hn, run: searchHN(plan.hnQuery, since, cfg.high ? 15 : 10) }] : []),
          // Bluesky on every level: free, fast, real people. It matches keywords, so use short queries.
          { name: NAMES.bluesky, run: searchBluesky([plan.hnQuery, plan.communityQuery.split(" ").slice(0, 4).join(" ")], sinceIso) },
          ...(useDiscourse ? [{ name: NAMES.discourse, run: searchDiscourse(plan.hnQuery, sinceIso) }] : []),
          ...(useStack ? [{ name: NAMES.stackexchange, run: searchStackExchange(plan.stackQuery, plan.stackSites, since) }] : []),
          ...(useApps ? [{ name: NAMES.appstore, run: searchAppReviews(plan.appTerms, since) }] : []),
          ...(useGithub ? [{ name: NAMES.github, run: searchGithubIssues(plan.githubPhrase, since) }] : []),
        ]),
  ];
  const startupsJob = cfg.high ? startupsFor(plan.trustmrrCategory) : Promise.resolve([]);

  if (plan.product) emit({ type: "step", label: `Looking for what ${plan.product} users complain about` });
  emit({ type: "step", label: `Searching ${[...new Set(jobs.map((j) => j.name))].join(", ")}` });
  const settled = await Promise.allSettled(jobs.map((j) => j.run));
  check();
  const raw = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (settled.every((r) => r.status === "rejected")) throw new Error("Search failed. Check the EXA_API_KEY and try again.");

  // What each service returned ("Reddit 8, Hacker News 10, App Store reviews failed"), so a quiet failure shows.
  const perService = new Map<string, { n: number; failed: boolean }>();
  settled.forEach((r, i) => {
    const e = perService.get(jobs[i].name) ?? { n: 0, failed: false };
    if (r.status === "fulfilled") e.n += r.value.length;
    else {
      e.failed = true;
      console.warn(`[research] ${jobs[i].name} search failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
    }
    perService.set(jobs[i].name, e);
  });
  const serviceLine = [...perService].map(([name, e]) => (e.failed && !e.n ? `${name} failed` : `${name} ${e.n}`)).join(", ");

  // 3. Quality filter
  const quality = filterSources(raw, plan.product ? PRODUCT_WINDOW_DAYS : WINDOW_DAYS);
  const sources = pickDiverse(quality.kept, cfg.maxSources);
  const rejectedCount = Object.values(quality.rejected).reduce((a, b) => a + b, 0);
  emit({
    type: "step",
    label: `Found ${raw.length} sources (${serviceLine}), kept ${sources.length} after quality checks${rejectedCount ? ` (${quality.rejected.old} too old, ${quality.rejected.untrusted} vendor pages or listicles, ${quality.rejected.duplicate + quality.rejected.thin} duplicates or too thin)` : ""}`,
  });
  if (sources.length === 0) {
    emit({
      type: "result",
      answer: "I couldn't find recent posts from people describing this. These searches may work better:",
      cards: [],
      sourceCount: 0,
      suggestions: plan.suggestions,
    });
    return;
  }

  // 4. Read sources for first-hand complaints
  emit({ type: "step", label: `Reading ${sources.length} sources for first-hand complaints` });
  const extracted = await extractComplaints(sources, {
    topic: plan.topic,
    audience: plan.audience,
    batchSize: cfg.batchSize,
    signal,
    onBatch: (done, total) =>
      total > 1 && emit({ type: "step", label: `Read ${Math.min(done * cfg.batchSize, sources.length)} of ${sources.length} sources` }),
  });
  const withComplaints = new Set(extracted.complaints.map((c) => c.sourceId));
  emit({
    type: "step",
    label: `${extracted.complaints.length} verified complaints from ${withComplaints.size} sources (${extracted.offTopic} off-topic, ${extracted.secondHand} not first-hand, ${extracted.unverified} quotes failed the check)`,
  });
  if (extracted.complaints.length < 1) {
    emit({
      type: "result",
      answer: `I read ${sources.length} recent sources but found no first-hand complaints about this. These searches may work better:`,
      cards: [],
      sourceCount: sources.length,
      mix: mixLine(sources),
      suggestions: plan.suggestions,
    });
    return;
  }

  // 5. Group into problems (+ strict review in High)
  check();
  emit({ type: "step", label: `Grouping ${extracted.complaints.length} complaints into problems` });
  const grouped = await groupComplaints(extracted.complaints, sources, {
    topic: plan.topic,
    request: req.message,
    segment: plan.segment,
    light: fresh,
  });
  let problems = grouped.problems;
  if (cfg.high && problems.length > 1) {
    emit({ type: "step", label: "Reviewing the problems: dropping generic ones, merging duplicates" });
    problems = await critique(problems, extracted.complaints).catch(() => problems);
  }
  check();

  // 6. Build cards with scores from real signals, in three tiers: strong (meets the depth's bar), early (2 sources or one
  // site) and niche (a single source). Each problem gets the strongest tier it qualifies for, and weaker ones are tagged.
  const opts = { topic: plan.topic, now, minSources: cfg.minSources, minSites: cfg.minSites };
  const strong: Card[] = [];
  const early: Card[] = [];
  const niche: Card[] = [];
  const complaintsOf = new Map<string, Complaint[]>(); // card slug → its verified complaints (for ideas)
  const byId = new Map(extracted.complaints.map((c) => [c.id, c]));
  let topSlug = "";
  for (const p of problems) {
    let card = buildCard(p, extracted.complaints, sources, opts);
    if (card) strong.push(card);
    else if ((card = buildCard(p, extracted.complaints, sources, { ...opts, minSources: 2, minSites: 1 })))
      early.push((card = { ...card, signal: "early" }));
    else if ((card = buildCard(p, extracted.complaints, sources, { ...opts, minSources: 1, minSites: 1 })))
      niche.push((card = { ...card, signal: "niche" }));
    if (card && p.isTop && card.signal !== "niche") topSlug = card.slug;
    if (card)
      complaintsOf.set(
        card.slug,
        [...new Set(p.complaintIds)].map((id) => byId.get(id)).filter((c): c is Complaint => Boolean(c)),
      );
  }
  const byDemand = (a: Card, b: Card) => b.scores.demand.value - a.scores.demand.value;
  const cards = [...strong.sort(byDemand), ...early.sort(byDemand)]
    .sort((a, b) => Number(b.slug === topSlug) - Number(a.slug === topSlug)) // the AI's top pick leads, so the answer and first card agree
    .slice(0, 5)
    .concat(niche.sort(byDemand).slice(0, 3));

  // 7. High: who already solves the top problems (web + TrustMRR verified revenue)
  if (cfg.high && cards.length) {
    check();
    emit({ type: "step", label: "Checking who already solves the top problems" });
    const startups = await startupsJob;
    await Promise.all(
      cards.slice(0, 3).map(async (card) => {
        const found = await findCompetitors(card, startups).catch(() => []);
        card.competitors = found;
        const c = competitionFrom(found);
        card.scores.competition = {
          value: c.value,
          label: c.value >= 67 ? "High" : c.value >= 40 ? "Medium" : "Low",
          basis: "data",
          reason: c.reason,
        };
        // A competitor with verified revenue is proof people pay to solve this.
        const paid = found.filter((f) => f.mrr).sort((x, y) => (y.mrr ?? 0) - (x.mrr ?? 0))[0];
        if (paid && card.report) card.report.reasons.push(`Proven market: ${paid.name} earns ${formatMrr(paid.mrr!)}/mo`);
      }),
    );
  }

  // 8. Ideas: turn the strongest problems into product ideas (each cites its complaints).
  // Deep and Deepest give the strongest problems several ideas and check whether each already exists (one Exa search per idea).
  // Every other card (all of them on Quick) gets one idea, from a single AI call.
  const ideaCards = cards.filter((c) => (complaintsOf.get(c.slug)?.length ?? 0) >= 2).slice(0, cfg.high ? 4 : req.depth === "low" ? 0 : 3);
  const singleCards = cards.filter((c) => !ideaCards.includes(c));
  if (cards.length) {
    check();
    emit({ type: "step", label: `Turning ${cards.length === 1 ? "the problem" : `${cards.length} problems`} into product ideas` });
    const onError = (err: unknown) => {
      console.warn("[research] ideas failed:", err instanceof Error ? err.message : err);
      return undefined;
    };
    await Promise.all([
      ...ideaCards.map(async (card, i) => {
        // Someone's own search gets the better model on its top problem; the scheduled jobs stay on the light one.
        card.ideas = await generateIdeas(card, complaintsOf.get(card.slug)!, true, plan.product, i === 0 && !background).catch(onError);
      }),
      generateOneIdeaEach(singleCards, (card) => complaintsOf.get(card.slug)!).catch(onError),
    ]);
  }

  if (cards.length === 0) {
    emit({
      type: "result",
      answer: `I read ${sources.length} recent sources but found no first-hand complaints about this that I could turn into a problem. These searches may work better:`,
      cards: [],
      sourceCount: sources.length,
      mix: mixLine(sources),
      suggestions: plan.suggestions,
    });
    return;
  }

  const answer = [grouped.answer, topSlug ? grouped.whyTop : "", grouped.notFound].filter(Boolean).join(" ");

  check();
  const result = { type: "result" as const, answer, cards, sourceCount: sources.length, mix: mixLine(sources), suggestions: plan.suggestions };
  // Save before answering so a share link works the moment the cards appear.
  // A result missing ideas (the AI was busy) isn't cached, so the next person asking gets a complete one.
  const complete = cards.every((c) => c.ideas?.length);
  await Promise.all([isFirst && complete ? setCached(key, result) : null, saveIdeas(cards)]);
  console.log(
    `[research] ${req.depth} "${plan.topic}": ${raw.length} found, ${sources.length} kept, ${extracted.complaints.length} complaints, ${cards.length} cards, ${jobs.length} searches`,
  );
  emit(result);
}

function mixLine(sources: ResearchSource[]) {
  return `Read ${sources.length} sources: ${kindMix(sources)}`;
}
