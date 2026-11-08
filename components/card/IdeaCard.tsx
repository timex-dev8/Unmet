import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { ideaHref } from "@/lib/links";
import type { Card, Idea } from "@/lib/types";
import { VERDICT, competitionLine } from "@/lib/verdict";
import SaveButton from "./SaveButton";
import SourcesSheet from "./SourcesSheet";
import f from "./ideaCard.module.css";

export default function IdeaCard({ card }: { card: Card }) {
  const idea = bestIdea(card.ideas);
  return (
    <article className={f.card} aria-labelledby={`h-${card.slug}`}>
      <div className={f.body}>
        <h2 id={`h-${card.slug}`} className={f.headline}>
          {card.headline}
        </h2>

        <p className={f.verdict}>
          {card.report && <strong className={f[card.report.verdict]}>{VERDICT[card.report.verdict].label}</strong>}
          <span className={f.reason}>{competitionLine(card.scores.competition)}</span>
        </p>

        {card.quote && <p className={f.quote}>“{card.quote}”</p>}

        <div className={f.proof}>
          <SourcesSheet card={card} link />
          <span aria-hidden="true">·</span>
          <span className={f.trend}>
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
          {card.sample ? <span className={f.sample}>Sample</span> : card.signal === "early" && <span className={f.sample}>Early signal</span>}
        </div>

        <p className={f.idea}>{idea ? <IdeaLine idea={idea} /> : "No idea checked yet. Open it to get one."}</p>

        <div className={f.bottom}>
          <Link href={ideaHref(card.slug)} className={`glossy ${f.primary}`} draggable={false}>
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
  return ideas.reduce<Idea | undefined>((best, i) => (!best || i.score > best.score ? i : best), undefined);
}

function IdeaLine({ idea }: { idea: Idea }) {
  const cut = idea.title.indexOf(": ");
  const name = cut < 0 ? idea.title : idea.title.slice(0, cut);
  const pitch = cut < 0 ? "" : idea.title.slice(cut + 2).trim();
  const price = idea.price.split(",")[0].trim();
  return (
    <>
      <strong>Idea to try: {name}</strong>
      {pitch ? `, ${pitch}.` : "."}
      {price && ` ${price}.`}
    </>
  );
}
