"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, SlidersHorizontal, TrendingUp } from "lucide-react";
import Highlight from "@/components/motion/Highlight";
import { CATEGORIES, SOURCE_KINDS } from "@/lib/types";
import type { FeedFilter } from "@/lib/cards";
import { kindBadge } from "@/components/card/parts";
import type { Source, SourceKind } from "@/lib/types";
import s from "./app.module.css";

const feedHref = (topic?: string, source?: string) => {
  const q = new URLSearchParams();
  if (topic) q.set("topic", topic);
  if (source) q.set("source", source);
  const str = q.toString();
  return str ? `/app/feed?${str}` : "/app/feed";
};

export default function FilterChips({ active, source, kinds = [] }: { active: FeedFilter; source?: string; kinds?: string[] }) {
  const chips: { label: string; value: FeedFilter }[] = [
    { label: "All", value: undefined },
    { label: "Trending", value: "Trending" },
    ...CATEGORIES.map((c) => ({ label: c, value: c })),
  ];
  return (
    <div className={s.filters}>
      <nav className={s.chips} aria-label="Filter ideas">
        {chips.map((c) => {
          const on = c.value === active;
          const href = feedHref(c.value, source);
          return (
            <Link key={c.label} href={href} className={`${s.chip} ${on ? s.chipOn : ""}`} aria-current={on ? "page" : undefined}>
              {on && <Highlight id="feed-filter" className={s.chipPill} />}
              {c.value === "Trending" && <TrendingUp size={15} strokeWidth={2.5} aria-hidden="true" />}
              {c.label}
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
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  // evidence kinds need a friendly name, product sources already have one
  const label = (k: string) => (SOURCE_KINDS.includes(k as SourceKind) ? kindBadge({ kind: k } as Source) : k);
  return (
    <div className={s.sourceMenu} ref={ref}>
      <button type="button" className={`${s.sourceBtn} ${source ? s.sourceBtnOn : ""}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <SlidersHorizontal size={15} aria-hidden="true" />
        {source ? label(source) : "Sources"}
      </button>
      {open && (
        <div className={s.sourceList}>
          {[undefined, ...kinds].map((k) => (
            <Link
              key={k ?? "any"}
              href={feedHref(active, k)}
              className={s.sourceItem}
              aria-current={k === source ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {k ? label(k) : "All sources"}
              {k === source && <Check size={16} aria-hidden="true" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
