export const CATEGORIES = ["Dev tools", "Productivity", "Money", "Work", "Health", "Home"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Trend = "rising" | "steady" | "falling";

export type SourceKind = "forum" | "qa" | "review" | "app-review" | "issue" | "social" | "hn" | "news" | "blog";
export const SOURCE_KINDS: readonly SourceKind[] = ["forum", "qa", "review", "app-review", "issue", "social", "hn", "news", "blog"];

export type Source = {
  title: string;
  url: string;
  site: string;
  kind?: SourceKind;
  points?: number;
  comments?: number;
  engagement?: string;
  postedAt?: string;
};

export type Competitor = { name: string; url: string; note?: string; mrr?: number };

export type Score = {
  value: number;
  label: "Low" | "Medium" | "High";
  basis: "data" | "ai";
  reason: string;
};

export type Signal = "pays" | "switching" | "price" | "workaround";

// computed from the evidence, never the AI's opinion
export type Report = {
  verdict: "strong" | "maybe" | "weak";
  reasons: string[];
  signals: Record<Signal, number>;
  today?: string;
  workarounds: string[];
};

export type IdeaLens = "automate" | "vertical" | "unbundle" | "service" | "wedge" | "connector" | "shovels";

export type Idea = {
  lens: IdeaLens;
  title: string;
  pitch: string;
  // reasoning, missing on ideas saved before it existed
  form?: "product" | "feature";
  norm?: string;
  flaw?: string;
  shift?: string;
  twists?: { name: string; how: string }[];
  whyLove?: string;
  competitorCheck?: string; // only from the products we found
  unproven?: string;
  whoPays: string;
  price: string;
  wedge: string;
  mvp: string;
  firstUsers: string;
  risks: string;
  evidence: string[];
  similar?: Competitor;
  score: number;
};

export type Card = {
  slug: string;
  headline: string;
  summary: string; // our own words
  who: string;
  category: Category;
  trend: Trend;
  quote: string; // under 15 words
  highlight: string;
  query?: string;
  evidence: {
    posts: number; // posts + comments in the window
    threads: number;
    days: number;
    weekly: number[]; // oldest first
    site: string;
    updatedAt?: string;
  };
  scores: { demand: Score; competition: Score; difficulty: Score };
  aiSuggestions: { title: string; text: string }[];
  sources: Source[];
  competitors?: Competitor[];
  report?: Report;
  ideas?: Idea[];
  thoughts?: string;
  sample?: boolean;
  signal?: "early" | "niche"; // early: 2 sources or one site. niche: a single source
  fresh?: boolean;
};

export type ProductProof = {
  kind: "mrr" | "growth" | "grossing" | "votes" | "stars" | "traffic";
  label: string;
  url: string;
  site: string;
};

export type Product = {
  kind: "product";
  slug: string;
  key?: string; // stable id from its page (products keyOf), to find it next run
  name: string;
  url: string;
  oneLine: string;
  forWho: string;
  category: Category;
  why: string;
  proof: ProductProof[];
  rising?: boolean;
  image?: string;
  source: ProductSource; // first source that found it, Home picks by it
  updatedAt: string;
  addedAt?: string; // missing on older rows
};

export type ProductSource = "TrustMRR" | "Product Hunt" | "App Store" | "Hacker News" | "GitHub";
