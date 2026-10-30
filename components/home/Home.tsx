"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import SaveButton from "@/components/card/SaveButton";
import DepthPicker from "@/components/research/DepthPicker";
import { entryFor, useBoard } from "@/lib/board";
import { useLowOnly } from "@/lib/auth";
import { useInterests } from "@/lib/interests";
import { forYou, profileKeywords, rising } from "@/lib/rank";
import { useThreads } from "@/lib/research-store";
import type { Depth } from "@/lib/research-types";
import { useSaved } from "@/lib/saved";
import type { Startup } from "@/lib/trustmrr";
import type { Card } from "@/lib/types";
import { Niches } from "./Interests";
import s from "./home.module.css";

export default function Home({ cards, startups = [] }: { cards: Card[]; startups?: Startup[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [depth, setDepth] = useState<Depth>("medium");
  const { saved } = useSaved();
  const board = useBoard();
  const { interests } = useInterests();
  const lowOnly = useLowOnly();
  const threads = useThreads();

  const picks = forYou(cards, { picked: interests.picked, skipped: interests.skipped, saved, keywords: profileKeywords(interests) });
  const top = rising(cards, 1)[0];
  const lastThread = threads[0];
  const lastIdeas = lastThread ? lastThread.messages.flatMap((m) => m.cards ?? []).length : 0;
  const advanced = saved.filter((c) => entryFor(board, c.slug).stage !== "spotted").length;
  const startup = startups[0];

  function start(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (q) router.push(`/app/research?q=${encodeURIComponent(q)}&depth=${lowOnly ? "low" : depth}`);
  }

  return (
    <main className={s.home} data-wash>
      <section className={`${s.hero} rise`}>
        <h1 className={s.title}>What do you want to explore?</h1>
        <p className={s.lede}>Name a market or a product. Unmet finds what people complain about and turns it into ideas worth building.</p>
        <form className={s.composer} onSubmit={start}>
          <label htmlFor="home-q" className="sr-only">
            Describe a market or audience
          </label>
          <input
            id="home-q"
            className={s.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Like “barbershops” or “Calendly”"
            autoComplete="off"
            enterKeyHint="go"
          />
          <DepthPicker value={depth} onChange={setDepth} />
          <button type="submit" className={s.send} disabled={!input.trim()} aria-label="Start research">
            <ArrowUp size={20} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </form>
      </section>

      <section className="rise" style={stagger(2)} aria-labelledby="niches-title">
        <h2 id="niches-title" className={`fade-text ${s.h2} ${s.nichesTitle}`}>
          Your niches
        </h2>
        <Niches />
      </section>

      <section aria-labelledby="for-you">
        <div className={s.sectionHead}>
          <h2 id="for-you" className={`fade-text ${s.h2}`}>
            For you
          </h2>
        </div>
        <div className={s.cards}>
          {picks.map((card, i) => (
            <HomeCard key={card.slug} card={card} i={i + 2} />
          ))}
        </div>
      </section>

      <section className={s.tiles} aria-label="At a glance">
        {top && (
          <Link href={`/app/idea/${top.card.slug}`} className={`${s.tile} ${s.tileBlue} rise`} style={stagger(4)}>
            <span className={s.tileLabel}>Rising this week</span>
            <span className={s.tileBig}>+{top.growth}%</span>
            <span className={s.tileText}>{top.card.headline}</span>
          </Link>
        )}
        <Link href="/app/board" className={`${s.tile} rise`} style={stagger(5)}>
          <span className={s.tileLabel}>Your board</span>
          <span className={s.tileBig}>
            {saved.length} {saved.length === 1 ? "idea" : "ideas"}
          </span>
          <span className={s.tileText}>{saved.length ? `${advanced} moved past “Spotted”` : "Save ideas to start"}</span>
        </Link>
        <Link href={lastThread ? `/app/research/${lastThread.id}` : "/app/research"} className={`${s.tile} rise`} style={stagger(6)}>
          <span className={s.tileLabel}>{lastThread ? "Continue research" : "Research"}</span>
          <span className={s.tileMid}>{lastThread ? lastThread.title : "Start your first"}</span>
          <span className={s.tileText}>
            {lastThread ? `${lastIdeas} ${lastIdeas === 1 ? "idea" : "ideas"}` : "Real complaints in about a minute"}
          </span>
        </Link>
        {startup && (
          <a href={startup.url} target="_blank" rel="noopener noreferrer" className={`${s.tile} rise`} style={stagger(6)}>
            <span className={s.tileLabel}>Startup growing now</span>
            <span className={s.tileMid}>{startup.name}</span>
            <span className={s.tileText}>
              ${Math.round(startup.mrr / 100).toLocaleString("en-US")}/mo verified{startup.growth ? ` · +${startup.growth}%` : ""}
            </span>
          </a>
        )}
      </section>
    </main>
  );
}

/** Delay for the shared `.rise` entrance (40ms per step, see globals.css). */
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

const VERDICT = { strong: "Strong opportunity", maybe: "Worth a closer look", weak: "Weak signal so far" } as const;

function HomeCard({ card, i }: { card: Card; i: number }) {
  const e = card.evidence;
  const sites = new Set(card.sources.map((x) => x.site)).size || 1;
  return (
    <article className={`${s.card} rise`} style={stagger(i)}>
      <div className={s.cardBody}>
        <span className={s.meta}>
          {card.category}
          {card.trend === "rising" ? " · ↑ Rising" : ""}
        </span>
        <h3 className={s.cardTitle}>
          <Link href={`/app/idea/${card.slug}`}>{card.headline}</Link>
        </h3>
        <p className={s.evidence}>
          {e.threads ? `${e.threads} sources on ${sites} ${sites === 1 ? "site" : "sites"}` : `${e.posts} mentions · ${e.site}`}
          {card.report ? ` · ${VERDICT[card.report.verdict]}` : ""}
          {card.sample ? " · sample" : ""}
        </p>
        <div className={s.cardActions}>
          <SaveButton card={card} small />
          <Link href={`/app/idea/${card.slug}`} className={s.more}>
            See ideas →
          </Link>
        </div>
      </div>
    </article>
  );
}
