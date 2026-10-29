import "server-only";
import { z } from "zod/v4";
import { searchHN } from "./hn";
import { searchWeb } from "./exa";
import { generateJson } from "./llm";
import type { ResearchEvent, ResearchRequest, ResearchSource } from "./research-types";
import { CATEGORIES, type Card, type Score, type Trend } from "./types";

// Research pipeline: plan searches → search the web + Hacker News → AI groups real complaints
// into problems → the server checks every quote and computes every number.

const DAY = 86400;
const WINDOW_DAYS = 365;
const MAX_SOURCES = 32;
const MAX_QUOTE_WORDS = 15;

type Emit = (e: ResearchEvent) => void;

// ---------- Step 1: plan ----------

const PlanSchema = z.object({
  mode: z.enum(["search", "answer"]),
  topic: z.string().describe("Short topic, 2-5 words, e.g. 'barbershop owners'"),
  searches: z
    .array(z.object({ query: z.string(), objective: z.string() }))
    .max(4) // asked for 2; tolerate a bit more and trim in code rather than fail the request
    .describe("Exactly 2 web searches that would surface first-hand complaints. Empty when mode is 'answer'."),
  answer: z.string().describe("Only for mode 'answer': reply using only the ideas already found. Otherwise empty."),
});

const PLAN_SYSTEM = `You plan research for Unmet, a tool that finds real complaints and unmet needs people post online and turns them into startup ideas.
Decide the mode:
- "search" when the user names a market, audience or problem space that needs fresh evidence.
- "answer" when the user asks about ideas already found in this conversation (for example "compare #1 and #2", "which is easiest"). Answer only from those ideas; if they don't cover the question, choose "search" instead.
For "search", write 2 different searches phrased like a search box entry, aimed at places people complain: forums, reviews, community posts, Q&A sites, blogs by practitioners.
Each objective says what to rank first (first-hand frustrations, workarounds, things people wish existed) and what to skip (marketing pages, listicles, vendor sales copy).`;

// ---------- Step 3: group and write ----------

const WriteSchema = z.object({
  answer: z.string().describe("2-4 sentences summarizing what people struggle with. Mention only what the sources show."),
  problems: z
    .array(
      z.object({
        headline: z.string().describe("The problem in under 10 words, plain language"),
        summary: z.string().describe("Two short sentences in your own words"),
        who: z.string().describe("Who has this problem"),
        category: z.enum(CATEGORIES),
        evidence: z
          .array(
            z.object({
              source: z.number().int().describe("The [id] of the source"),
              quote: z.string().describe("Exact words copied from that source's text, under 15 words"),
            }),
          )
          .min(1)
          .max(6),
        competition: z.object({ value: z.number().min(0).max(100), reason: z.string() }),
        difficulty: z.object({ value: z.number().min(0).max(100), reason: z.string() }),
        ideas: z.array(z.object({ title: z.string(), text: z.string() })).max(3),
      }),
    )
    .max(6),
});

const WRITE_SYSTEM = `You turn source excerpts into problem cards for Unmet.
Rules:
- Use only complaints, frustrations, workarounds or wishes that appear in the sources. Ignore marketing, news and how-to content.
- Group sources that describe the same underlying problem. A problem needs at least 2 different sources; skip one-offs.
- Every evidence quote must be copied word-for-word from the text of the source it cites, under 15 words. Never paraphrase inside a quote. If you can't quote it exactly, leave that source out.
- Write headline, summary and who in your own words. Never copy long passages.
- Competition and difficulty are your estimates (0-100) with a one-line reason.
- Ideas are possible products, clearly your suggestions.
- If the sources show no real complaints, return an empty problems list and say so in the answer.`;

// ---------- Helpers ----------

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9'" ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function slugify(text: string) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

const label = (v: number): Score["label"] => (v >= 67 ? "High" : v >= 40 ? "Medium" : "Low");

