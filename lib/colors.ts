// The Studio is mostly ink on white (see DESIGN.md). Categories have no color;
// board stages use a gray-to-black ramp, always shown next to the stage name.
// Values are CSS variables defined in app/globals.css.

export const STAGE_COLORS = {
  spotted: "var(--stage-spotted)",
  researching: "var(--stage-researching)",
  validating: "var(--stage-validating)",
  building: "var(--stage-building)",
} as const;
