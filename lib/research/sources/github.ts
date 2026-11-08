import "server-only";
import type { ResearchSource } from "@/lib/research-types";

// free search api, 10 req/min without GITHUB_TOKEN, 30 with. phrase matched exactly

type Issue = {
  html_url: string;
  title: string;
  body?: string | null;
  created_at: string;
  comments: number;
  reactions?: { total_count?: number };
  repository_url: string;
};

export async function searchGithubIssues(phrase: string, sinceSeconds: number): Promise<Omit<ResearchSource, "id">[]> {
  const since = new Date(sinceSeconds * 1000).toISOString().slice(0, 10);
  const searchQuery = `"${phrase.replace(/"/g, "")}" is:issue created:>${since}`;
  const response = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=8`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "unmet-research",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) return [];
  const { items = [] } = (await response.json()) as { items?: Issue[] };

  return items
    .map((issue) => {
      const repo = issue.repository_url.split("/repos/")[1] ?? "github";
      const reactions = issue.reactions?.total_count ?? 0;
      return {
        title: `${issue.title} (${repo})`,
        url: issue.html_url,
        site: "github.com",
        postedAt: issue.created_at,
        text: `${issue.title}. ${(issue.body ?? "").replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`]/g, " ")}`.replace(/\s+/g, " ").slice(0, 1800),
        origin: "github" as const,
        kind: "issue" as const,
        engagement: { score: reactions * 2 + issue.comments, label: `${reactions} reactions · ${issue.comments} comments` },
      };
    })
    .filter((source) => source.text.length > 80);
}
