import type { Card, SourceKind } from "./types";

export type ResearchSource = {
  id: number;
  title: string;
  url: string;
  site: string;
  postedAt?: string;
  text: string; // page text, quotes are checked against it
  origin: "web" | "reddit" | "hn" | "stackexchange" | "appstore" | "github" | "bluesky" | "discourse";
  kind?: SourceKind;
  engagement?: { score: number; label: string };
  weight?: number; // quality x freshness
  group?: string; // discover-mode search that found it, sources are balanced across these
};

export type Depth = "low" | "medium" | "high";

export const DEPTHS: { id: Depth; label: string; what: string }[] = [
  { id: "low", label: "Quick", what: "Quick look" },
  { id: "medium", label: "Deep", what: "Web, forums, reviews, Q&A, App Store" },
  { id: "high", label: "Deepest", what: "Every source + competitor check" },
];

// run ahead by a daily job (/api/cron/examples) so they open instantly
export const EXAMPLE_SEARCHES = [
  "I don't know what to build, give me ideas",
  "What do people hate about Calendly?",
  "I want to solve problems for barbershops",
  "What do small shop owners struggle with?",
];

type ChatTurn = { role: "user" | "assistant"; text: string };

export type ResearchRequest = {
  message: string;
  history: ChatTurn[];
  cards: Pick<Card, "slug" | "headline" | "summary">[];
  depth: Depth;
};

export type ResearchEvent =
  | { type: "step"; label: string }
  | { type: "result"; answer: string; cards: Card[]; sourceCount: number; mix?: string; suggestions?: string[]; cached?: boolean }
  | { type: "error"; message: string };
