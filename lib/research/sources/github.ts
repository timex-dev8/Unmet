import "server-only";
import type { ResearchSource } from "@/lib/research-types";

// GitHub issues: bug reports and feature requests. Free search API (10 requests/min without
// GITHUB_TOKEN, 30 with). The phrase is matched exactly to keep results on topic.

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
  const q = `"${phrase.replace(/"/g, "")}" is:issue created:>${since}`;
  const res = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=8`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "unmet-research",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const { items = [] } = (await res.json()) as { items?: Issue[] };

  return items
    .map((i) => {
      const repo = i.repository_url.split("/repos/")[1] ?? "github";
      const reactions = i.reactions?.total_count ?? 0;
      return {
        title: `${i.title} (${repo})`,
        url: i.html_url,
        site: "github.com",
        postedAt: i.created_at,
        text: `${i.title}. ${(i.body ?? "").replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`]/g, " ")}`.replace(/\s+/g, " ").slice(0, 1800),
        origin: "github" as const,
        kind: "issue" as const,
        engagement: { score: reactions * 2 + i.comments, label: `${reactions} reactions · ${i.comments} comments` },
      };
    })
    .filter((s) => s.text.length > 80);
}
