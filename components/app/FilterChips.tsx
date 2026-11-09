"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, SlidersHorizontal, TrendingUp } from "lucide-react";
import Highlight from "@/components/motion/Highlight";
import { CATEGORIES, SOURCE_KINDS, categoryLabel } from "@/lib/types";
import type { FeedFilter } from "@/lib/cards";
import { kindBadge } from "@/components/card/parts";
import type { Source, SourceKind } from "@/lib/types";
import styles from "./app.module.css";

const feedHref = (topic?: string, source?: string) => {
  const params = new URLSearchParams();
  if (topic) params.set("topic", topic);
  if (source) params.set("source", source);
  const queryString = params.toString();
  return queryString ? `/app/feed?${queryString}` : "/app/feed";
};

export default function FilterChips({ active, source, kinds = [] }: { active: FeedFilter; source?: string; kinds?: string[] }) {
  const chips: { label: string; value: FeedFilter }[] = [
    { label: "All", value: undefined },
    { label: "Trending", value: "Trending" },
    ...CATEGORIES.map((category) => ({
      label: categoryLabel(category),
      value: category,
    })),
  ];
  return (
    <div className={styles.filters}>
      <nav className={styles.chips} aria-label="Filter ideas">
        {chips.map((chip) => {
          const isActive = chip.value === active;
          const href = feedHref(chip.value, source);
          return (
            <Link
              key={chip.label}
              href={href}
              className={`${styles.chip} ${isActive ? styles.chipOn : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && <Highlight id="feed-filter" className={styles.chipPill} />}
              {chip.value === "Trending" && <TrendingUp size={15} strokeWidth={2.5} aria-hidden="true" />}
              {chip.label}
            </Link>
          );
        })}
      </nav>
      {kinds.length > 0 && <SourceMenu active={active} source={source} kinds={kinds} />}
    </div>
  );
}

function SourceMenu({ active, source, kinds }: { active: FeedFilter; source?: string; kinds: string[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  // evidence kinds need a friendly name, product sources already have one
  const label = (kind: string) => (SOURCE_KINDS.includes(kind as SourceKind) ? kindBadge({ kind } as Source) : kind);
  return (
    <div className={styles.sourceMenu} ref={menuRef}>
      <button
        type="button"
        className={`${styles.sourceBtn} ${source ? styles.sourceBtnOn : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <SlidersHorizontal size={15} aria-hidden="true" />
        {source ? label(source) : "Sources"}
      </button>
      {open && (
        <div className={styles.sourceList}>
          {[undefined, ...kinds].map((kind) => (
            <Link
              key={kind ?? "any"}
              href={feedHref(active, kind)}
              className={styles.sourceItem}
              aria-current={kind === source ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {kind ? label(kind) : "All sources"}
              {kind === source && <Check size={16} aria-hidden="true" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
