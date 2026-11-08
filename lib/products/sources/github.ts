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
  const searchQuery = `created:>${since} stars:>800`;
  const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&per_page=40`, {
    headers: {
      ...headers,
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return [];
  const { items = [] } = (await response.json()) as { items?: Repo[] };
  return items
    .filter((repo) => repo.homepage && /^https?:\/\//.test(repo.homepage) && repo.description)
    .map((repo) => ({
      name: repo.full_name.split("/")[1],
      url: repo.homepage!,
      description: `${repo.description}. Topics: ${(repo.topics ?? []).join(", ")}`,
      proof: [
        { kind: "stars", label: `${(repo.stargazers_count / 1000).toFixed(1)}k GitHub stars in under 3 months`, url: repo.html_url, site: "GitHub" },
      ],
      rising: true,
      source: "GitHub" as const,
      weight: Math.min(35, repo.stargazers_count / 1000),
    }));
}
