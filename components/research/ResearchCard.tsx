"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { Quote } from "@/components/card/parts";
import SaveButton from "@/components/card/SaveButton";
import { categoryColor } from "@/lib/colors";
import type { Card } from "@/lib/types";
import s from "./research.module.css";

// A compact idea card for chat answers: the claim and its evidence, nothing else.
// Scores, sources and AI ideas are one tap away (side panel on wide screens, idea page on phones).
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
  const col = categoryColor(card.category);
  const open = (ev: MouseEvent) => {
    if (onOpen && window.matchMedia("(min-width: 1100px)").matches) {
      ev.preventDefault();
      onOpen(card);
    }
  };

  return (
    <article className={`${s.card} ${selected ? s.cardSelected : ""}`} aria-labelledby={`r-${card.slug}`}>
      <div className={s.cardStrip} style={{ background: col.solid }} aria-hidden="true" />
      <div className={s.cardInner}>
        <div className={s.cardMeta}>
          <span className={s.cardTag} style={{ background: col.tint, color: col.ink }}>
            #{index + 1} · {card.category}
            {card.trend === "rising" ? " · ↑ Rising" : ""}
          </span>
          {card.signal === "early" && <span className={s.early}>Early signal</span>}
        </div>
        <h3 id={`r-${card.slug}`} className={s.cardTitle}>
          <Link href={`/app/idea/${card.slug}`} onClick={open}>
            {card.headline}
          </Link>
        </h3>
        {card.quote && <Quote text={card.quote} highlight={card.highlight} className={s.cardQuote} />}
        <div className={s.cardFoot}>
          <span>
            <strong>
              {e.threads} {e.threads === 1 ? "source" : "sources"}
            </strong>{" "}
            on {e.site}
          </span>
          <SaveButton card={card} />
        </div>
      </div>
    </article>
  );
}