function trendOf(dates: number[], now: number): Trend {
  const half = now - (WINDOW_DAYS / 2) * DAY;
  const recent = dates.filter((d) => d >= half).length;
  const older = dates.length - recent;
  if (dates.length < 3) return "steady";
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

function toCard(p: z.infer<typeof WriteSchema>["problems"][number], sources: ResearchSource[], topic: string, now: number): Card | null {
  const byId = new Map(sources.map((s) => [s.id, s]));

  // Keep only quotes that really appear in the cited source.
  const verified = p.evidence.filter((ev) => {
    const src = byId.get(ev.source);
    const words = ev.quote.trim().split(/\s+/).length;
    return src && words <= MAX_QUOTE_WORDS && words >= 3 && norm(src.text).includes(norm(ev.quote));
  });
  const used = [...new Set(verified.map((v) => v.source))].map((id) => byId.get(id)!);
  if (used.length < 2) return null; // not a repeated problem, or the AI couldn't back it up

  const dates = used.map((s) => (s.postedAt ? Date.parse(s.postedAt) / 1000 : NaN)).filter((d) => !Number.isNaN(d));
  const demand = Math.min(95, 25 + used.length * 12);
  const sites = new Set(used.map((s) => s.site));

  return {
    slug: slugify(p.headline),
    headline: p.headline,
    summary: p.summary,
    who: p.who,
    category: p.category,
    trend: trendOf(dates, now),
    quote: verified[0].quote.trim(),
    highlight: "",
    query: topic,
    evidence: {
      posts: verified.length,
      threads: used.length,
      days: WINDOW_DAYS,
      weekly: monthly(dates, now),
      site: sites.size === 1 ? [...sites][0] : `${sites.size} sites`,
      updatedAt: new Date(now * 1000).toISOString(),
    },
    scores: {
      demand: { value: demand, label: label(demand), basis: "data", reason: `${used.length} separate sources in the last 12 months` },
      competition: { value: p.competition.value, label: label(p.competition.value), basis: "ai", reason: p.competition.reason },
      difficulty: { value: p.difficulty.value, label: label(p.difficulty.value), basis: "ai", reason: p.difficulty.reason },
    },
    aiSuggestions: p.ideas,
    sources: used.map((s) => ({ title: s.title, url: s.url, site: s.site, postedAt: s.postedAt })),
    fresh: true,
  };
}

// ---------- Cache (in memory for now; Supabase later) ----------

const cache = new Map<string, { at: number; value: Extract<ResearchEvent, { type: "result" }> }>();
const CACHE_MS = 6 * 3600 * 1000;

// ---------- Pipeline ----------

export async function runResearch(req: ResearchRequest, emit: Emit) {
  const isFirst = req.history.length === 0;
  const key = `${req.includeReddit ? "r" : "-"}:${norm(req.message)}`;
  const hit = isFirst ? cache.get(key) : undefined;
  if (hit && Date.now() - hit.at < CACHE_MS) {
    emit({ ...hit.value, cached: true });
    return;
  }

  emit({ type: "step", label: "Planning searches" });
  const context = [
    req.history.length ? `Conversation so far:\n${req.history.map((t) => `${t.role}: ${t.text}`).join("\n")}` : "",
    req.cards.length ? `Ideas already found:\n${req.cards.map((c, i) => `#${i + 1} ${c.headline}: ${c.summary}`).join("\n")}` : "",
    `New message: ${req.message}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const plan = await generateJson(PlanSchema, { system: PLAN_SYSTEM, prompt: context, timeoutMs: 15_000 });

  if (plan.mode === "answer" && req.cards.length) {
    emit({ type: "result", answer: plan.answer, cards: [], sourceCount: 0 });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const since = now - WINDOW_DAYS * DAY;
  // Each Exa search costs money, so cap it at 2 per research.
  const searches = (plan.searches.length ? plan.searches : [{ query: req.message, objective: "First-hand complaints and unmet needs" }]).slice(0, 2);

  emit({ type: "step", label: `Searching the web: ${searches.map((s) => `“${s.query}”`).join(", ")}` });
  const results = await Promise.allSettled([
    ...searches.map((s) =>
      searchWeb(s.query, s.objective, { since: new Date(since * 1000).toISOString(), includeReddit: req.includeReddit }),
    ),
    searchHN(plan.topic, since),
  ]);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length === results.length) throw new Error("Web search failed. Check the EXA_API_KEY and try again.");

  // Merge, de-duplicate by URL, number them for the AI.
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const s of r.value) {
      if (seen.has(s.url) || sources.length >= MAX_SOURCES) continue;
      seen.add(s.url);
      sources.push({ ...s, id: sources.length + 1, text: s.text.slice(0, 900) });
    }
  }
  emit({ type: "step", label: `Reading ${sources.length} pages from the last 12 months` });

  if (sources.length === 0) {
    emit({ type: "result", answer: `I couldn't find recent posts about “${plan.topic}”. Try a narrower or different wording.`, cards: [], sourceCount: 0 });
    return;
  }

  emit({ type: "step", label: "Grouping complaints into problems" });
  const written = await generateJson(WriteSchema, {
    timeoutMs: 45_000,
    system: WRITE_SYSTEM,
    prompt: `Topic: ${plan.topic}\nUser asked: ${req.message}\n\nSources:\n${sources
      .map((s) => `[${s.id}] ${s.title} (${s.site}${s.postedAt ? `, ${s.postedAt.slice(0, 10)}` : ""})\n${s.text}`)
      .join("\n\n")}`,
  });

  const cards = written.problems.map((p) => toCard(p, sources, plan.topic, now)).filter((c): c is Card => c !== null);
  const answer =
    cards.length || written.problems.length === 0
      ? written.answer
      : `${written.answer} I couldn't verify the quotes for these problems against their sources, so I left them out.`;

  const result = { type: "result" as const, answer, cards, sourceCount: sources.length };
  if (isFirst && cards.length) cache.set(key, { at: Date.now(), value: result });
  emit(result);
}
