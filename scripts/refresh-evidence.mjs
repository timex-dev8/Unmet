// Refreshes the evidence on the sample cards with real, recent Hacker News data.
// Only the last 60 days count; sources are the most-discussed recent threads.
// Run: npm run refresh-evidence
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/sample-cards.json", import.meta.url);
const API = "https://hn.algolia.com/api/v1";
const DAYS = 60;
const DAY = 86400;

// What to search Hacker News for, per card. Quoted text must match as an exact phrase.
const QUERIES = {
  "flaky-ci-tests": "flaky tests",
  "pet-medication-prices": "pet medication",
  "deposit-deductions": "security deposit",
  "lost-meeting-decisions": '"meeting notes"',
  "dev-laptop-setup": '"dev environment"',
  "scattered-receipts": "receipts taxes",
  "sleep-data-no-action": "sleep tracker",
  "contractor-quotes": "contractor quote",
  "research-tab-overload": '"too many tabs"',
  "freelance-late-invoices": "unpaid invoices",
};

async function hn(path, params) {
  const url = `${API}/${path}?${new URLSearchParams({ ...params, advancedSyntax: "true", typoTolerance: "false" })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN ${res.status} for ${url}`);
  return res.json();
}

function label(value) {
  return value >= 67 ? "High" : value >= 40 ? "Medium" : "Low";
}

async function evidenceFor(query, now) {
  const since = now - DAYS * DAY;

  // All stories and comments mentioning the query in the window.
  const mentions = await hn("search_by_date", {
    query,
    tags: "(story,comment)",
    numericFilters: `created_at_i>${since}`,
    hitsPerPage: "1000",
    attributesToRetrieve: "created_at_i",
  });
  const stories = await hn("search_by_date", {
    query,
    tags: "story",
    numericFilters: `created_at_i>${since}`,
    hitsPerPage: "0",
  });

  // Mentions per week, oldest first.
  const weeks = Math.ceil(DAYS / 7);
  const weekly = Array(weeks).fill(0);
  for (const h of mentions.hits) {
    const i = weeks - 1 - Math.floor((now - h.created_at_i) / (7 * DAY));
    if (i >= 0 && i < weeks) weekly[i]++;
  }

  // Most relevant recent posts or comments (comments are where people complain).
  const top = await hn("search", {
    query,
    tags: "(story,comment)",
    numericFilters: `created_at_i>${since}`,
    hitsPerPage: "3",
  });

  const recent = weekly.slice(-3).reduce((a, b) => a + b, 0);
  const early = weekly.slice(0, 3).reduce((a, b) => a + b, 0);
  const trend = recent > early * 1.25 + 1 ? "rising" : recent < early * 0.8 - 1 ? "falling" : "steady";

  return {
    posts: mentions.nbHits,
    threads: stories.nbHits,
    weekly,
    trend,
    sources: top.hits.map((h) => ({
      title: h.title || `Comment on “${h.story_title ?? "a thread"}”`,
      url: `https://news.ycombinator.com/item?id=${h.objectID}`,
      site: "Hacker News",
      ...(h.title ? { points: h.points ?? 0, comments: h.num_comments ?? 0 } : {}),
      postedAt: h.created_at,
    })),
  };
}

const now = Math.floor(Date.now() / 1000);
const cards = JSON.parse(await readFile(FILE, "utf8"));

for (const card of cards) {
  const query = QUERIES[card.slug];
  if (!query) continue;
  const e = await evidenceFor(query, now);
  const demand = Math.min(95, Math.round(20 + Math.log2(e.posts + 1) * 7));

  card.query = query;
  card.trend = e.trend;
  card.evidence = { posts: e.posts, threads: e.threads, days: DAYS, weekly: e.weekly, site: "Hacker News", updatedAt: new Date(now * 1000).toISOString() };
  card.sources = e.sources;
  card.scores.demand = {
    value: demand,
    label: label(demand),
    basis: "data",
    reason: `${e.posts} mentions in ${DAYS} days, ${e.trend}`,
  };
  console.log(`${card.slug.padEnd(24)} ${String(e.posts).padStart(4)} mentions  ${String(e.threads).padStart(3)} threads  ${e.trend.padEnd(7)} sources: ${e.sources.map((s) => s.postedAt.slice(0, 10)).join(", ")}`);
}

await writeFile(FILE, JSON.stringify(cards, null, 2) + "\n");
console.log(`\nUpdated ${cards.length} cards.`);
