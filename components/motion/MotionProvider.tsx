"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Motion's features (drag, layout animations) arrive in their own chunk after the page is up; `m.*` components stand in for `motion.*`.
const loadFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

// Studio-wide motion defaults: respect "reduce motion", and use the same easing as the CSS (--ease).
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
