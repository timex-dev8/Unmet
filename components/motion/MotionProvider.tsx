"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Studio-wide motion defaults: respect "reduce motion", and use the same easing as the CSS (--ease).
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </MotionConfig>
  );
}
