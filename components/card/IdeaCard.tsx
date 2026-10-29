import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Card } from "@/lib/types";
import { ScoreBars, Sparkline, TrendBadge, windowLabel } from "./parts";
import SaveButton from "./SaveButton";
import ShareButton from "./ShareButton";
import SourcesSheet from "./SourcesSheet";
import s from "./card.module.css";
import f from "./ideaCard.module.css";

// The feed card, kept deliberately simple: the problem, one line of evidence, scores, actions.
// Quotes, score reasons and AI ideas live on the idea page.
export default function IdeaCard({ card }: { card: Card }) {
  const e = card.evidence;
  const topic = card.query?.replaceAll('"', "");
  return (
    <article className={f.card} aria-labelledby={`h-${card.slug}`}>
      <div className={f.meta}>
        <span>{card.category}</span>
        <TrendBadge trend={card.trend} />
        {card.sample && <span className={f.sample}>Sample</span>}
      </div>

      <h2 id={`h-${card.slug}`} className={f.headline}>
        {card.headline}
      </h2>
      <p className={f.summary}>{card.summary}</p>

      <div className={f.evidence}>
        <p className={f.evidenceText}>
          <strong>{e.posts} mentions</strong>
          {topic ? ` of “${topic}”` : ""} on {e.site} · {windowLabel(e.days)}
        </p>
        <Sparkline values={e.weekly} />
      </div>

      <ScoreBars card={card} />

      <div className={f.bottom}>
        <Link href={`/idea/${card.slug}`} className={f.details} draggable={false}>
          See details and AI ideas
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <div className={s.actions}>
          <SaveButton card={card} />
          <SourcesSheet card={card} />
          <ShareButton card={card} />
        </div>
      </div>
    </article>
  );
}
