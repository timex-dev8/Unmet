"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Gauge } from "lucide-react";
import { DEPTHS, type Depth } from "@/lib/research-types";
import DepthSlider from "./DepthSlider";
import s from "./depthSlider.module.css";

// ChatGPT-style depth control: a small pill inside the composer shows the current level;
// tapping it opens a popover with the slider. Closes on outside click or Escape.
export default function DepthPicker({
  value,
  onChange,
  disabled,
  placement = "down",
}: {
  value: Depth;
  onChange: (d: Depth) => void;
  disabled?: boolean;
  /** Open above the pill (composer docked at the bottom) or below it. */
  placement?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popId = useId();
  const level = DEPTHS.find((d) => d.id === value)!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const y = placement === "up" ? 6 : -6;

  return (
    <div className={s.picker} ref={root}>
      <button
        ref={button}
        type="button"
        className={`${s.pill} ${open ? s.pillOpen : ""}`}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={popId}
        aria-label={`Research depth: ${level.label}`}
      >
        <Gauge size={16} aria-hidden="true" />
        <span className={s.pillLabel}>{level.label}</span>
        <ChevronDown size={14} className={s.chev} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={popId}
            role="dialog"
            aria-label="Research depth"
            className={`${s.pop} ${placement === "up" ? s.popUp : s.popDown}`}
            initial={{ opacity: 0, scale: 0.96, y }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <DepthSlider value={value} onChange={onChange} detail />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
