import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import AppBar from "@/components/app/AppBar";
import { AiSuggestions, CardTags, kindBadge, Quote, shortDate, sourceMeta, Sparkline, windowLabel } from "@/components/card/parts";
import SaveButton from "@/components/card/SaveButton";
import ShareButton from "@/components/card/ShareButton";
import { digDeeperHref } from "@/lib/links";
import { formatMrr } from "@/lib/text";
import type { Card } from "@/lib/types";
import IdeasSection from "./IdeasSection";
import WorthBuilding from "./WorthBuilding";
import s from "./idea.module.css";

export default function IdeaDetail({ card, backHref = "/app/feed", backLabel = "Feed" }: { card: Card; backHref?: string; backLabel?: string }) {
  return (
    // data-hide-tabs: the idea action bar replaces the tab bar on phones
    <div className={s.page} data-hide-tabs>
      <div className={s.wrap}>
        <AppBar backHref={backHref} backLabel={backLabel} />
        <IdeaSections card={card} />
      </div>

      <div className={s.bottomBar}>
        <div className={s.bottomInner}>
          <SaveButton card={card} label="Save idea" />
          <Link href={digDeeperHref(card)} className={s.dig}>
            <Sparkles size={16} aria-hidden="true" />
            Dig deeper
          </Link>
          <ShareButton card={card} />
        </div>
      </div>
    </div>
  );
}

export function IdeaSections({ card, headingLevel = 1 }: { card: Card; headingLevel?: 1 | 2 }) {
  const Title = headingLevel === 1 ? "h1" : "h2";
  const e = card.evidence;
  const yearly = e.days >= 365;
  const scores = [
    ["Demand", card.scores.demand],
    ["Competition", card.scores.competition],
    ["Difficulty", card.scores.difficulty],
  ] as const;

  return (
    <>
      <header className={s.header}>
        <CardTags card={card} />
        <Title className={s.h1}>{card.headline}</Title>
        <p className={s.summary}>{card.summary}</p>
        <p className={s.who}>
          <strong>Who:</strong> {card.who}
        </p>
      </header>

      {card.report && <WorthBuilding report={card.report} />}

      {(card.ideas?.length || card.report) && <IdeasSection card={card} />}

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
              <a href={src.url} target="_blank" rel="noopener noreferrer ugc nofollow" className={s.source}>
                <span>
                  <span className={s.sourceTitle}>{src.title}</span>
                  <span className={s.meta}>
                    {kindBadge(src) && <span className={s.badge}>{kindBadge(src)}</span>}
                    {sourceMeta(src)}
                  </span>
                </span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        {card.query && (
          <p className={s.note}>
            {card.fresh ? "Found by Unmet research" : `Recent ${e.site} mentions`} for “{card.query.replaceAll('"', "")}”, {windowLabel(e.days)}
            {e.updatedAt ? `, pulled ${shortDate(e.updatedAt)}` : ""}.
          </p>
        )}
      </section>

      {card.competitors && card.competitors.length > 0 && (
        <section className={s.section} aria-labelledby="competitors">
          <h2 id="competitors" className={s.h2}>
            Who already solves this
          </h2>
          <ul className={`${s.box} ${s.sources}`}>
            {card.competitors.map((c) => (
              <li key={c.url}>
                <a href={c.url} target="_blank" rel="noopener noreferrer ugc nofollow" className={s.source}>
                  <span>
                    <span className={s.sourceTitle}>
                      {c.name}
                      {c.mrr ? <span className={s.mrr}>${formatMrr(c.mrr)}/mo verified</span> : null}
                    </span>
                    {c.note && <span className={s.meta}>{c.note}</span>}
                  </span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <p className={s.note}>Found by a quick web search and TrustMRR (revenue verified by payment providers). Not a full market map.</p>
        </section>
      )}

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
              <span className={sc.basis === "ai" ? s.basisAi : s.basisData}>{sc.basis === "ai" ? "AI estimate" : "Data"}</span>
            </li>
          ))}
        </ul>
      </section>

      {!card.ideas?.length && !card.report && card.aiSuggestions.length > 0 && (
        <section className={`${s.section} ${s.last}`} aria-label="AI suggestions">
          <AiSuggestions card={card} />
        </section>
      )}
    </>
  );
}
