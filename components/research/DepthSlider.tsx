"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { AnimatePresence, animate, m, useMotionValue, useTransform } from "motion/react";
import { DEPTHS, type Depth } from "@/lib/research-types";
import s from "./depthSlider.module.css";

const SPRING = { type: "spring", stiffness: 520, damping: 40 } as const;
const LAST = DEPTHS.length - 1;

export default function DepthSlider({
  value,
  onChange,
  disabled,
  detail,
}: {
  value: Depth;
  onChange: (d: Depth) => void;
  disabled?: boolean;
  detail?: boolean;
}) {
  const index = DEPTHS.findIndex((d) => d.id === value);
  const level = DEPTHS[index];
  const railRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const target = useRef(0); // pointer position 0..1, the knob may still be springing to it
  const [active, setActive] = useState(false);
  const pos = useMotionValue(index / LAST);
  const left = useTransform(pos, (v) => `${v * 100}%`);

  // spring to the stop when value changes outside a drag
  useEffect(() => {
    if (!dragging.current) animate(pos, index / LAST, SPRING);
  }, [index, pos]);

  function fractionAt(clientX: number) {
    const r = railRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  }
  function pick(f: number) {
    const i = Math.round(f * LAST);
    if (i !== index) onChange(DEPTHS[i].id);
    return i;
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    setActive(true);
    target.current = fractionAt(e.clientX);
    animate(pos, target.current, SPRING);
    pick(target.current);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    target.current = fractionAt(e.clientX);
    pos.stop();
    pos.set(target.current);
    pick(target.current);
  }
  function up() {
    if (!dragging.current) return;
    dragging.current = false;
    setActive(false);
    animate(pos, pick(target.current) / LAST, SPRING);
  }

  return (
    <div className={`${s.root} ${disabled ? s.disabled : ""}`}>
      <div className={s.head}>
        <span className={s.title}>Depth</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={level.id}
            className={s.value}
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
        className={s.input}
        min={0}
        max={LAST}
        step={1}
        value={index}
        disabled={disabled}
        aria-label="Research depth"
        aria-valuetext={`${level.label}: ${level.what}`}
        onChange={(e) => onChange(DEPTHS[Number(e.target.value)].id)}
      />

      <div className={s.track} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden="true">
        <div className={s.rail} ref={railRef}>
          <m.div className={s.fill} style={{ width: left }} />
          {DEPTHS.map((d, i) => (
            <span key={d.id} className={`${s.stop} ${i <= index ? s.stopOn : ""}`} style={{ left: `${(i / LAST) * 100}%` }} />
          ))}
          <m.div className={s.knob} style={{ left }} animate={{ scale: active ? 1.12 : 1 }} transition={{ duration: 0.15 }} />
        </div>
      </div>

      <div className={s.labels}>
        {DEPTHS.map((d) => (
          <button
            key={d.id}
            type="button"
            tabIndex={-1}
            className={d.id === value ? s.labelOn : ""}
            onClick={() => onChange(d.id)}
            disabled={disabled}
          >
            {d.label}
          </button>
        ))}
      </div>

      {detail && (
        <AnimatePresence mode="wait" initial={false}>
          <m.p
            key={level.id}
            className={s.detail}
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
