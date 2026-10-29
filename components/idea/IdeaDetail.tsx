import { ArrowUpRight } from "lucide-react";
import AppBar from "@/components/app/AppBar";
import { AiSuggestions, CardTags, Quote, shortDate, sourceMeta, Sparkline, windowLabel } from "@/components/card/parts";
import SaveButton from "@/components/card/SaveButton";
import ShareButton from "@/components/card/ShareButton";
import type { Card } from "@/lib/types";
import s from "./idea.module.css";

// The full idea page. Used by /idea/[slug] for feed cards and, in the browser,
// for ideas found in research chat (which aren't in the database yet).
export default function IdeaDetail({ card, backHref = "/feed", backLabel = "Feed" }: { card: Card; backHref?: string; backLabel?: string }) {
  const e = card.evidence;
  const yearly = e.days >= 365;
  const scores = [
    ["Demand", card.scores.demand],
    ["Competition", card.scores.competition],
    ["Difficulty", card.scores.difficulty],
  ] as const;

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <AppBar variant="back" backHref={backHref} backLabel={backLabel} />

        <header className={s.header}>
          <CardTags card={card} />
          <h1 className={s.h1}>{card.headline}</h1>
          <p className={s.summary}>{card.summary}</p>
          <p className={s.who}>
            <strong>Who:</strong> {card.who}
          </p>
        </header>

        <section className={s.section} aria-labelledby="evidence">
          <h2 id="evidence" className={s.h2}>
            Evidence
          </h2>
          <div className={s.box}>
            <div className={s.stats}>
              <div>
                <div className={s.stat}>{e.posts}</div>
                <div className={s.meta}>mentions</div>
              </div>
              <div>
                <div className={s.stat}>{e.threads}</div>
                <div className={s.meta}>{card.fresh ? "sources" : "threads"}</div>
              </div>
              <div>
                <div className={s.stat}>{yearly ? 12 : e.days}</div>
                <div className={s.meta}>{yearly ? "months" : "days"}</div>
              </div>
            </div>
            <div className={s.chart}>
              <Sparkline values={e.weekly} width={320} height={64} />
            </div>
            <div className={s.chartLabels}>
              <span>{yearly ? "12 months ago" : `${e.days} days ago`}</span>
              <span>{yearly ? "This month" : "This week"}</span>
            </div>
          </div>
          {card.quote && (
            <div className={s.box}>
              <Quote text={card.quote} highlight={card.highlight} className={s.quote} />
            </div>
          )}
        </section>

        <section className={s.section} aria-labelledby="sources">
          <h2 id="sources" className={s.h2}>
            Sources
          </h2>
          <ul className={`${s.box} ${s.sources}`}>
            {card.sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className={s.source}>
                  <span>
                    <span className={s.sourceTitle}>{src.title}</span>
                    <span className={s.meta}>{sourceMeta(src)}</span>
                  </span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          {card.query && (
            <p className={s.note}>
              {card.fresh ? "Found by Unmet research" : `Recent ${e.site} mentions`} for “{card.query.replaceAll('"', "")}”,{" "}
              {windowLabel(e.days)}
              {e.updatedAt ? `, pulled ${shortDate(e.updatedAt)}` : ""}.
            </p>
          )}
        </section>

        <section className={s.section} aria-labelledby="scores">
          <h2 id="scores" className={s.h2}>
            Why these scores
          </h2>
          <ul className={`${s.box} ${s.rows}`}>
            {scores.map(([name, sc]) => (
              <li key={name} className={s.row}>
                <span>
                  <span className={s.rowTitle}>
                    {name} · {sc.label}
                  </span>
                  <span className={s.meta}>{sc.reason}</span>
                </span>
                <span className={sc.basis === "ai" ? s.basisAi : s.basisData}>
                  {sc.basis === "ai" ? "AI estimate" : "Data"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {card.aiSuggestions.length > 0 && (
          <section className={`${s.section} ${s.last}`} aria-label="AI suggestions">
            <AiSuggestions card={card} />
          </section>
        )}
      </div>

      <div className={s.bottomBar}>
        <div className={s.bottomInner}>
          <SaveButton card={card} label="Save idea" />
          <ShareButton card={card} withLabel />
        </div>
      </div>
    </div>
  );
}
