"use client";

import type { CSSProperties, MouseEvent } from "react";
import Link from "next/link";
import { Quote } from "@/components/card/parts";
import SaveButton from "@/components/card/SaveButton";
import { ideaHref } from "@/lib/links";
import { VERDICT } from "@/lib/verdict";
import type { Card } from "@/lib/types";
import styles from "./research.module.css";

export default function ResearchCard({
  card,
  index,
  onOpen,
  selected,
}: {
  card: Card;
  index: number;
  onOpen?: (card: Card) => void;
  selected?: boolean;
}) {
  const ideas = card.ideas ?? [];
  const verdict = card.report?.verdict;
  const label =
    card.signal === "niche"
      ? "Only 1 source so far: talk to people first"
      : card.signal === "early"
        ? "Only a few sources so far"
        : verdict === "strong" || verdict === "maybe"
          ? VERDICT[verdict].short
          : null;
  const threadCount = card.evidence.threads;
  const open = (event: MouseEvent) => {
    if (onOpen && window.matchMedia("(min-width: 1100px)").matches) {
      event.preventDefault();
      onOpen(card);
    }
  };

  return (
    <article
      className={`${styles.card} ${selected ? styles.cardSelected : ""} rise`}
      style={{ "--i": index } as CSSProperties}
      aria-labelledby={`r-${card.slug}`}
    >
      <div className={styles.cardInner}>
        {label && (
          <div className={styles.cardMeta}>
            <span className={`${styles.verdictTag} ${!card.signal && verdict === "strong" ? styles.verdictStrong : ""}`}>{label}</span>
          </div>
        )}
        <h3 id={`r-${card.slug}`} className={styles.cardTitle}>
          <Link href={ideaHref(card.slug)} onClick={open}>
            {card.headline}
          </Link>
        </h3>
        <p className={styles.cardSummary}>{card.summary}</p>
        {card.thoughts && <p className={styles.cardThoughts}>{card.thoughts}</p>}
        {ideas.map((idea) => (
          <div key={idea.title} className={styles.cardIdea}>
            <p className={styles.cardIdeaLabel}>Idea to try</p>
            <p className={styles.cardIdeaTitle}>{idea.title}</p>
            <p className={styles.cardIdeaPitch}>{idea.pitch}</p>
            {idea.shift && <p className={styles.cardIdeaPitch}>{idea.shift}</p>}
            {idea.twists?.map((twist) => (
              <p key={twist.name} className={styles.cardIdeaPitch}>
                <strong>{twist.name}:</strong> {twist.how}
              </p>
            ))}
            {idea.whyLove && <p className={styles.cardIdeaPitch}>{idea.whyLove}</p>}
          </div>
        ))}
        {card.quote && <Quote text={card.quote} highlight={card.highlight} className={styles.cardQuote} />}
        <div className={styles.cardFoot}>
          <span>
            <strong>
              {threadCount} {threadCount === 1 ? "source" : "sources"}
            </strong>
          </span>
          <SaveButton card={card} />
        </div>
      </div>
    </article>
  );
}
