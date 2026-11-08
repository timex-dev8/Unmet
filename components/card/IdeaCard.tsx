import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { ideaHref } from "@/lib/links";
import type { Card, Idea } from "@/lib/types";
import { VERDICT, competitionLine } from "@/lib/verdict";
import SaveButton from "./SaveButton";
import SourcesSheet from "./SourcesSheet";
import styles from "./ideaCard.module.css";

export default function IdeaCard({ card }: { card: Card }) {
  const idea = bestIdea(card.ideas);
  return (
    <article className={styles.card} aria-labelledby={`h-${card.slug}`}>
      <div className={styles.body}>
        <h2 id={`h-${card.slug}`} className={styles.headline}>
          {card.headline}
        </h2>

        <p className={styles.verdict}>
          {card.report && <strong className={styles[card.report.verdict]}>{VERDICT[card.report.verdict].label}</strong>}
          <span className={styles.reason}>{competitionLine(card.scores.competition)}</span>
        </p>

        {card.quote && <p className={styles.quote}>“{card.quote}”</p>}

        <div className={styles.proof}>
          <SourcesSheet card={card} link />
          <span aria-hidden="true">·</span>
          <span className={styles.trend}>
            {card.trend === "rising" ? (
              <>
                <ArrowUp size={14} aria-hidden="true" />
                Rising
              </>
            ) : card.trend === "falling" ? (
              <>
                <ArrowDown size={14} aria-hidden="true" />
                Falling
              </>
            ) : (
              "Steady"
            )}
          </span>
          <span aria-hidden="true">·</span>
          <span>{card.category}</span>
          {card.sample ? (
            <span className={styles.sample}>Sample</span>
          ) : (
            card.signal === "early" && <span className={styles.sample}>Early signal</span>
          )}
        </div>

        <p className={styles.idea}>{idea ? <IdeaLine idea={idea} /> : "No idea checked yet. Open it to get one."}</p>

        <div className={styles.bottom}>
          <Link href={ideaHref(card.slug)} className={`glossy ${styles.primary}`} draggable={false}>
            {idea ? "See the idea" : "See the proof"}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <SaveButton card={card} quiet />
        </div>
      </div>
    </article>
  );
}

function bestIdea(ideas: Idea[] = []) {
  return ideas.reduce<Idea | undefined>((best, candidate) => (!best || candidate.score > best.score ? candidate : best), undefined);
}

function IdeaLine({ idea }: { idea: Idea }) {
  const colonIndex = idea.title.indexOf(": ");
  const name = colonIndex < 0 ? idea.title : idea.title.slice(0, colonIndex);
  const pitch = colonIndex < 0 ? "" : idea.title.slice(colonIndex + 2).trim();
  const price = idea.price.split(",")[0].trim();
  return (
    <>
      <strong>Idea to try: {name}</strong>
      {pitch ? `, ${pitch}.` : "."}
      {price && ` ${price}.`}
    </>
  );
}
