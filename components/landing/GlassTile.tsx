import type { LucideIcon } from "lucide-react";
import s from "./landing.module.css";

// Eight empty layers stacked in depth give the tile its thickness (see .g3 in landing.module.css).
const LAYERS = [1, 2, 3, 4, 5, 6, 7, 8];

type Props = {
  icon: LucideIcon;
  size: 56 | 72 | 88;
  /** clear glass, deep blue (b1), light blue (b2), or blue-tinted for pale backgrounds (gb) */
  tone?: "clear" | "b1" | "b2" | "gb";
  /** An icon made of lines only gets no faint fill. */
  line?: boolean;
  strokeWidth?: number;
  /** Sets where the tile sits and its perspective transform. */
  className?: string;
};

// A decorative floating 3D glass tile with an icon. Hidden from assistive tech.
export default function GlassTile({ icon: Icon, size, tone = "clear", line, strokeWidth = 1.8, className }: Props) {
  const classes = [s.g3, s[`t${size}`], s[tone], line && s.line, className];
  return (
    <span className={classes.filter(Boolean).join(" ")} aria-hidden="true">
      {LAYERS.map((n) => (
        <i key={n} />
      ))}
      <Icon strokeWidth={strokeWidth} />
    </span>
  );
}
