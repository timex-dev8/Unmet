"use client";

import type { CSSProperties, MouseEvent } from "react";
import Link from "next/link";
import { Quote } from "@/components/card/parts";
import SaveButton from "@/components/card/SaveButton";
import { ideaHref } from "@/lib/links";
import { VERDICT } from "@/lib/verdict";
import type { Card } from "@/lib/types";
import s from "./research.module.css";

// A compact problem-and-idea pair for chat answers. Scores and sources are one tap away (side panel on wide screens, idea page on phones).
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
  const idea = card.ideas?.[0];
  const more = (card.ideas?.length ?? 0) - 1;
  const verdict = card.report?.verdict;
  // One plain label at most: how thin the evidence is, else a strong or maybe verdict.
  const label =
    card.signal === "niche"
      ? "Only 1 source so far: talk to people first"
      : card.signal === "early"
        ? "Only a few sources so far"
        : verdict === "strong" || verdict === "maybe"
          ? VERDICT[verdict].short
          : null;
  const n = card.evidence.threads;
  const open = (ev: MouseEvent) => {
    if (onOpen && window.matchMedia("(min-width: 1100px)").matches) {
      ev.preventDefault();
      onOpen(card);
    }
  };

  return (
    <article
      className={`${s.card} ${selected ? s.cardSelected : ""} rise`}
      style={{ "--i": index } as CSSProperties}
      aria-labelledby={`r-${card.slug}`}
    >
      <div className={s.cardInner}>
        {label && (
          <div className={s.cardMeta}>
            <span className={`${s.verdictTag} ${!card.signal && verdict === "strong" ? s.verdictStrong : ""}`}>{label}</span>
          </div>
        )}
        <h3 id={`r-${card.slug}`} className={s.cardTitle}>
          <Link href={ideaHref(card.slug)} onClick={open}>
            {card.headline}
          </Link>
        </h3>
        <p className={s.cardSummary}>{card.summary}</p>
        {idea && (
          <div className={s.cardIdea}>
            <p className={s.cardIdeaLabel}>Idea to try</p>
            <p className={s.cardIdeaTitle}>{idea.title}</p>
            <p className={s.cardIdeaPitch}>{idea.pitch}</p>
          </div>
        )}
        {card.quote && <Quote text={card.quote} highlight={card.highlight} className={s.cardQuote} />}
        <div className={s.cardFoot}>
          <span>
            <strong>
              {n} {n === 1 ? "source" : "sources"}
            </strong>
            {more > 0 ? ` · +${more} more ${more === 1 ? "idea" : "ideas"}` : ""}
          </span>
          <SaveButton card={card} />
        </div>
      </div>
    </article>
  );
}
