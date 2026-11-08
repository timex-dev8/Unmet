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
import styles from "./idea.module.css";

export default function IdeaDetail({ card, backHref = "/app/feed", backLabel = "Feed" }: { card: Card; backHref?: string; backLabel?: string }) {
  return (
    // data-hide-tabs: the idea action bar replaces the tab bar on phones
    <div className={styles.page} data-hide-tabs>
      <div className={styles.wrap}>
        <AppBar backHref={backHref} backLabel={backLabel} />
        <IdeaSections card={card} />
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.bottomInner}>
          <SaveButton card={card} label="Save idea" />
          <Link href={digDeeperHref(card)} className={styles.dig}>
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
  const evidence = card.evidence;
  const yearly = evidence.days >= 365;
  const scores = [
    ["Demand", card.scores.demand],
    ["Competition", card.scores.competition],
    ["Difficulty", card.scores.difficulty],
  ] as const;

  return (
    <>
      <header className={styles.header}>
        <CardTags card={card} />
        <Title className={styles.h1}>{card.headline}</Title>
        <p className={styles.summary}>{card.summary}</p>
        <p className={styles.who}>
          <strong>Who:</strong> {card.who}
        </p>
      </header>

      {card.report && <WorthBuilding report={card.report} />}

      {(card.ideas?.length || card.report) && <IdeasSection card={card} />}

      <section className={styles.section} aria-labelledby="evidence">
        <h2 id="evidence" className={styles.h2}>
          Evidence
        </h2>
        <div className={styles.box}>
          <div className={styles.stats}>
            <div>
              <div className={styles.stat}>{evidence.posts}</div>
              <div className={styles.meta}>mentions</div>
            </div>
            <div>
              <div className={styles.stat}>{evidence.threads}</div>
              <div className={styles.meta}>{card.fresh ? "sources" : "threads"}</div>
            </div>
            <div>
              <div className={styles.stat}>{yearly ? 12 : evidence.days}</div>
              <div className={styles.meta}>{yearly ? "months" : "days"}</div>
            </div>
          </div>
          <div className={styles.chart}>
            <Sparkline values={evidence.weekly} width={320} height={64} />
          </div>
          <div className={styles.chartLabels}>
            <span>{yearly ? "12 months ago" : `${evidence.days} days ago`}</span>
            <span>{yearly ? "This month" : "This week"}</span>
          </div>
        </div>
        {card.quote && (
          <div className={styles.box}>
            <Quote text={card.quote} highlight={card.highlight} className={styles.quote} />
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="sources">
        <h2 id="sources" className={styles.h2}>
          Sources
        </h2>
        <ul className={`${styles.box} ${styles.sources}`}>
          {card.sources.map((src) => (
            <li key={src.url}>
              <a href={src.url} target="_blank" rel="noopener noreferrer ugc nofollow" className={styles.source}>
                <span>
                  <span className={styles.sourceTitle}>{src.title}</span>
                  <span className={styles.meta}>
                    {kindBadge(src) && <span className={styles.badge}>{kindBadge(src)}</span>}
                    {sourceMeta(src)}
                  </span>
                </span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        {card.query && (
          <p className={styles.note}>
            {card.fresh ? "Found by Unmet research" : `Recent ${evidence.site} mentions`} for “{card.query.replaceAll('"', "")}”,{" "}
            {windowLabel(evidence.days)}
            {evidence.updatedAt ? `, pulled ${shortDate(evidence.updatedAt)}` : ""}.
          </p>
        )}
      </section>

      {card.competitors && card.competitors.length > 0 && (
        <section className={styles.section} aria-labelledby="competitors">
          <h2 id="competitors" className={styles.h2}>
            Who already solves this
          </h2>
          <ul className={`${styles.box} ${styles.sources}`}>
            {card.competitors.map((competitor) => (
              <li key={competitor.url}>
                <a href={competitor.url} target="_blank" rel="noopener noreferrer ugc nofollow" className={styles.source}>
                  <span>
                    <span className={styles.sourceTitle}>
                      {competitor.name}
                      {competitor.mrr ? <span className={styles.mrr}>${formatMrr(competitor.mrr)}/mo verified</span> : null}
                    </span>
                    {competitor.note && <span className={styles.meta}>{competitor.note}</span>}
                  </span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <p className={styles.note}>Found by a quick web search and TrustMRR (revenue verified by payment providers). Not a full market map.</p>
        </section>
      )}

      <section className={styles.section} aria-labelledby="scores">
        <h2 id="scores" className={styles.h2}>
          Why these scores
        </h2>
        <ul className={`${styles.box} ${styles.rows}`}>
          {scores.map(([name, sc]) => (
            <li key={name} className={styles.row}>
              <span>
                <span className={styles.rowTitle}>
                  {name} · {sc.label}
                </span>
                <span className={styles.meta}>{sc.reason}</span>
              </span>
              <span className={sc.basis === "ai" ? styles.basisAi : styles.basisData}>{sc.basis === "ai" ? "AI estimate" : "Data"}</span>
            </li>
          ))}
        </ul>
      </section>

      {!card.ideas?.length && !card.report && card.aiSuggestions.length > 0 && (
        <section className={`${styles.section} ${styles.last}`} aria-label="AI suggestions">
          <AiSuggestions card={card} />
        </section>
      )}
    </>
  );
}
