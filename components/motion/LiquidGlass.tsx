"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./liquidGlass.module.css";

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
  const glassRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<{ url: string; w: number; h: number } | null>(null);

  useEffect(() => {
    const glassEl = glassRef.current;
    const userAgent = navigator.userAgent;
    if (!glassEl || !/Chrome\//.test(userAgent) || /Firefox/.test(userAgent)) return;
    let cancelled = false;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const draw = () => {
      if (cancelled) return;
      const { width, height } = glassEl.getBoundingClientRect();
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
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(glassEl);
    return () => {
      cancelled = true;
      resizeObserver.disconnect();
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
        const glassEl = glassRef.current;
        const rect = glassEl?.getBoundingClientRect();
        if (!glassEl || !rect || (!rect.width && !rect.height)) return; // display: none
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (Math.abs(((angle - last + 540) % 360) - 180) <= 2) return;
        last = angle;
        glassEl.style.setProperty("--rim-angle", `${angle.toFixed(1)}deg`);
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
      ref={glassRef}
      className={`${styles.glass} ${className}`}
      style={{ borderRadius: radius, ...(map && { "--glass-bend": `url(#${id})` }) } as CSSProperties}
    >
      {map && (
        <svg className={styles.defs} width="0" height="0" aria-hidden="true">
          <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feImage href={map.url} x="0" y="0" width={map.w} height={map.h} result="map" preserveAspectRatio="none" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={bend} xChannelSelector="R" yChannelSelector="B" />
          </filter>
        </svg>
      )}
      <span className={styles.rim} aria-hidden="true" />
      <span className={`${styles.rim} ${styles.rimSoft}`} aria-hidden="true" />
      {children}
    </div>
  );
}

const SCALE = 4; // map drawn at 1/4 size, feImage stretches it
const maps = new Map<string, string>();

// R = horizontal shift, B = vertical, 128 = none. cached by size
function displacementMap(fullW: number, fullH: number, fullRadius: number) {
  const key = `${fullW}x${fullH}r${fullRadius}`;
  const cachedUrl = maps.get(key);
  if (cachedUrl) return cachedUrl;
  const mapWidth = Math.max(1, Math.round(fullW / SCALE));
  const mapHeight = Math.max(1, Math.round(fullH / SCALE));
  const canvas = document.createElement("canvas");
  canvas.width = mapWidth;
  canvas.height = mapHeight;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const imageData = context.createImageData(mapWidth, mapHeight);
  const band = Math.min(16, fullH / 2.5) / SCALE;
  const halfWidth = mapWidth / 2;
  const halfHeight = mapHeight / 2;
  const cornerRadius = Math.min(fullRadius / SCALE, halfWidth, halfHeight);
  const sdf = (x: number, y: number) => {
    const edgeX = Math.abs(x) - (halfWidth - cornerRadius);
    const edgeY = Math.abs(y) - (halfHeight - cornerRadius);
    return Math.min(Math.max(edgeX, edgeY), 0) + Math.hypot(Math.max(edgeX, 0), Math.max(edgeY, 0)) - cornerRadius;
  };
  for (let py = 0; py < mapHeight; py++) {
    for (let px = 0; px < mapWidth; px++) {
      const x = px + 0.5 - halfWidth;
      const y = py + 0.5 - halfHeight;
      const distance = sdf(x, y);
      const blend = Math.max(0, Math.min(1, 1 + distance / band));
      const strength = blend * blend * (3 - 2 * blend);
      let normalX = sdf(x + 1, y) - sdf(x - 1, y);
      let normalY = sdf(x, y + 1) - sdf(x, y - 1);
      const length = Math.hypot(normalX, normalY) || 1;
      normalX /= length;
      normalY /= length;
      const i = (py * mapWidth + px) * 4;
      imageData.data[i] = 128 - normalX * strength * 127;
      imageData.data[i + 1] = 128;
      imageData.data[i + 2] = 128 - normalY * strength * 127;
      imageData.data[i + 3] = 255;
    }
  }
  context.putImageData(imageData, 0, 0);
  const url = canvas.toDataURL();
  if (maps.size > 12) maps.clear();
  maps.set(key, url);
  return url;
}
