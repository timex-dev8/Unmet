import "server-only";
import { plain } from "@/lib/hn";
import type { ResearchSource } from "@/lib/research-types";
import { hostOf } from "@/lib/url";

// free: 300 req/day per ip, 10k with STACKEXCHANGE_KEY

type Item = {
  title: string;
  body?: string;
  link: string;
  score: number;
  view_count: number;
  answer_count: number;
  creation_date: number;
};

export async function searchStackExchange(query: string, sites: string[], sinceSeconds: number): Promise<Omit<ResearchSource, "id">[]> {
  const results = await Promise.allSettled(
    sites.slice(0, 3).map(async (site) => {
      const params = new URLSearchParams({
        order: "desc",
        sort: "relevance",
        q: query,
        site,
        pagesize: "6",
        fromdate: String(sinceSeconds),
        filter: "withbody",
        ...(process.env.STACKEXCHANGE_KEY ? { key: process.env.STACKEXCHANGE_KEY } : {}),
      });
      const response = await fetch(`https://api.stackexchange.com/2.3/search/advanced?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return [];
      const { items = [] } = (await response.json()) as { items?: Item[] };
      return items.map((item) => ({
        title: plain(item.title),
        url: item.link,
        site: hostOf(item.link),
        postedAt: new Date(item.creation_date * 1000).toISOString(),
        text: plain(`${item.title}. ${item.body ?? ""}`).slice(0, 2000),
        origin: "stackexchange" as const,
        kind: "qa" as const,
        engagement: { score: item.score * 5 + Math.round(item.view_count / 100), label: `${item.score} votes · ${item.view_count} views` },
      }));
    }),
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])).filter((source) => source.text.length > 80);
}
