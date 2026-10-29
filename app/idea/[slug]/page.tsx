import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import AppBar from "@/components/app/AppBar";
import { AiSuggestions, CardTags, Quote, shortDate, sourceMeta, Sparkline } from "@/components/card/parts";
import SaveButton from "@/components/card/SaveButton";
import ShareButton from "@/components/card/ShareButton";
import { getAllSlugs, getCard } from "@/lib/cards";
import s from "./idea.module.css";

// Known ideas are prerendered; new ones render on the server before sending.
export const instant = false;

export async function generateStaticParams() {
  return (await getAllSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/idea/[slug]">): Promise<Metadata> {
  const card = await getCard((await params).slug);
  if (!card) return { title: "Idea not found · Unmet" };
  return { title: `${card.headline} · Unmet`, description: card.summary };
}

export default async function IdeaPage({ params }: PageProps<"/idea/[slug]">) {
  const card = await getCard((await params).slug);
  if (!card) notFound();

  const e = card.evidence;
  const scores = [
    ["Demand", card.scores.demand],
    ["Competition", card.scores.competition],
    ["Difficulty", card.scores.difficulty],
  ] as const;

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <AppBar variant="back" backHref="/feed" backLabel="Feed" />

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
                <div className={s.meta}>threads</div>
              </div>
              <div>
                <div className={s.stat}>{e.days}</div>
                <div className={s.meta}>days</div>
              </div>
            </div>
            <div className={s.chart}>
              <Sparkline values={e.weekly} width={320} height={64} />
            </div>
            <div className={s.chartLabels}>
              <span>{e.days} days ago</span>
              <span>This week</span>
            </div>
          </div>
          <div className={s.box}>
            <Quote text={card.quote} highlight={card.highlight} className={s.quote} />
          </div>
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
              Recent {e.site} mentions of “{card.query.replaceAll('"', "")}”
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

        <section className={`${s.section} ${s.last}`} aria-label="AI suggestions">
          <AiSuggestions card={card} />
        </section>
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
