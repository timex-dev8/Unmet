export type MindBrief = {
  idea: string;
  forWho: string;
  problem: string;
  buildFirst: string[];
  later: string[];
  questions: string[];
  nextStep: string;
  // clearly the same idea, or empty
  matchSlug: string;
  matchHeadline: string;
};
