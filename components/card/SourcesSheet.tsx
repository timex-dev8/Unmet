"use client";

import { useRef } from "react";
import { ArrowUpRight, Link2, X } from "lucide-react";
import type { Card } from "@/lib/types";
import { kindBadge, sourceMeta, windowLabel } from "./parts";
import styles from "./card.module.css";
import sheetStyles from "./sheet.module.css";

export default function SourcesSheet({ card, link }: { card: Card; link?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const count = card.sources.length;

  return (
    <>
      <button type="button" className={link ? styles.sourcesLink : `${styles.act} ${styles.actQuiet}`} onClick={() => dialogRef.current?.showModal()}>
        {link ? (
          `${count} ${count === 1 ? "source" : "sources"}`
        ) : (
          <>
            <Link2 size={17} aria-hidden="true" />
            Sources · {count}
          </>
        )}
      </button>
      <dialog
        ref={dialogRef}
        className={sheetStyles.sheet}
        aria-labelledby={`sources-${card.slug}`}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close(); // backdrop tap
        }}
      >
        <div className={sheetStyles.inner}>
          <div className={sheetStyles.grab} aria-hidden="true" />
          <div className={sheetStyles.head}>
            <h2 id={`sources-${card.slug}`} className={sheetStyles.title}>
              Sources
            </h2>
            <button type="button" className={sheetStyles.close} onClick={() => dialogRef.current?.close()} aria-label="Close">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <p className={sheetStyles.note}>
            {card.evidence.posts} {card.evidence.posts === 1 ? "mention" : "mentions"}
            {card.query ? ` of “${card.query.replaceAll('"', "")}”` : ""} on {card.evidence.site}, {windowLabel(card.evidence.days)}.
            {card.fresh ? " Strongest sources first:" : " Top recent ones:"}
          </p>
          <ul className={sheetStyles.list}>
            {card.sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className={sheetStyles.link}>
                  <span>
                    <span className={sheetStyles.linkTitle}>{src.title}</span>
                    <span className={sheetStyles.meta}>
                      {kindBadge(src) && <span className={sheetStyles.badge}>{kindBadge(src)}</span>}
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
