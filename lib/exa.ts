import "server-only";
import Exa from "exa-js";
import type { ResearchSource } from "./research-types";

// Exa web search, following the build-with-exa skill: /search with highlights,
// `objective` because a model writes the query, a hard date window because stale
// evidence is unacceptable for this product, and a user-approved Reddit blocklist.

export function exaConfigured() {
  return Boolean(process.env.EXA_API_KEY);
}

let client: Exa | null = null;
function exa() {
  return (client ??= new Exa(process.env.EXA_API_KEY));
}

// Cost: "lite" is Exa's low-cost search ($4 per 1k vs $7 for "auto"). It accepts fewer
// options, so if Exa rejects the request we retry once with "auto".
const SEARCH_TYPE = process.env.EXA_SEARCH_TYPE || "lite";

export async function searchWeb(
  query: string,
  objective: string,
  opts: { since: string; includeReddit: boolean },
): Promise<Omit<ResearchSource, "id">[]> {
  const request = (type: string) =>
    exa().search(query, {
      type,
      contents: { highlights: true },
      objective,
      startPublishedDate: opts.since,
      ...(opts.includeReddit ? {} : { excludeDomains: ["reddit.com"] }),
    });

  let res;
  try {
    res = await request(SEARCH_TYPE);
  } catch (err) {
    if (SEARCH_TYPE === "auto") throw err;
    console.warn(`[exa] "${SEARCH_TYPE}" search failed, retrying with "auto":`, err instanceof Error ? err.message : err);
    res = await request("auto");
  }

  return res.results
    .map((r) => {
      const text = (r.highlights ?? []).join(" … ").trim();
      const host = hostOf(r.url);
      return { title: r.title?.trim() || host, url: r.url, site: host, postedAt: r.publishedDate, text, origin: "web" as const };
    })
    .filter((r) => r.text.length > 40);
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
