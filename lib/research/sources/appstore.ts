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
    const res = await fetch(`https://itunes.apple.com/search?${params}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res?.ok) continue;
    const { results = [] } = (await res.json()) as { results?: App[] };
    for (const a of results) if (!apps.some((x) => x.trackId === a.trackId)) apps.push(a);
  }

  const perApp = await Promise.allSettled(
    apps.slice(0, 4).map(async (app) => {
      const res = await fetch(`https://itunes.apple.com/us/rss/customerreviews/page=1/id=${app.trackId}/sortby=mostrecent/json`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { feed?: { entry?: Entry[] | Entry } };
      const entries = ([] as Entry[]).concat(body.feed?.entry ?? []);
      return entries
        .filter((e) => e["im:rating"] && Number(e["im:rating"].label) <= 2)
        .filter((e) => Date.parse(e.updated.label) / 1000 > sinceSeconds)
        .slice(0, 6)
        .map((e) => {
          const rating = Number(e["im:rating"]!.label);
          return {
            title: `${rating}★ review of ${app.trackName}: “${e.title.label.slice(0, 80)}”`,
            url: `${app.trackViewUrl.split("?")[0]}#review-${e.id.label}`,
            site: "apps.apple.com",
            postedAt: new Date(e.updated.label).toISOString(),
            text: `${e.title.label}. ${e.content.label}`.replace(/\s+/g, " ").slice(0, 1500),
            origin: "appstore" as const,
            kind: "app-review" as const,
            engagement: { score: 2, label: `${rating}★ App Store review` },
          };
        });
    }),
  );
  return perApp.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((s) => s.text.length > 60);
}
