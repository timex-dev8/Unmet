"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Quote, ScoreBars, Sparkline, TrendBadge, windowLabel } from "@/components/card/parts";
import SaveButton from "@/components/card/SaveButton";
import SourcesSheet from "@/components/card/SourcesSheet";
import type { Card } from "@/lib/types";
import c from "@/components/card/card.module.css";
import s from "./research.module.css";

// A compact idea card for chat answers: problem, real quote, evidence, scores, actions.
// On wide screens, opening it shows the details in a side panel instead of leaving the chat.
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
  const e = card.evidence;
  const open = (ev: MouseEvent) => {
    if (onOpen && window.matchMedia("(min-width: 1100px)").matches) {
      ev.preventDefault();
      onOpen(card);
    }
  };

  return (
    <article className={`${s.card} ${selected ? s.cardSelected : ""}`} aria-labelledby={`r-${card.slug}`}>
      <div className={s.cardMeta}>
        <span className={s.num}>#{index + 1}</span>
        <span>{card.category}</span>
        <TrendBadge trend={card.trend} />
      </div>
      <h3 id={`r-${card.slug}`} className={s.cardTitle}>
        <Link href={`/app/idea/${card.slug}`} onClick={open}>
          {card.headline}
        </Link>
      </h3>
      <p className={s.cardSummary}>{card.summary}</p>
      {card.quote && <Quote text={card.quote} highlight={card.highlight} className={s.cardQuote} />}
      <div className={s.cardEvidence}>
        <span>
          <strong>
            {e.posts} {e.posts === 1 ? "mention" : "mentions"}
          </strong>{" "}
          across {e.threads} sources · {windowLabel(e.days)}
        </span>
        <Sparkline values={e.weekly} width={72} height={24} />
      </div>
      <ScoreBars card={card} />
      {card.competitors && card.competitors.length > 0 && (
        <p className={s.cardCompetitors}>
          Already tried by {card.competitors.slice(0, 3).map((c) => c.name).join(", ")}
          {card.competitors.length > 3 ? ` +${card.competitors.length - 3}` : ""}
        </p>
      )}
      <div className={c.actions}>
        <SaveButton card={card} />
        <SourcesSheet card={card} />
      </div>
      <Link href={`/app/idea/${card.slug}`} className={s.cardMore} onClick={open}>
        Details and AI ideas <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </article>
  );
}
