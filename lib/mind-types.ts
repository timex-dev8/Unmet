// Shared between the Shape API and the Shape screen (route /app/mind).

/** What the AI makes of someone's notes: their idea, laid out as a clear brief. */
export type MindBrief = {
  /** The idea in one sentence. */
  idea: string;
  forWho: string;
  problem: string;
  /** 3–5 must-haves taken from the notes. */
  buildFirst: string[];
  later: string[];
  /** Gaps and contradictions in the notes, asked as questions. */
  questions: string[];
  /** One step for this week, under 25 words. */
  nextStep: string;
  /** A saved or researched problem that is clearly the same idea, or empty. */
  matchSlug: string;
  matchHeadline: string;
};

export type MindRequest = {
  thoughts: { id: string; text: string }[];
  ideas: { slug: string; headline: string; summary: string }[];
};
