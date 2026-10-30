"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Sparkles } from "lucide-react";
import SaveButton from "@/components/card/SaveButton";
import DepthPicker from "@/components/research/DepthPicker";
import { entryFor, useBoard } from "@/lib/board";
import { useInterests } from "@/lib/interests";
import { digDeeperHref } from "@/lib/links";
import { forYou, rising } from "@/lib/rank";
import { useThreads } from "@/lib/research-store";
import type { Depth } from "@/lib/research-types";
import { useSaved } from "@/lib/saved";
import type { Startup } from "@/lib/trustmrr";
import { CATEGORIES, type Card } from "@/lib/types";
import s from "./home.module.css";

export default function Home({ cards, startups = [] }: { cards: Card[]; startups?: Startup[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [depth, setDepth] = useState<Depth>("medium");
  const [editing, setEditing] = useState(false);
  const { saved } = useSaved();
  const board = useBoard();
  const { interests, toggle, finishOnboarding } = useInterests();
  const threads = useThreads();

  const picks = forYou(cards, { picked: interests.picked, skipped: interests.skipped, saved });
  const top = rising(cards, 1)[0];
  const lastThread = threads[0];
  const lastIdeas = lastThread ? lastThread.messages.flatMap((m) => m.cards ?? []).length : 0;
  const advanced = saved.filter((c) => entryFor(board, c.slug).stage !== "spotted").length;
  const startup = startups[0];
  const showInterests = !interests.onboarded || editing;

  function start(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (q) router.push(`/app/research?q=${encodeURIComponent(q)}&depth=${depth}`);
  }

  return (
    <main className={s.home}>
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
            placeholder="A market or a product, like “barbershops” or “Calendly”"
            autoComplete="off"
            enterKeyHint="go"
          />
          <DepthPicker value={depth} onChange={setDepth} />
          <button type="submit" className={s.send} disabled={!input.trim()} aria-label="Start research">
            <ArrowUp size={20} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </form>
      </section>

      {showInterests && (
        <section className={`${s.interests} rise`} style={stagger(2)} aria-labelledby="interests-title">
          <h2 id="interests-title" className={s.h2}>
            {interests.onboarded ? "Your interests" : "What do you care about?"}
          </h2>
          <div className={s.chips}>
            {CATEGORIES.map((c) => {
              const on = interests.picked.includes(c);
              return (
                <button key={c} type="button" className={s.chip} aria-pressed={on} onClick={() => toggle(c)}>
                  {c}
                  {on && <Check size={14} strokeWidth={2.8} className={s.check} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="pill pill-dark"
            onClick={() => {
              finishOnboarding();
              setEditing(false);
            }}
          >
            Done
          </button>
        </section>
      )}

      <section aria-labelledby="for-you">
        <div className={s.sectionHead}>
          <h2 id="for-you" className={s.h2}>
            For you
          </h2>
          {!showInterests && (
            <button type="button" className={s.linkBtn} onClick={() => setEditing(true)}>
              Edit interests
            </button>
          )}
        </div>
        <div className={s.cards}>
          {picks.map((card, i) => (
            <HomeCard key={card.slug} card={card} i={i + 2} />
          ))}
        </div>
      </section>

      <section className={s.tiles} aria-label="At a glance">
        {top && (
          <Link href={`/app/idea/${top.card.slug}`} className={`${s.tile} rise`} style={stagger(4)}>
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

function HomeCard({ card, i }: { card: Card; i: number }) {
  const e = card.evidence;
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
          <strong>{e.posts} mentions</strong> · {e.site}
          {card.sample ? " · sample" : ""}
        </p>
        <div className={s.cardActions}>
          <SaveButton card={card} />
          <Link href={digDeeperHref(card)} className={s.dig}>
            <Sparkles size={14} aria-hidden="true" />
            Dig deeper
          </Link>
        </div>
      </div>
    </article>
  );
}
