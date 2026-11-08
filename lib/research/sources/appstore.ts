import "server-only";
import type { ResearchSource } from "@/lib/research-types";

type App = { trackId: number; trackName: string; trackViewUrl: string; userRatingCount?: number };
type Entry = {
  id: { label: string };
  title: { label: string };
  content: { label: string };
  updated: { label: string };
  "im:rating"?: { label: string };
};

export async function searchAppReviews(terms: string[], sinceSeconds: number): Promise<Omit<ResearchSource, "id">[]> {
  const apps: App[] = [];
  for (const term of terms.slice(0, 2)) {
    const params = new URLSearchParams({ term, entity: "software", limit: "3", country: "us" });
    const response = await fetch(`https://itunes.apple.com/search?${params}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!response?.ok) continue;
    const { results = [] } = (await response.json()) as { results?: App[] };
    for (const found of results) if (!apps.some((app) => app.trackId === found.trackId)) apps.push(found);
  }

  const perApp = await Promise.allSettled(
    apps.slice(0, 4).map(async (app) => {
      const response = await fetch(`https://itunes.apple.com/us/rss/customerreviews/page=1/id=${app.trackId}/sortby=mostrecent/json`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return [];
      const body = (await response.json()) as { feed?: { entry?: Entry[] | Entry } };
      const entries = ([] as Entry[]).concat(body.feed?.entry ?? []);
      return entries
        .filter((entry) => entry["im:rating"] && Number(entry["im:rating"].label) <= 2)
        .filter((entry) => Date.parse(entry.updated.label) / 1000 > sinceSeconds)
        .slice(0, 6)
        .map((entry) => {
          const rating = Number(entry["im:rating"]!.label);
          return {
            title: `${rating}★ review of ${app.trackName}: “${entry.title.label.slice(0, 80)}”`,
            url: `${app.trackViewUrl.split("?")[0]}#review-${entry.id.label}`,
            site: "apps.apple.com",
            postedAt: new Date(entry.updated.label).toISOString(),
            text: `${entry.title.label}. ${entry.content.label}`.replace(/\s+/g, " ").slice(0, 1500),
            origin: "appstore" as const,
            kind: "app-review" as const,
            engagement: { score: 2, label: `${rating}★ App Store review` },
          };
        });
    }),
  );
  return perApp.flatMap((result) => (result.status === "fulfilled" ? result.value : [])).filter((source) => source.text.length > 60);
}
