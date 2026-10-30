import type { Card, SourceKind } from "./types";

// Shared between the research API and the chat screen.

export type ResearchSource = {
  id: number;
  title: string;
  url: string;
  site: string;
  postedAt?: string;
  text: string; // page text the AI reads and quotes are checked against
  origin: "web" | "hn" | "stackexchange" | "appstore" | "github";
  kind?: SourceKind;
  engagement?: { score: number; label: string };
  weight?: number; // quality × freshness, set by the quality filter
};

export type Depth = "low" | "medium" | "high";

/** Depth levels in slider order, with what each one does and how long it takes. */
export const DEPTHS: { id: Depth; label: string; what: string; time: string }[] = [
  { id: "low", label: "Low", what: "Quick look", time: "about 20 seconds" },
  { id: "medium", label: "Medium", what: "Web, forums, reviews, Q&A, App Store", time: "about 45 seconds" },
  { id: "high", label: "High", what: "Every source + competitor check", time: "1–2 minutes" },
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
  | { type: "result"; answer: string; cards: Card[]; sourceCount: number; mix?: string; cached?: boolean }
  | { type: "error"; message: string };
