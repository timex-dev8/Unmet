import type { Card, SourceKind } from "./types";

// Shared between the research API and the chat screen.

export type ResearchSource = {
  id: number;
  title: string;
  url: string;
  site: string;
  postedAt?: string;
  text: string; // page text the AI reads and quotes are checked against
  origin: "web" | "reddit" | "hn" | "stackexchange" | "appstore" | "github" | "bluesky" | "discourse";
  kind?: SourceKind;
  engagement?: { score: number; label: string };
  weight?: number; // quality × freshness, set by the quality filter
  group?: string; // the discover-mode search that found it; sources are balanced across these
};

export type Depth = "low" | "medium" | "high";

/** Depth levels in slider order, with what each one does. */
export const DEPTHS: { id: Depth; label: string; what: string }[] = [
  { id: "low", label: "Quick", what: "Quick look" },
  { id: "medium", label: "Deep", what: "Web, forums, reviews, Q&A, App Store" },
  { id: "high", label: "Deepest", what: "Every source + competitor check" },
];

/** The searches offered to a first-time visitor. A daily job runs them ahead of time (/api/cron/examples), so they open instantly. */
export const EXAMPLE_SEARCHES = [
  "I don't know what to build, give me ideas",
  "What do people hate about Calendly?",
  "I want to solve problems for barbershops",
  "What do small shop owners struggle with?",
];

export type ChatTurn = { role: "user" | "assistant"; text: string };

/** What the browser sends: the new message plus enough context for follow-ups. */
export type ResearchRequest = {
  message: string;
  history: ChatTurn[];
  cards: Pick<Card, "slug" | "headline" | "summary">[];
  depth: Depth;
};

/** Streamed back one JSON object per line. */
export type ResearchEvent =
  | { type: "step"; label: string }
  | { type: "result"; answer: string; cards: Card[]; sourceCount: number; mix?: string; suggestions?: string[]; cached?: boolean }
  | { type: "error"; message: string };
