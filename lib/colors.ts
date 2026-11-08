// no category colors, stages are a gray to black ramp. vars live in app/globals.css

export const STAGE_COLORS = {
  spotted: "var(--stage-spotted)",
  researching: "var(--stage-researching)",
  validating: "var(--stage-validating)",
  building: "var(--stage-building)",
} as const;
