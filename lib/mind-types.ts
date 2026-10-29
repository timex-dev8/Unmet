// Shared between the Mind API and the Mind screen.

export type MindConclusion = {
  /** The thread the person keeps coming back to, one sentence. */
  core: string;
  themes: { name: string; thoughtIds: string[] }[];
  /** Claims inside the thoughts; `idea` is set only when a real evidence-backed idea matches. */
  checks: { claim: string; idea: { slug: string; headline: string } | null }[];
  tension: string;
  nextStep: string;
};

export type MindRequest = {
  thoughts: { id: string; text: string }[];
  ideas: { slug: string; headline: string; summary: string }[];
};
