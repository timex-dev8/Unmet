"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Sparkles } from "lucide-react";
import SaveButton from "@/components/card/SaveButton";
import { entryFor, useBoard } from "@/lib/board";
import { categoryColor } from "@/lib/colors";
import { useInterests } from "@/lib/interests";
import { digDeeperHref } from "@/lib/links";
import { forYou, rising } from "@/lib/rank";
import { useThreads } from "@/lib/research-store";
import type { Depth } from "@/lib/research-types";
import { useSaved } from "@/lib/saved";
import type { Startup } from "@/lib/trustmrr";
import { CATEGORIES, type Card } from "@/lib/types";
import s from "./home.module.css";

const DEPTH_LABEL: Record<Depth, string> = { low: "Low", medium: "Medium", high: "High" };

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
      <section className={s.hero}>
        <h1 className={s.title}>What do you want to explore?</h1>
        <form className={s.composer} onSubmit={start}>
          <label htmlFor="home-q" className="sr-only">
            Describe a market or audience
          </label>
          <input
            id="home-q"
            className={s.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe a market, like “barbershop owners”"
            autoComplete="off"
            enterKeyHint="go"
          />
          <label className={s.depth}>
            <span className="sr-only">Research depth</span>
            <select value={depth} onChange={(e) => setDepth(e.target.value as Depth)}>
              {(Object.keys(DEPTH_LABEL) as Depth[]).map((d) => (
                <option key={d} value={d}>
                  {DEPTH_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={s.send} disabled={!input.trim()} aria-label="Start research">
            <ArrowUp size={20} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </form>
      </section>

      {showInterests && (
        <section className={s.interests} aria-labelledby="interests-title">
          <h2 id="interests-title" className={s.h2}>
            {interests.onboarded ? "Your interests" : "What do you care about?"}
          </h2>
          <div className={s.chips}>
            {CATEGORIES.map((c) => {
              const on = interests.picked.includes(c);
              const col = categoryColor(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={s.chip}
                  aria-pressed={on}
                  onClick={() => toggle(c)}
                  style={on ? { background: col.tint, color: col.ink, boxShadow: `inset 0 0 0 2px ${col.solid}` } : undefined}
                >
                  <span className={s.dot} style={{ background: col.solid }} aria-hidden="true" />
                  {c}
                  {on && <Check size={14} strokeWidth={2.8} aria-hidden="true" />}
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
          {picks.map((card) => (
            <HomeCard key={card.slug} card={card} />
          ))}
        </div>
      </section>

      <section className={s.tiles} aria-label="At a glance">
        {top && (
          <Link href={`/app/idea/${top.card.slug}`} className={s.tile} style={{ background: "var(--rise-tint)", color: "var(--rise-ink)" }}>
            <span className={s.tileLabel}>Rising this week</span>
            <span className={s.tileBig}>+{top.growth}%</span>
            <span className={s.tileText}>{top.card.headline}</span>
          </Link>
        )}
        <Link href="/app/board" className={s.tile} style={{ background: "var(--tint)", color: "var(--navy)" }}>
          <span className={s.tileLabel}>Your board</span>
          <span className={s.tileBig}>
            {saved.length} {saved.length === 1 ? "idea" : "ideas"}
          </span>
          <span className={s.tileText}>{saved.length ? `${advanced} moved past “Spotted”` : "Save ideas to start"}</span>
        </Link>
        <Link
          href={lastThread ? `/app/research/${lastThread.id}` : "/app/research"}
          className={s.tile}
          style={{ background: "var(--ai-tint)", color: "var(--ai-ink)" }}
        >
          <span className={s.tileLabel}>{lastThread ? "Continue research" : "Research"}</span>
          <span className={s.tileMid}>{lastThread ? lastThread.title : "Start your first"}</span>
          <span className={s.tileText}>{lastThread ? `${lastIdeas} ${lastIdeas === 1 ? "idea" : "ideas"}` : "Real complaints in about a minute"}</span>
        </Link>
        {startup && (
          <a href={startup.url} target="_blank" rel="noopener noreferrer" className={s.tile} style={{ background: "var(--c-work-tint)", color: "var(--c-work-ink)" }}>
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

function HomeCard({ card }: { card: Card }) {
  const col = categoryColor(card.category);
  const e = card.evidence;
  return (
    <article className={s.card}>
      <div className={s.strip} style={{ background: col.solid }} aria-hidden="true" />
      <div className={s.cardBody}>
        <span className={s.tag} style={{ background: col.tint, color: col.ink }}>
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
