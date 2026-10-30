export const CATEGORIES = ["Dev tools", "Productivity", "Money", "Work", "Health", "Home"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Trend = "rising" | "steady" | "falling";

/** What kind of place a source is; first-hand places (forum, Q&A, review, issue) weigh most. */
export type SourceKind = "forum" | "qa" | "review" | "app-review" | "issue" | "social" | "hn" | "news" | "blog";

export type Source = {
  title: string;
  url: string;
  site: string; // e.g. "Hacker News"
  kind?: SourceKind;
  points?: number;
  comments?: number;
  engagement?: string; // e.g. "3 votes · 417 views", "1★ review"
  postedAt?: string; // ISO date
};

/** An existing product that already addresses the problem (found by the competitor check). */
export type Competitor = { name: string; url: string; note?: string; mrr?: number };

export type Score = {
  value: number; // 0–100
  label: "Low" | "Medium" | "High";
  basis: "data" | "ai"; // hard signals vs AI estimate
  reason: string;
};

/** What a complaint reveals beyond the pain itself; these signals drive the "worth building?" verdict. */
export type Signal = "pays" | "switching" | "price" | "workaround";

/** "Is this worth building?": a verdict computed from the evidence, never from the AI's opinion. */
export type Report = {
  verdict: "strong" | "maybe" | "weak";
  reasons: string[];
  signals: Record<Signal, number>; // how many complaints show each signal
  today?: string; // what people use now and what they dislike about it (AI summary of the complaints)
  workarounds: string[]; // manual hacks people describe (from complaints)
};

/** The pattern an idea follows (see IDEAS_SYSTEM in lib/research/prompts.ts). */
export type IdeaLens = "automate" | "vertical" | "unbundle" | "service" | "wedge" | "connector" | "shovels";

/** A product idea generated from a validated problem. Every idea cites the complaints it answers. */
export type Idea = {
  lens: IdeaLens;
  title: string;
  pitch: string; // one line
  whoPays: string;
  price: string; // rough, from comparable products
  wedge: string; // why someone would switch to it
  mvp: string; // a first version you could build in a weekend or two
  firstUsers: string; // where the first 10 users are
  risks: string;
  evidence: string[]; // quotes it answers (verified complaints)
  similar?: Competitor; // closest existing product, if the "already built?" check found one
  score: number; // 0–100
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
  competitors?: Competitor[];
  report?: Report;
  ideas?: Idea[];
  sample?: boolean; // placeholder content, shown with a "Sample" tag
  signal?: "early"; // backed by only 2 sources: shown as an early signal, not a proven problem
  fresh?: boolean; // built on demand from a search
};
