import type { Report } from "./types";

/** One wording for the "worth building?" verdict everywhere: label (full), short (compact tags) and note (the one-line reason). */
export const VERDICT: Record<Report["verdict"], { label: string; short: string; note: string }> = {
  strong: { label: "Strong opportunity", short: "Strong", note: "Real, repeated pain with signs people would pay." },
  maybe: { label: "Worth a closer look", short: "Worth a look", note: "Real pain, but the money signal is still thin." },
  weak: { label: "Weak signal so far", short: "Weak signal", note: "Too little evidence yet. Talk to people before building." },
};
