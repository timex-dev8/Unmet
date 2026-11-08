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

export async function searchWeb(query: string, objective: string, options: WebSearchOptions): Promise<RawSource[]> {
  const contents = options.fullText ? { text: { maxCharacters: 2500 } } : { highlights: true as const };
  const request = (type: string) =>
    exa().search(
      query,
      {
        type,
        contents,
        objective,
        startPublishedDate: options.since,
        ...(options.includeDomains ? { includeDomains: options.includeDomains } : {}),
      },
      { timeout: TIMEOUT_MS },
    );

  let response;
  try {
    response = await request(options.type);
  } catch (err) {
    if (options.type === "auto") throw err;
    console.warn(`[exa] "${options.type}" search failed, retrying with "auto":`, err instanceof Error ? err.message : err);
    response = await request("auto");
  }

  return response.results
    .map((result) => {
      const rawResult = result as { text?: string; highlights?: string[] };
      const text = (rawResult.text ?? (rawResult.highlights ?? []).join(" … ")).replace(/\s+/g, " ").trim();
      const host = hostOf(result.url);
      return {
        title: result.title?.trim() || host,
        url: result.url,
        site: host,
        postedAt: result.publishedDate,
        text,
        origin: options.origin ?? "web",
      };
    })
    .filter((source) => source.text.length > 80);
}

export async function searchProducts(query: string, since: string, signal?: AbortSignal) {
  const response = await exa().search(
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
  return response.results.map((result) => ({
    title: result.title?.trim() || hostOf(result.url),
    url: result.url,
    site: hostOf(result.url),
    text: ((result as { highlights?: string[] }).highlights ?? []).join(" … "),
  }));
}
