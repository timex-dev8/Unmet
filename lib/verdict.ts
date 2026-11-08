import type { Report, Score } from "./types";

export const VERDICT: Record<Report["verdict"], { label: string; short: string; note: string }> = {
  strong: { label: "Strong opportunity", short: "Strong", note: "Real, repeated pain across several sources." },
  maybe: { label: "Worth a closer look", short: "Worth a look", note: "Real pain, but the money signal is still thin." },
  weak: { label: "Weak signal so far", short: "Weak signal", note: "Too little evidence yet. Talk to people before building." },
};

const COMPETITION: Record<string, string> = { Low: "Open space", Medium: "Some competition", High: "Crowded" };

export function competitionLine({ label, reason }: Pick<Score, "label" | "reason">) {
  const name = COMPETITION[label] ?? `${label} competition`;
  if (!reason) return `${name}.`;
  // keep acronyms and names as written ("AI tools" stays, "Many tools" drops the capital)
  const text = /^[A-Z][a-z ]/.test(reason) ? reason[0].toLowerCase() + reason.slice(1) : reason;
  return `${name}: ${text}${/[.!?]$/.test(text) ? "" : "."}`;
}
