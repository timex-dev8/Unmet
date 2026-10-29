"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUp, Check, Sparkles } from "lucide-react";
import { Sparkline, TrendBadge } from "@/components/card/parts";
import SaveButton from "@/components/card/SaveButton";
import { entryFor, STAGES, useBoard } from "@/lib/board";
import { useInterests } from "@/lib/interests";
import { forYou, rising } from "@/lib/rank";
import { digDeeperHref, researchHref } from "@/lib/links";
import { useThreads } from "@/lib/research-store";
import { useSaved } from "@/lib/saved";
import type { Startup } from "@/lib/trustmrr";
import { CATEGORIES, type Card } from "@/lib/types";
import s from "./home.module.css";

const EXAMPLES = ["Freelance designers", "Barbershop owners", "Dog owners", "Small restaurants"];


export default function Home({ cards, startups = [] }: { cards: Card[]; startups?: Startup[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const { saved } = useSaved();
  const board = useBoard();
  const { interests, toggle, finishOnboarding } = useInterests();
  const recent = useThreads().slice(0, 3);

  const picks = forYou(cards, { picked: interests.picked, skipped: interests.skipped, saved });
  const risingList = rising(cards);
  const matching = cards.filter((c) => interests.picked.includes(c.category)).length;

  function start(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (q) router.push(researchHref(q));
  }

  return (
    <main className={s.home}>
      <section className={s.hero}>
        <p className={s.eyebrow}>
          {interests.picked.length
            ? `${matching} ${matching === 1 ? "problem matches" : "problems match"} your interests`
            : "Real complaints, grouped into ideas, with sources"}
        </p>
        <h1 className={s.title}>What market do you want to explore?</h1>
        <form className={s.composer} onSubmit={start}>
          <label htmlFor="home-q" className="sr-only">
            Describe a market or audience
          </label>
          <input
            id="home-q"
            className={s.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="I want to solve problems for barbershops"
            autoComplete="off"
            enterKeyHint="go"
          />
          <button type="submit" className={s.send} disabled={!input.trim()} aria-label="Start research">
            <ArrowUp size={20} aria-hidden="true" />
          </button>
        </form>
        <div className={s.examples}>
          {EXAMPLES.map((ex) => (
            <Link key={ex} href={researchHref(ex)} className={s.example}>
              {ex}
            </Link>
          ))}
        </div>
      </section>

      {!interests.onboarded && (
        <section className={s.onboard} aria-labelledby="pick-title">
          <div>
            <h2 id="pick-title" className={s.h2}>
              Make it yours
            </h2>
            <p className={s.muted}>Pick the areas you care about. Your feed and “For you” will follow.</p>
          </div>
          <InterestChips picked={interests.picked} toggle={toggle} />
          <div className={s.onboardActions}>
            <button type="button" className="pill pill-dark" onClick={finishOnboarding} disabled={!interests.picked.length}>
              Done
            </button>
            <button type="button" className={s.textBtn} onClick={finishOnboarding}>
              Skip for now
            </button>
          </div>
        </section>
      )}

      <section aria-labelledby="for-you">
        <div className={s.sectionHead}>
          <h2 id="for-you" className={s.h2}>
            For you
          </h2>
          <Link href="/app/feed" className={s.headLink}>
            Open the feed <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {interests.onboarded && (
          <div id="interests" className={s.interestRow}>
            <span className={s.muted}>Based on</span>
            <InterestChips picked={interests.picked} toggle={toggle} small />
          </div>
        )}
        <div className={s.cards}>
          {picks.map((card) => (
            <HomeCard key={card.slug} card={card} />
          ))}
        </div>
      </section>

      <div className={s.split}>
        <section className={s.panel} aria-labelledby="rising">
          <div className={s.sectionHead}>
            <h2 id="rising" className={s.h2}>
              Rising
            </h2>
            <span className={s.muted}>mentions, recent weeks vs. earlier</span>
          </div>
          <ol className={s.risingList}>
            {risingList.map(({ card, growth }, i) => (
              <li key={card.slug}>
                <Link href={`/app/idea/${card.slug}`} className={s.risingRow}>
                  <span className={s.rank}>{i + 1}</span>
                  <span className={s.risingTitle}>{card.headline}</span>
                  <span className={s.risingCat}>{card.category}</span>
                  <Sparkline values={card.evidence.weekly} width={56} height={18} />
                  <span className={s.growth}>+{growth}%</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <div className={s.stack}>
          <section className={s.panel} aria-labelledby="board">
            <div className={s.sectionHead}>
              <h2 id="board" className={s.h2}>
                Your board
              </h2>
              <Link href="/app/board" className={s.headLink}>
                Open
              </Link>
            </div>
            {saved.length ? (
              <>
              <div className={s.stageCounts}>
                {STAGES.map((st) => (
                  <div key={st.id} className={s.stageCount}>
                    <b>{saved.filter((c) => entryFor(board, c.slug).stage === st.id).length}</b>
                    {st.label}
                  </div>
                ))}
              </div>
              <ul className={s.miniList}>
                {saved.slice(0, 3).map((c) => (
                  <li key={c.slug}>
                    <Link href={`/app/idea/${c.slug}`}>{c.headline}</Link>
                  </li>
                ))}
                {saved.length > 3 && <li className={s.muted}>+{saved.length - 3} more</li>}
              </ul>
              </>
            ) : (
              <p className={s.muted}>Save ideas from the feed or research and they collect here.</p>
            )}
          </section>

          <section className={s.panel} aria-labelledby="continue">
            <h2 id="continue" className={s.h2}>
              Continue research
            </h2>
            {recent.length ? (
              recent.map((t) => {
                const ideas = t.messages.flatMap((m) => m.cards ?? []).length;
                return (
                  <Link key={t.id} href={`/app/research/${t.id}`} className={s.continueRow}>
                    <span>{t.title}</span>
                    <span className={s.muted}>
                      {ideas} {ideas === 1 ? "idea" : "ideas"}
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className={s.muted}>No research yet. Describe a market above to start one.</p>
            )}
          </section>
        </div>
      </div>

      {startups.length > 0 && (
        <section className={s.panel} aria-labelledby="growing">
          <div className={s.sectionHead}>
            <h2 id="growing" className={s.h2}>
              Startups growing now
            </h2>
            <a href="https://trustmrr.com" target="_blank" rel="noopener noreferrer" className={s.headLink}>
              Revenue verified by TrustMRR
            </a>
          </div>
          <ul className={s.startups}>
            {startups.map((st) => (
              <li key={st.slug}>
                <a href={st.url} target="_blank" rel="noopener noreferrer" className={s.startupRow}>
                  <span className={s.startupMain}>
                    <span className={s.startupName}>{st.name}</span>
                    <span className={s.startupDesc}>{st.description}</span>
                  </span>
                  <span className={s.startupNums}>
                    <span className={s.startupMrr}>${Math.round(st.mrr / 100).toLocaleString("en-US")}/mo</span>
                    {st.growth != null && st.growth > 0 && <span className={s.growth}>+{st.growth}%</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function InterestChips({ picked, toggle, small }: { picked: string[]; toggle: (c: Card["category"]) => void; small?: boolean }) {
  return (
    <div className={s.chips}>
      {CATEGORIES.map((c) => {
        const on = picked.includes(c);
        return (
          <button
            key={c}
            type="button"
            className={`${s.chip} ${small ? s.chipSmall : ""} ${on ? s.chipOn : ""}`}
            aria-pressed={on}
            onClick={() => toggle(c)}
          >
            {on && <Check size={14} strokeWidth={2.6} aria-hidden="true" />}
            {c}
          </button>
        );
      })}
    </div>
  );
}

function HomeCard({ card }: { card: Card }) {
  const e = card.evidence;
  return (
    <article className={s.card}>
      <div className={s.cardMeta}>
        <span>{card.category}</span>
        <TrendBadge trend={card.trend} />
        {card.sample && <span className={s.sample}>Sample</span>}
      </div>
      <h3 className={s.cardTitle}>
        <Link href={`/app/idea/${card.slug}`}>{card.headline}</Link>
      </h3>
      <p className={s.cardSummary}>{card.summary}</p>
      <div className={s.cardEvidence}>
        <span>
          <strong>{e.posts} mentions</strong> · {e.site}
        </span>
        <Sparkline values={e.weekly} width={64} height={20} />
      </div>
      <div className={s.cardActions}>
        <SaveButton card={card} />
        <Link href={digDeeperHref(card)} className={s.dig}>
          <Sparkles size={14} aria-hidden="true" />
          Dig deeper
        </Link>
      </div>
    </article>
  );
}
