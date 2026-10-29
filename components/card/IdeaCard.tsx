import Link from "next/link";
import type { Card } from "@/lib/types";
import { AiSuggestions, CardTags, EvidenceBox, ScoreBars } from "./parts";
import SaveButton from "./SaveButton";
import ShareButton from "./ShareButton";
import SourcesSheet from "./SourcesSheet";
import s from "./card.module.css";
import f from "./ideaCard.module.css";

// The feed card: evidence first, AI ideas clearly separated, actions at the bottom.
export default function IdeaCard({ card }: { card: Card }) {
  return (
    <article className={f.card} aria-labelledby={`h-${card.slug}`}>
      <CardTags card={card} />
      <div>
        <h2 id={`h-${card.slug}`} className={f.headline}>
          <Link href={`/idea/${card.slug}`} draggable={false}>
            {card.headline}
          </Link>
        </h2>
        <p className={f.summary}>{card.summary}</p>
      </div>
      <EvidenceBox card={card} />
      <ScoreBars card={card} />
      <div className={f.aiWrap}>
        <AiSuggestions card={card} limit={2} />
      </div>
      <div className={`${s.actions} ${f.actions}`}>
        <SaveButton card={card} />
        <SourcesSheet card={card} />
        <ShareButton card={card} />
      </div>
    </article>
  );
}
