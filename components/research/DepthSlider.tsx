"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { AnimatePresence, animate, m, useMotionValue, useTransform } from "motion/react";
import { DEPTHS, type Depth } from "@/lib/research-types";
import styles from "./depthSlider.module.css";

const SPRING = { type: "spring", stiffness: 520, damping: 40 } as const;
const LAST = DEPTHS.length - 1;

export default function DepthSlider({
  value,
  onChange,
  disabled,
  detail,
}: {
  value: Depth;
  onChange: (depth: Depth) => void;
  disabled?: boolean;
  detail?: boolean;
}) {
  const index = DEPTHS.findIndex((option) => option.id === value);
  const level = DEPTHS[index];
  const railRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const target = useRef(0); // pointer position 0..1, the knob may still be springing to it
  const [active, setActive] = useState(false);
  const pos = useMotionValue(index / LAST);
  const left = useTransform(pos, (position) => `${position * 100}%`);

  // spring to the stop when value changes outside a drag
  useEffect(() => {
    if (!dragging.current) animate(pos, index / LAST, SPRING);
  }, [index, pos]);

  function fractionAt(clientX: number) {
    const railRect = railRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - railRect.left) / railRect.width));
  }
  function pick(fraction: number) {
    const stopIndex = Math.round(fraction * LAST);
    if (stopIndex !== index) onChange(DEPTHS[stopIndex].id);
    return stopIndex;
  }

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    setActive(true);
    target.current = fractionAt(e.clientX);
    animate(pos, target.current, SPRING);
    pick(target.current);
  }
  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    target.current = fractionAt(e.clientX);
    pos.stop();
    pos.set(target.current);
    pick(target.current);
  }
  function onUp() {
    if (!dragging.current) return;
    dragging.current = false;
    setActive(false);
    animate(pos, pick(target.current) / LAST, SPRING);
  }

  return (
    <div className={`${styles.root} ${disabled ? styles.disabled : ""}`}>
      <div className={styles.head}>
        <span className={styles.title}>Depth</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={level.id}
            className={styles.value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {level.label}
          </m.span>
        </AnimatePresence>
      </div>

      <input
        type="range"
        className={styles.input}
        min={0}
        max={LAST}
        step={1}
        value={index}
        disabled={disabled}
        aria-label="Research depth"
        aria-valuetext={`${level.label}: ${level.what}`}
        onChange={(e) => onChange(DEPTHS[Number(e.target.value)].id)}
      />

      <div className={styles.track} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden="true">
        <div className={styles.rail} ref={railRef}>
          <m.div className={styles.fill} style={{ width: left }} />
          {DEPTHS.map((option, i) => (
            <span key={option.id} className={`${styles.stop} ${i <= index ? styles.stopOn : ""}`} style={{ left: `${(i / LAST) * 100}%` }} />
          ))}
          <m.div className={styles.knob} style={{ left }} animate={{ scale: active ? 1.12 : 1 }} transition={{ duration: 0.15 }} />
        </div>
      </div>

      <div className={styles.labels}>
        {DEPTHS.map((option) => (
          <button
            key={option.id}
            type="button"
            tabIndex={-1}
            className={option.id === value ? styles.labelOn : ""}
            onClick={() => onChange(option.id)}
            disabled={disabled}
          >
            {option.label}
          </button>
        ))}
      </div>

      {detail && (
        <AnimatePresence mode="wait" initial={false}>
          <m.p
            key={level.id}
            className={styles.detail}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {level.what}
          </m.p>
        </AnimatePresence>
      )}
    </div>
  );
}
