export const CATEGORIES = ["Dev tools", "Productivity", "Money", "Work", "Health", "Home"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Trend = "rising" | "steady" | "falling";

export type Source = {
  title: string;
  url: string;
  site: string; // e.g. "Hacker News"
  points?: number;
  comments?: number;
  postedAt?: string; // ISO date
};

export type Score = {
  value: number; // 0–100
  label: "Low" | "Medium" | "High";
  basis: "data" | "ai"; // hard signals vs AI estimate
  reason: string;
};

export type Card = {
  slug: string;
  headline: string;
  summary: string; // two sentences, our own words
  who: string;
  category: Category;
  trend: Trend;
  quote: string; // under 15 words
  highlight: string; // the repeated phrase inside quote
  query?: string; // what we searched the source for
  evidence: {
    posts: number; // posts + comments mentioning the problem in the window
    threads: number;
    days: number;
    weekly: number[]; // mentions per week, oldest first (sparkline)
    site: string;
    updatedAt?: string; // ISO date the numbers were pulled
  };
  scores: { demand: Score; competition: Score; difficulty: Score };
  aiSuggestions: { title: string; text: string }[];
  sources: Source[];
  sample?: boolean; // placeholder content, shown with a "Sample" tag
  fresh?: boolean; // built on demand from a search
};
