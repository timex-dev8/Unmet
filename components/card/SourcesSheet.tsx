"use client";

import { useRef } from "react";
import { ArrowUpRight, Link2, X } from "lucide-react";
import type { Card } from "@/lib/types";
import { kindBadge, sourceMeta, windowLabel } from "./parts";
import s from "./card.module.css";
import sheet from "./sheet.module.css";

// Bottom sheet listing the original posts. Uses <dialog> for focus trapping and Esc to close.
export default function SourcesSheet({ card, compact }: { card: Card; compact?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const count = card.sources.length;

  return (
    <>
      <button
        type="button"
        className={compact ? `${s.act} ${s.iconBtn}` : s.act}
        onClick={() => ref.current?.showModal()}
        aria-label={compact ? `Sources (${count})` : undefined}
      >
        {compact ? (
          <span className={s.count}>{count}</span>
        ) : (
          <>
            <Link2 size={17} aria-hidden="true" />
            Sources · {count}
          </>
        )}
      </button>
      <dialog
        ref={ref}
        className={sheet.sheet}
        aria-labelledby={`sources-${card.slug}`}
        onClick={(e) => {
          if (e.target === ref.current) ref.current.close(); // tap outside closes
        }}
      >
        <div className={sheet.inner}>
          <div className={sheet.grab} aria-hidden="true" />
          <div className={sheet.head}>
            <h2 id={`sources-${card.slug}`} className={sheet.title}>
              Sources
            </h2>
            <button type="button" className={sheet.close} onClick={() => ref.current?.close()} aria-label="Close">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <p className={sheet.note}>
            {card.evidence.posts} {card.evidence.posts === 1 ? "mention" : "mentions"}
            {card.query ? ` of “${card.query.replaceAll('"', "")}”` : ""} on {card.evidence.site}, {windowLabel(card.evidence.days)}.
            {card.fresh ? " Strongest sources first:" : " Top recent ones:"}
          </p>
          <ul className={sheet.list}>
            {card.sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className={sheet.link}>
                  <span>
                    <span className={sheet.linkTitle}>{src.title}</span>
                    <span className={sheet.meta}>
                      {kindBadge(src) && <span className={sheet.badge}>{kindBadge(src)}</span>}
                      {sourceMeta(src)}
                    </span>
                  </span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
