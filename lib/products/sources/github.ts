import "server-only";
import type { RawProduct } from "./types";
import { headers } from "./types";

type Repo = {
  full_name: string;
  html_url: string;
  homepage?: string | null;
  description?: string | null;
  stargazers_count: number;
  topics?: string[];
};

export async function githubRising(): Promise<RawProduct[]> {
  const since = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const q = `created:>${since} stars:>800`;
  const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=40`, {
    headers: {
      ...headers,
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const { items = [] } = (await res.json()) as { items?: Repo[] };
  return items
    .filter((r) => r.homepage && /^https?:\/\//.test(r.homepage) && r.description)
    .map((r) => ({
      name: r.full_name.split("/")[1],
      url: r.homepage!,
      description: `${r.description}. Topics: ${(r.topics ?? []).join(", ")}`,
      proof: [{ kind: "stars", label: `${(r.stargazers_count / 1000).toFixed(1)}k GitHub stars in under 3 months`, url: r.html_url, site: "GitHub" }],
      rising: true,
      source: "GitHub" as const,
      weight: Math.min(35, r.stargazers_count / 1000),
    }));
}
