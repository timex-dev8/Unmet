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
      const res = await fetch(`https://api.stackexchange.com/2.3/search/advanced?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const { items = [] } = (await res.json()) as { items?: Item[] };
      return items.map((i) => ({
        title: plain(i.title),
        url: i.link,
        site: hostOf(i.link),
        postedAt: new Date(i.creation_date * 1000).toISOString(),
        text: plain(`${i.title}. ${i.body ?? ""}`).slice(0, 2000),
        origin: "stackexchange" as const,
        kind: "qa" as const,
        engagement: { score: i.score * 5 + Math.round(i.view_count / 100), label: `${i.score} votes · ${i.view_count} views` },
      }));
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((s) => s.text.length > 80);
}
