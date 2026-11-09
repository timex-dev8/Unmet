"use client";

import type { CSSProperties, MouseEvent } from "react";
import Link from "next/link";
import { Quote } from "@/components/card/parts";
import SaveButton from "@/components/card/SaveButton";
import { ideaHref } from "@/lib/links";
import { sourceCount } from "@/lib/text";
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
  onOpen?: (card: Card, link: HTMLElement) => void;
  selected?: boolean;
}) {
  const ideas = card.ideas ?? [];
  const idea = ideas[0];
  const moreIdeas = ideas.length - 1;
  const verdict = card.report?.verdict;
  const label =
    card.signal === "niche"
      ? "Only 1 source so far: talk to people first"
      : card.signal === "early"
        ? "Only a few sources so far"
        : verdict === "strong" || verdict === "maybe"
          ? VERDICT[verdict].short
          : null;
  const sources = sourceCount(card);
  const open = (event: MouseEvent<HTMLElement>) => {
    if (onOpen && window.matchMedia("(min-width: 1100px)").matches) {
      event.preventDefault();
      onOpen(card, event.currentTarget);
    }
  };

  return (
    <article
      className={`${styles.card} ${selected ? styles.cardSelected : ""} rise`}
      style={{ "--i": index } as CSSProperties}
      aria-labelledby={`r-${card.slug}`}
    >
      <div className={styles.cardInner}>
        {label && <span className={`${styles.verdictTag} ${!card.signal && verdict === "strong" ? styles.verdictStrong : ""}`}>{label}</span>}
        <h3 id={`r-${card.slug}`} className={styles.cardTitle}>
          <Link href={ideaHref(card.slug)} onClick={open}>
            {card.headline}
          </Link>
        </h3>
        <p className={styles.cardSummary}>{card.summary}</p>
        {idea && (
          <div className={styles.cardIdea}>
            <p className={styles.cardIdeaLabel}>Idea to try</p>
            <p className={styles.cardIdeaTitle}>{idea.title}</p>
            <p className={styles.cardIdeaPitch}>{idea.pitch}</p>
            {moreIdeas > 0 && (
              <p className={styles.cardIdeaMore}>
                +{moreIdeas} more {moreIdeas === 1 ? "idea" : "ideas"}
              </p>
            )}
          </div>
        )}
        {card.quote && <Quote text={card.quote} highlight={card.highlight} className={styles.cardQuote} />}
        <div className={styles.cardFoot}>
          <strong>
            {sources} {sources === 1 ? "source" : "sources"}
          </strong>
          <SaveButton card={card} />
        </div>
      </div>
    </article>
  );
}
