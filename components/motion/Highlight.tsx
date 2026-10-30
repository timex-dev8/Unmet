"use client";

import { motion } from "motion/react";

/**
 * The "you are here" background. Render it inside the active item only: items sharing an `id`
 * hand it over, so it glides from the old item to the new one instead of jumping.
 * The parent needs `position: relative; isolation: isolate`.
 */
export default function Highlight({ id, className }: { id: string; className?: string }) {
  return (
    <motion.span
      layoutId={id}
      className={className}
      style={{ position: "absolute", inset: 0, zIndex: -1, borderRadius: "inherit" }}
      transition={{ type: "spring", stiffness: 480, damping: 38 }}
      aria-hidden="true"
    />
  );
}
