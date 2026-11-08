"use client";

import { m } from "motion/react";

// parent needs position: relative and isolation: isolate
export default function Highlight({ id, className }: { id: string; className?: string }) {
  return (
    <m.span
      layoutId={id}
      className={className}
      style={{ position: "absolute", inset: 0, zIndex: -1, borderRadius: "inherit" }}
      transition={{ type: "spring", stiffness: 480, damping: 38 }}
      aria-hidden="true"
    />
  );
}
