"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import s from "./liquidGlass.module.css";

/**
 * Apple-style liquid glass, after rdev/liquid-glass-react (MIT): the page behind is bent at the rim
 * by an SVG displacement map (so the edge magnifies what passes under it), then blurred and saturated.
 * A thin bright rim catches the light, and its shine turns toward the cursor.
 * The bending needs Chromium; Safari and Firefox get the plain frosted glass.
 */
export default function LiquidGlass({
  children,
  radius,
  className = "",
  bend = 26,
}: {
  children: ReactNode;
  radius: number;
  className?: string;
  /** How far the rim bends the backdrop, in px */
  bend?: number;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<{ url: string; w: number; h: number } | null>(null);
  const [angle, setAngle] = useState(135);

  // Draw a displacement map the exact size of the glass, redrawn when it resizes
  useEffect(() => {
    const el = ref.current;
    const ua = navigator.userAgent;
    if (!el || !/Chrome\//.test(ua) || /Firefox/.test(ua)) return;
    const draw = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width && height) setMap({ url: displacementMap(Math.round(width), Math.round(height), radius), w: width, h: height });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [radius]);

  // The rim's shine leans toward the cursor
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        setAngle((Math.atan2(dy, dx) * 180) / Math.PI + 90);
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
      style={{ borderRadius: radius, "--rim-angle": `${angle}deg`, ...(map && { "--glass-bend": `url(#${id})` }) } as CSSProperties}
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

/**
 * A map that is neutral (no bend) in the middle and pushes the backdrop inward near the rim,
 * so the edge magnifies what's behind it. R = horizontal shift, B = vertical, 128 = none.
 */
function displacementMap(w: number, h: number, radius: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const band = Math.min(16, h / 2.5); // how deep the bending reaches in from the rim
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(radius, hw, hh);
  const sdf = (x: number, y: number) => {
    const qx = Math.abs(x) - (hw - r);
    const qy = Math.abs(y) - (hh - r);
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
  };
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = px + 0.5 - hw;
      const y = py + 0.5 - hh;
      const d = sdf(x, y); // negative inside, 0 at the rim
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
  return canvas.toDataURL();
}
