import "server-only";
import Exa from "exa-js";
import type { ResearchSource } from "./research-types";

// Exa web search, following the build-with-exa skill: /search, `objective` because a model
// writes the query, and a hard 12-month window because stale evidence is unacceptable here.
// Reddit is searched through Exa's index (its own job in lib/research/index.ts), never scraped directly.

export function exaConfigured() {
  return Boolean(process.env.EXA_API_KEY);
}

let client: Exa | null = null;
function exa() {
  return (client ??= new Exa(process.env.EXA_API_KEY));
}

export type WebSearchOptions = {
  since: string;
  /** "lite" is cheap ($4/1k); "auto" finds better pages ($7/1k). */
  type: "lite" | "auto";
  /** User-approved list of community and review sites (see lib/research/sources/sites.ts). */
  includeDomains?: string[];
  /** Full page text (up to ~2,500 chars) so quotes can be checked; otherwise short highlights. */
  fullText?: boolean;
  /** Which service the results count as (Reddit gets its own share of the source list). */
  origin?: "web" | "reddit";
};

type RawSource = Omit<ResearchSource, "id">;

export async function searchWeb(query: string, objective: string, opts: WebSearchOptions): Promise<RawSource[]> {
  const contents = opts.fullText ? { text: { maxCharacters: 2500 } } : { highlights: true as const };
  const request = (type: string) =>
    exa().search(query, {
      type,
      contents,
      objective,
      startPublishedDate: opts.since,
      ...(opts.includeDomains ? { includeDomains: opts.includeDomains } : {}),
    });

  let res;
  try {
    res = await request(opts.type);
  } catch (err) {
    if (opts.type === "auto") throw err;
    console.warn(`[exa] "${opts.type}" search failed, retrying with "auto":`, err instanceof Error ? err.message : err);
    res = await request("auto");
  }

  return res.results
    .map((r) => {
      const rr = r as { text?: string; highlights?: string[] };
      const text = (rr.text ?? (rr.highlights ?? []).join(" … ")).replace(/\s+/g, " ").trim();
      const host = hostOf(r.url);
      return { title: r.title?.trim() || host, url: r.url, site: host, postedAt: r.publishedDate, text, origin: opts.origin ?? "web" };
    })
    .filter((r) => r.text.length > 80);
}

/** Pages about existing products for a problem (competitor check). */
export async function searchProducts(query: string, since: string) {
  const res = await exa().search(query, {
    type: "auto",
    contents: { highlights: true },
    objective: "Find existing products, apps or services that solve this problem. Rank product homepages first; skip listicles, news and forums.",
    startPublishedDate: since,
    excludeDomains: ["reddit.com"], // forum threads aren't products
  });
  return res.results.map((r) => ({
    title: r.title?.trim() || hostOf(r.url),
    url: r.url,
    site: hostOf(r.url),
    text: ((r as { highlights?: string[] }).highlights ?? []).join(" … "),
  }));
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
