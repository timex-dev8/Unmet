import type { LucideIcon } from "lucide-react";
import styles from "./landing.module.css";

const LAYERS = [1, 2, 3, 4, 5, 6, 7, 8];

type Props = {
  icon: LucideIcon;
  size: 56 | 72 | 88;
  tone?: "clear" | "b1" | "b2" | "gb";
  /* no faint fill for line-only icons */
  line?: boolean;
  strokeWidth?: number;
  className?: string;
};

export default function GlassTile({ icon: Icon, size, tone = "clear", line, strokeWidth = 1.8, className }: Props) {
  const classes = [styles.g3, styles[`t${size}`], styles[tone], line && styles.line, className];
  return (
    <span className={classes.filter(Boolean).join(" ")} aria-hidden="true">
      {LAYERS.map((layer) => (
        <i key={layer} />
      ))}
      <Icon strokeWidth={strokeWidth} />
    </span>
  );
}
