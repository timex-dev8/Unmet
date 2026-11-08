"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { ChevronDown, Gauge, Lock } from "lucide-react";
import { useGuest, useLowOnly, useUser } from "@/lib/auth";
import { DEPTHS, type Depth } from "@/lib/research-types";
import DepthSlider from "./DepthSlider";
import styles from "./depthSlider.module.css";

export default function DepthPicker({
  value,
  onChange,
  disabled,
  placement = "down",
}: {
  value: Depth;
  onChange: (depth: Depth) => void;
  disabled?: boolean;
  placement?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  // guests research on quick only
  const lowOnly = useLowOnly();
  const shown = lowOnly ? "low" : value;
  const user = useUser();
  const guest = useGuest();
  const authKnown = user !== undefined && guest !== undefined;
  const pick = (depth: Depth) => {
    if (!authKnown) return; // lowOnly isnt final yet
    if (lowOnly && depth !== "low") {
      setBlocked(true);
      onChange("low");
      return;
    }
    setBlocked(false);
    onChange(depth);
  };
  const pickerRef = useRef<HTMLDivElement>(null);
  const pillButtonRef = useRef<HTMLButtonElement>(null);
  const popId = useId();
  const level = DEPTHS.find((option) => option.id === shown)!;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        pillButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const y = placement === "up" ? 6 : -6;

  return (
    <div className={styles.picker} ref={pickerRef}>
      <button
        ref={pillButtonRef}
        type="button"
        className={`${styles.pill} ${open ? styles.pillOpen : ""}`}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={popId}
        aria-label={`Research depth: ${level.label}`}
      >
        <Gauge size={16} aria-hidden="true" />
        <span className={styles.pillLabel}>{level.label}</span>
        <ChevronDown size={14} className={styles.chev} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            id={popId}
            role="dialog"
            aria-label="Research depth"
            className={`${styles.pop} ${placement === "up" ? styles.popUp : styles.popDown}`}
            initial={{ opacity: 0, scale: 0.96, y }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <DepthSlider value={shown} onChange={pick} detail />
            {lowOnly && (
              <p className={`${styles.lock} ${blocked ? styles.lockOn : ""}`}>
                <Lock size={13} aria-hidden="true" />
                <span>
                  Deep and Deepest need a free account.{" "}
                  <Link href={`/welcome?next=${encodeURIComponent(typeof window === "undefined" ? "/app" : location.pathname)}`}>Sign in</Link>
                </span>
              </p>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
