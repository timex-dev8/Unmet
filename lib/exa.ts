import "server-only";
import Exa from "exa-js";
import type { ResearchSource } from "./research-types";
import { hostOf } from "./url";

// following the build-with-exa skill: /search with objective, hard 12 month window. reddit goes through exa's index, never scraped

export function exaConfigured() {
  return Boolean(process.env.EXA_API_KEY);
}

let client: Exa | null = null;
function exa() {
  return (client ??= new Exa(process.env.EXA_API_KEY));
}

type WebSearchOptions = {
  since: string;
  type: "lite" | "auto";
  includeDomains?: string[];
  // ~2,500 chars of page text so quotes can be checked
  fullText?: boolean;
  origin?: "web" | "reddit";
};

type RawSource = Omit<ResearchSource, "id">;

const TIMEOUT_MS = 15_000;

export async function searchWeb(query: string, objective: string, opts: WebSearchOptions): Promise<RawSource[]> {
  const contents = opts.fullText ? { text: { maxCharacters: 2500 } } : { highlights: true as const };
  const request = (type: string) =>
    exa().search(
      query,
      {
        type,
        contents,
        objective,
        startPublishedDate: opts.since,
        ...(opts.includeDomains ? { includeDomains: opts.includeDomains } : {}),
      },
      { timeout: TIMEOUT_MS },
    );

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

export async function searchProducts(query: string, since: string, signal?: AbortSignal) {
  const res = await exa().search(
    query,
    {
      type: "auto",
      contents: { highlights: true },
      objective: "Find existing products, apps or services that solve this problem. Rank product homepages first; skip listicles, news and forums.",
      startPublishedDate: since,
      excludeDomains: ["reddit.com"], // forum threads aren't products
    },
    { timeout: TIMEOUT_MS, signal },
  );
  return res.results.map((r) => ({
    title: r.title?.trim() || hostOf(r.url),
    url: r.url,
    site: hostOf(r.url),
    text: ((r as { highlights?: string[] }).highlights ?? []).join(" … "),
  }));
}
