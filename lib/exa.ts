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

export async function searchWeb(
  query: string,
  objective: string,
  opts: { since: string; includeReddit: boolean },
): Promise<Omit<ResearchSource, "id">[]> {
  const res = await exa().search(query, {
    type: "auto",
    contents: { highlights: true },
    objective,
    startPublishedDate: opts.since,
    ...(opts.includeReddit ? {} : { excludeDomains: ["reddit.com"] }),
  });

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
