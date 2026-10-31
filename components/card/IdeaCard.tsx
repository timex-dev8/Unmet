import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { digDeeperHref, ideaHref } from "@/lib/links";
import type { Card } from "@/lib/types";
import { ScoreChips, Sparkline, windowLabel } from "./parts";
import SaveButton from "./SaveButton";
import ShareButton from "./ShareButton";
import SourcesSheet from "./SourcesSheet";
import s from "./card.module.css";
import f from "./ideaCard.module.css";

// The feed card: one meta line, the problem, one line of evidence, three score chips, actions. Quotes, score reasons and AI ideas live on the idea page.
export default function IdeaCard({ card }: { card: Card }) {
  const e = card.evidence;
  const topic = card.query?.replaceAll('"', "");
  return (
    <article className={f.card} aria-labelledby={`h-${card.slug}`}>
      <div className={f.body}>
        <div className={f.meta}>
          <span>
            {card.category} · {card.trend === "rising" ? "↑ Rising" : card.trend === "falling" ? "↓ Falling" : "Steady"} · {e.threads}{" "}
            {e.threads === 1 ? "source" : "sources"}
          </span>
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

        <ScoreChips card={card} />

        <div className={f.bottom}>
          <div className={s.actions}>
            <SaveButton card={card} />
            <Link href={digDeeperHref(card)} className={f.dig} draggable={false}>
              <Sparkles size={15} aria-hidden="true" />
              Dig deeper
            </Link>
            {/* Phones keep just Save and Details; the rest is on the idea page */}
            <span className={f.extra}>
              <SourcesSheet card={card} compact />
              <ShareButton card={card} />
            </span>
          </div>
          <Link href={ideaHref(card.slug)} className={f.details} draggable={false}>
            Details and AI ideas
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
