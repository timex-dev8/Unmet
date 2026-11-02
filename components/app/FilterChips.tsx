"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import Highlight from "@/components/motion/Highlight";
import { CATEGORIES } from "@/lib/types";
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

export default function FilterChips({ active, source, kinds = [] }: { active: FeedFilter; source?: SourceKind; kinds?: SourceKind[] }) {
  const chips: { label: string; value: FeedFilter }[] = [
    { label: "All", value: undefined },
    { label: "Trending", value: "Trending" },
    ...CATEGORIES.map((c) => ({ label: c, value: c })),
  ];
  return (
    <>
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
      {kinds.length > 0 && (
        <nav className={`${s.chips} ${s.sourceChips}`} aria-label="Filter by where the evidence comes from">
          <span className={s.chipLabel}>From</span>
          {[undefined, ...kinds].map((k) => {
            const on = k === source;
            return (
              <Link
                key={k ?? "any"}
                href={feedHref(active, k)}
                className={`${s.chip} ${on ? s.chipSolid : ""}`}
                aria-current={on ? "page" : undefined}
              >
                {k ? kindBadge({ kind: k } as Source) : "Any source"}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
