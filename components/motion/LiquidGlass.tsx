"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import s from "./liquidGlass.module.css";

// bending needs chromium, safari and firefox get plain frosted glass
export default function LiquidGlass({
  children,
  radius,
  className = "",
  bend = 26,
}: {
  children: ReactNode;
  radius: number;
  className?: string;
  bend?: number;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<{ url: string; w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    const ua = navigator.userAgent;
    if (!el || !/Chrome\//.test(ua) || /Firefox/.test(ua)) return;
    let cancelled = false;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const draw = () => {
      if (cancelled) return;
      const { width, height } = el.getBoundingClientRect();
      if (width && height) setMap({ url: displacementMap(Math.round(width), Math.round(height), radius), w: width, h: height });
    };
    const onResize = () => {
      clearTimeout(timer);
      if (first) {
        first = false; // observers first call, draw when idle
        if (typeof requestIdleCallback === "function") idle = requestIdleCallback(draw, { timeout: 500 });
        else timer = setTimeout(draw, 0);
      } else timer = setTimeout(draw, 150);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => {
      cancelled = true;
      ro.disconnect();
      clearTimeout(timer);
      if (idle !== undefined && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
    };
  }, [radius]);

  // written straight to the element, no re-render
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover)").matches) return;
    let frame = 0;
    let last = 135;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = ref.current;
        const r = el?.getBoundingClientRect();
        if (!el || !r || (!r.width && !r.height)) return; // display: none
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (Math.abs(((angle - last + 540) % 360) - 180) <= 2) return;
        last = angle;
        el.style.setProperty("--rim-angle", `${angle.toFixed(1)}deg`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`${s.glass} ${className}`}
      style={{ borderRadius: radius, ...(map && { "--glass-bend": `url(#${id})` }) } as CSSProperties}
    >
      {map && (
        <svg className={s.defs} width="0" height="0" aria-hidden="true">
          <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feImage href={map.url} x="0" y="0" width={map.w} height={map.h} result="map" preserveAspectRatio="none" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={bend} xChannelSelector="R" yChannelSelector="B" />
          </filter>
        </svg>
      )}
      <span className={s.rim} aria-hidden="true" />
      <span className={`${s.rim} ${s.rimSoft}`} aria-hidden="true" />
      {children}
    </div>
  );
}

const SCALE = 4; // map drawn at 1/4 size, feImage stretches it
const maps = new Map<string, string>();

// R = horizontal shift, B = vertical, 128 = none. cached by size
function displacementMap(fullW: number, fullH: number, fullRadius: number) {
  const key = `${fullW}x${fullH}r${fullRadius}`;
  const hit = maps.get(key);
  if (hit) return hit;
  const w = Math.max(1, Math.round(fullW / SCALE));
  const h = Math.max(1, Math.round(fullH / SCALE));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const band = Math.min(16, fullH / 2.5) / SCALE;
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(fullRadius / SCALE, hw, hh);
  const sdf = (x: number, y: number) => {
    const qx = Math.abs(x) - (hw - r);
    const qy = Math.abs(y) - (hh - r);
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
  };
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = px + 0.5 - hw;
      const y = py + 0.5 - hh;
      const d = sdf(x, y);
      const t = Math.max(0, Math.min(1, 1 + d / band));
      const k = t * t * (3 - 2 * t);
      let nx = sdf(x + 1, y) - sdf(x - 1, y);
      let ny = sdf(x, y + 1) - sdf(x, y - 1);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      const i = (py * w + px) * 4;
      img.data[i] = 128 - nx * k * 127;
      img.data[i + 1] = 128;
      img.data[i + 2] = 128 - ny * k * 127;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL();
  if (maps.size > 12) maps.clear();
  maps.set(key, url);
  return url;
}
