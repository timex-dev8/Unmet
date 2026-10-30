import type { Category } from "./types";

// One color per meaning, used everywhere (tags, card strips, icons, sparklines).
// Values are CSS variables defined in app/globals.css.

export type Hue = { solid: string; tint: string; ink: string };

const hue = (name: string): Hue => ({ solid: `var(--c-${name})`, tint: `var(--c-${name}-tint)`, ink: `var(--c-${name}-ink)` });

export const CATEGORY_COLORS: Record<Category, Hue> = {
  "Dev tools": hue("dev"),
  Productivity: hue("prod"),
  Money: hue("money"),
  Work: hue("work"),
  Health: hue("health"),
  Home: hue("home"),
};

export const categoryColor = (c: string): Hue => CATEGORY_COLORS[c as Category] ?? { solid: "var(--muted)", tint: "var(--gray)", ink: "var(--ink-2)" };

/** Board stage → color (always shown with the stage name). */
export const STAGE_COLORS = {
  spotted: "var(--stage-spotted)",
  researching: "var(--stage-researching)",
  validating: "var(--stage-validating)",
  building: "var(--stage-building)",
} as const;

/** Score level → dot color (shown next to its label, never on its own). */
export const levelColor = (label: "Low" | "Medium" | "High", goodWhenHigh: boolean) => {
  const good = goodWhenHigh ? label === "High" : label === "Low";
  const bad = goodWhenHigh ? label === "Low" : label === "High";
  return good ? "var(--c-money)" : bad ? "var(--c-health)" : "var(--c-work)";
};
