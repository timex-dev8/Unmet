import "server-only";
import { searchWeb } from "@/lib/exa";
import { searchHN } from "@/lib/hn";
import { EXAMPLE_SEARCHES, type Depth, type ResearchEvent, type ResearchRequest, type ResearchSource } from "@/lib/research-types";
import { formatMrr } from "@/lib/text";
import type { Card } from "@/lib/types";
import { buildCard, kindMix, WINDOW_DAYS } from "./build";
import { competitionFrom, findCompetitors, startupsFor } from "./competitors";
import { z } from "zod/v4";
import { generateJson, LlmError } from "@/lib/llm";
import { extractComplaints, fence, type Complaint } from "./extract";
import { HUNCH_SYSTEM } from "./prompts";
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

const DAY = 86400;
// gap mode, the product's own search looks back this far (24 months)
const PRODUCT_WINDOW_DAYS = 730;
const EXAMPLE_CACHE_MS = 30 * 3600 * 1000;

type Config = {
  openAngles: number;
  communityAngles: number;
  // off (0) for now, exa returns no reddit text so these came back empty
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

const FORUMS = "forums & review sites";
const EXA_JOBS = new Set<string>([NAMES.web, NAMES.reddit, FORUMS]);

const CLARIFY_OPTIONS = [
  "Surprise me with a mix of problems",
  "Problems in healthcare",
  "Problems for local shops and trades",
  "Problems for parents and families",
];

const cacheKey = (request: ResearchRequest) => `v8:${request.depth}:${request.message.toLowerCase().replace(/\s+/g, " ").trim()}`;
const isExampleSearch = (request: ResearchRequest) =>
  request.depth === "low" && EXAMPLE_SEARCHES.some((example) => example.toLowerCase() === request.message.trim().toLowerCase());

export async function peekCached(request: ResearchRequest) {
  if (request.history.length > 0) return null;
  return getCached(cacheKey(request), isExampleSearch(request) ? EXAMPLE_CACHE_MS : undefined);
}

export async function runResearch(
  request: ResearchRequest,
  emit: (event: ResearchEvent) => void,
  signal?: AbortSignal,
  fresh = false,
  background = fresh,
) {
  const base = DEPTH[request.depth];
  const check = () => signal?.throwIfAborted();
  const isFirst = request.history.length === 0;
  const key = cacheKey(request);
  // same first question + depth within 6h comes from the cache (research/store.ts)
  // example searches keep longer, fresh = the daily job, skips the cache
  const isExample = isExampleSearch(request);
  const hit = isFirst && !fresh ? await getCached(key, isExample ? EXAMPLE_CACHE_MS : undefined) : null;
  if (hit) {
    emit({ ...hit, cached: true });
    return;
  }

  emit({ type: "step", label: "Planning the research" });
  const plan = await makePlan(request, signal);
  check();
  if (plan.mode === "answer" && request.cards.length) {
    emit({ type: "result", answer: plan.answer, cards: [], sourceCount: 0 });
    return;
  }

  // first message with no audience: ask who instead of searching
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

  // discover casts a wide net, one search per group. a later "clarify" turn counts as discover
  const discover = plan.mode === "discover" || plan.mode === "clarify";
  const config: Config = discover ? { ...base, openAngles: Math.max(base.openAngles, 4) } : base;

  const now = Math.floor(Date.now() / 1000);
  const since = now - WINDOW_DAYS * DAY;
  const sinceIso = new Date(since * 1000).toISOString();
  // a product's own name gets any site, last 24 months
  const wideSinceIso = new Date((now - PRODUCT_WINDOW_DAYS * DAY) * 1000).toISOString();
  const productDomain = plan.product
    ? request.message.match(/\b(?:[a-z0-9-]+\.)+(?:com|io|co|app|ai|dev|net|org|so|xyz|tech|me|sh)\b/i)?.[0].toLowerCase()
    : undefined;

  const open = plan.angles.slice(0, config.openAngles);
  const community = config.communityAngles
    ? [plan.communityQuery, ...plan.angles.filter((angle) => angle.type === "review" || angle.type === "wish").map((angle) => angle.query)].slice(
        0,
        config.communityAngles,
      )
    : [];
  const reddit = [...new Set([plan.communityQuery, ...plan.angles.map((angle) => angle.query)])].filter(Boolean).slice(0, config.reddit);
  const useApps = config.apps && plan.segment !== "developer" && plan.appTerms.length > 0;
  const useStack = config.stack && plan.stackSites.length > 0 && plan.stackQuery.length > 0;
  const useDiscourse = config.stack && plan.segment !== "consumer";
  const useGithub = config.github && plan.segment !== "consumer" && plan.githubPhrase.length > 0;

  const jobs: { name: string; run: Promise<Omit<ResearchSource, "id">[]> }[] = [
    ...open.map((angle) => ({
      name: NAMES.web,
      run: searchWeb(angle.query, angle.objective, { since: sinceIso, type: "auto", fullText: config.fullText }).then((found) =>
        discover ? found.map((source) => ({ ...source, group: angle.query })) : found,
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
                    { since: wideSinceIso, type: "auto", fullText: config.fullText },
                  ),
                },
              ]
            : []),
          ...community.map((query) => ({
            name: FORUMS,
            run: searchWeb(query, `First-hand posts, questions and reviews from ${plan.audience} about their problems.`, {
              since: sinceIso,
              type: "auto",
              fullText: config.fullText,
              includeDomains: COMMUNITY_DOMAINS,
            }),
          })),
          ...reddit.map((query) => ({
            name: NAMES.reddit,
            run: searchWeb(
              query,
              `First-hand Reddit posts and comments where ${plan.audience} describe their own problems, frustrations and workarounds.`,
              {
                since: sinceIso,
                type: "auto",
                fullText: config.fullText,
                includeDomains: ["reddit.com"],
                origin: "reddit",
              },
            ),
          })),
          // hacker news leans technical, developer topics only
          ...(plan.segment === "developer" ? [{ name: NAMES.hn, run: searchHN(plan.hnQuery, since, config.high ? 15 : 10) }] : []),
          // bluesky on every level, free and fast. keyword match so short queries
          { name: NAMES.bluesky, run: searchBluesky([plan.hnQuery, plan.communityQuery.split(" ").slice(0, 4).join(" ")], sinceIso) },
          ...(useDiscourse ? [{ name: NAMES.discourse, run: searchDiscourse(plan.hnQuery, sinceIso) }] : []),
          ...(useStack ? [{ name: NAMES.stackexchange, run: searchStackExchange(plan.stackQuery, plan.stackSites, since) }] : []),
          ...(useApps ? [{ name: NAMES.appstore, run: searchAppReviews(plan.appTerms, since) }] : []),
          ...(useGithub ? [{ name: NAMES.github, run: searchGithubIssues(plan.githubPhrase, since) }] : []),
        ]),
  ];
  const startupsJob = config.high ? startupsFor(plan.trustmrrCategory) : Promise.resolve([]);

  if (plan.product) emit({ type: "step", label: `Looking for what ${plan.product} users complain about` });
  emit({ type: "step", label: `Searching ${[...new Set(jobs.map((job) => job.name))].join(", ")}` });
  const settled = await Promise.allSettled(jobs.map((job) => job.run));
  check();
  const raw = settled.flatMap((outcome) => (outcome.status === "fulfilled" ? outcome.value : []));
  if (settled.every((outcome) => outcome.status === "rejected")) throw new Error("Search failed. Check the EXA_API_KEY and try again.");

  const perService = new Map<string, { count: number; failed: boolean }>();
  settled.forEach((outcome, i) => {
    const service = perService.get(jobs[i].name) ?? { count: 0, failed: false };
    if (outcome.status === "fulfilled") service.count += outcome.value.length;
    else {
      service.failed = true;
      console.warn(`[research] ${jobs[i].name} search failed:`, outcome.reason instanceof Error ? outcome.reason.message : outcome.reason);
    }
    perService.set(jobs[i].name, service);
  });
  const serviceLine = [...perService]
    .map(([name, service]) => (service.failed && !service.count ? `${name} failed` : `${name} ${service.count}`))
    .join(", ");

  const windowDays = plan.product ? PRODUCT_WINDOW_DAYS : WINDOW_DAYS;
  const quality = filterSources(raw, windowDays);
  const sources = pickDiverse(quality.kept, config.maxSources);
  const rejectedCount = Object.values(quality.rejected).reduce((total, count) => total + count, 0);
  emit({
    type: "step",
    label: `Found ${raw.length} sources (${serviceLine}), kept ${sources.length} after quality checks${rejectedCount ? ` (${quality.rejected.old} too old, ${quality.rejected.untrusted} vendor pages or listicles, ${quality.rejected.duplicate + quality.rejected.thin} duplicates or too thin)` : ""}`,
  });
  if (sources.length === 0) {
    // an outage isn't nobody complaining. bluesky etc swallow errors so look at exa alone
    const exaResults = settled.filter((_, i) => EXA_JOBS.has(jobs[i].name));
    if (exaResults.length && exaResults.every((outcome) => outcome.status === "rejected"))
      throw new Error("Search failed. Check the EXA_API_KEY and try again.");
    emit({
      type: "result",
      answer: await hunch(plan.topic, request.message, signal),
      cards: [],
      sourceCount: 0,
      suggestions: plan.suggestions,
    });
    return;
  }

  emit({ type: "step", label: `Reading ${sources.length} sources for first-hand complaints` });
  const extracted = await extractComplaints(sources, {
    topic: plan.topic,
    audience: plan.audience,
    batchSize: config.batchSize,
    signal,
    onBatch: (done, total) =>
      total > 1 && emit({ type: "step", label: `Read ${Math.min(done * config.batchSize, sources.length)} of ${sources.length} sources` }),
  });
  const withComplaints = new Set(extracted.complaints.map((complaint) => complaint.sourceId));
  emit({
    type: "step",
    label: `${extracted.complaints.length} verified complaints from ${withComplaints.size} sources (${extracted.offTopic} off-topic, ${extracted.secondHand} not first-hand, ${extracted.unverified} quotes failed the check)`,
  });
  if (extracted.complaints.length < 1) {
    // unread batches may have held complaints, no proof nobody complains
    if (extracted.failedBatches) throw new LlmError("The AI was too busy to read the sources. Try again in a minute.", "rate_limited");
    emit({
      type: "result",
      answer: await hunch(plan.topic, request.message, signal),
      cards: [],
      sourceCount: sources.length,
      mix: mixLine(sources),
      suggestions: plan.suggestions,
    });
    return;
  }

  check();
  emit({ type: "step", label: `Grouping ${extracted.complaints.length} complaints into problems` });
  const grouped = await groupComplaints(extracted.complaints, sources, {
    topic: plan.topic,
    request: request.message,
    segment: plan.segment,
    light: background,
    signal,
  });
  let problems = grouped.problems;
  if (config.high && problems.length > 1) {
    emit({ type: "step", label: "Reviewing the problems: dropping generic ones, merging duplicates" });
    problems = await critique(problems, extracted.complaints, { light: background, signal }).catch(() => problems);
  }
  check();

  // three tiers: strong (meets the depth's bar), early (2 sources or one site), niche (single source)
  // each problem gets the best tier it fits, weaker ones are tagged
  const cardOptions = { topic: plan.topic, now, minSources: config.minSources, minSites: config.minSites, windowDays };
  const strong: Card[] = [];
  const early: Card[] = [];
  const niche: Card[] = [];
  const complaintsOf = new Map<string, Complaint[]>(); // card slug -> verified complaints (for ideas)
  const byId = new Map(extracted.complaints.map((complaint) => [complaint.id, complaint]));
  let topSlug = "";
  for (const problem of problems) {
    let card = buildCard(problem, extracted.complaints, sources, cardOptions);
    if (card) strong.push(card);
    else if ((card = buildCard(problem, extracted.complaints, sources, { ...cardOptions, minSources: 2, minSites: 1 })))
      early.push((card = { ...card, signal: "early" }));
    else if ((card = buildCard(problem, extracted.complaints, sources, { ...cardOptions, minSources: 1, minSites: 1 })))
      niche.push((card = { ...card, signal: "niche" }));
    if (card && problem.isTop && card.signal !== "niche") topSlug = card.slug;
    if (card)
      complaintsOf.set(
        card.slug,
        [...new Set(problem.complaintIds)].map((id) => byId.get(id)).filter((complaint): complaint is Complaint => Boolean(complaint)),
      );
  }
  const byDemand = (a: Card, b: Card) => b.scores.demand.value - a.scores.demand.value;
  const cards = [...strong.sort(byDemand), ...early.sort(byDemand)]
    .sort((a, b) => Number(b.slug === topSlug) - Number(a.slug === topSlug)) // ai's top pick leads so the answer and first card agree
    .slice(0, 5)
    .concat(niche.sort(byDemand).slice(0, 3));

  if (config.high && cards.length) {
    check();
    emit({ type: "step", label: "Checking who already solves the top problems" });
    const startups = await startupsJob;
    await Promise.all(
      cards.slice(0, 3).map(async (card) => {
        const found = await findCompetitors(card, startups, signal).catch(() => null);
        if (!found) return; // search failed, keep the ai estimate
        card.competitors = found;
        const competition = competitionFrom(found);
        card.scores.competition = {
          value: competition.value,
          label: competition.value >= 67 ? "High" : competition.value >= 40 ? "Medium" : "Low",
          basis: "data",
          reason: competition.reason,
        };
        const paid = found.filter((competitor) => competitor.mrr).sort((a, b) => (b.mrr ?? 0) - (a.mrr ?? 0))[0];
        if (paid && card.report) card.report.reasons.push(`Proven market: ${paid.name} earns ${formatMrr(paid.mrr!)}/mo`);
      }),
    );
  }

  // strong problems get several ideas on deep/deepest, checked for existing products (one exa search per idea)
  // the rest get one idea from a single ai call
  const ideaCards = cards
    .filter((card) => (complaintsOf.get(card.slug)?.length ?? 0) >= 2)
    .slice(0, config.high ? 4 : request.depth === "low" ? 0 : 3);
  const singleCards = cards.filter((card) => !ideaCards.includes(card));
  if (cards.length) {
    check();
    emit({ type: "step", label: `Turning ${cards.length === 1 ? "the problem" : `${cards.length} problems`} into product ideas` });
    const onError = (err: unknown) => {
      console.warn("[research] ideas failed:", err instanceof Error ? err.message : err);
      return undefined;
    };
    await Promise.all([
      ...ideaCards.map(async (card, i) => {
        // own search gets the better model on its top problem, scheduled jobs stay light
        card.ideas = await generateIdeas(card, complaintsOf.get(card.slug)!, true, plan.product, i === 0 && !background, signal).catch(onError);
      }),
      generateOneIdeaEach(singleCards, (card) => complaintsOf.get(card.slug)!, signal).catch(onError),
    ]);
  }

  if (cards.length === 0) {
    emit({
      type: "result",
      answer: await hunch(plan.topic, request.message, signal),
      cards: [],
      sourceCount: sources.length,
      mix: mixLine(sources),
      suggestions: plan.suggestions,
    });
    return;
  }

  const answer = [grouped.answer, [topSlug ? grouped.whyTop : "", grouped.notFound].filter(Boolean).join(" ")].filter(Boolean).join("\n\n");

  check();
  const result = { type: "result" as const, answer, cards, sourceCount: sources.length, mix: mixLine(sources), suggestions: plan.suggestions };
  // save before answering so share links work right away
  // results missing ideas or sources (ai busy) aren't cached
  const complete = cards.every((card) => card.ideas?.length) && !extracted.failedBatches;
  await Promise.all([isFirst && complete ? setCached(key, result) : null, saveIdeas(cards)]);
  console.log(
    `[research] ${request.depth} "${plan.topic}": ${raw.length} found, ${sources.length} kept, ${extracted.complaints.length} complaints, ${cards.length} cards, ${jobs.length} searches`,
  );
  emit(result);
}

function mixLine(sources: ResearchSource[]) {
  return `Read ${sources.length} sources: ${kindMix(sources)}`;
}

const HunchSchema = z.object({
  answer: z.array(z.string()).describe("Two paragraphs"),
  hunches: z.array(z.object({ title: z.string(), why: z.string(), test: z.string() })).max(3),
});

// no usable complaints: think with the person, labelled as unproven hunches
async function hunch(topic: string, asked: string, signal?: AbortSignal) {
  const fallback = "People aren't complaining about this much online yet. These searches may find more:";
  try {
    const response = await generateJson(HunchSchema, {
      system: HUNCH_SYSTEM,
      prompt: `Topic: ${topic}\nThe person asked: <quote>${fence(asked.slice(0, 300))}</quote>`,
      light: true,
      temperature: 0.9,
      signal,
    });
    const ideas = response.hunches.map((item) => `• ${item.title}. ${item.why} Test it: ${item.test}`).join("\n");
    return [response.answer.join("\n\n"), ideas && `Hunches, not proof yet:\n${ideas}`, "These searches may find real complaints:"]
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return fallback;
  }
}
