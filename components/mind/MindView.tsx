"use client";

import { useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, CircleHelp, LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { researchHref } from "@/lib/links";
import { addThoughts, removeThought, saveConclusion, useMind } from "@/lib/mind";
import type { MindConclusion } from "@/lib/mind-types";
import { useThreads } from "@/lib/research-store";
import { useSaved } from "@/lib/saved";
import s from "./mind.module.css";

const THEME_COLORS = ["blue", "purple", "green", "orange", "gray"] as const;

function ago(at: number) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** Delay for the shared `.rise` entrance (40ms per step, see globals.css). */
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

export default function MindView({ configured }: { configured: boolean }) {
  const { thoughts, conclusion } = useMind();
  const { saved } = useSaved();
  const threads = useThreads();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Which theme each thought belongs to, from the last conclusion.
  const themeOf = new Map<string, { name: string; color: (typeof THEME_COLORS)[number] }>();
  conclusion?.themes.forEach((t, i) => t.thoughtIds.forEach((id) => themeOf.set(id, { name: t.name, color: THEME_COLORS[i % THEME_COLORS.length] })));
  const stale = conclusion && conclusion.count !== thoughts.length;

  function add() {
    addThoughts(input);
    setInput("");
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    add();
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      add();
    }
  }

  async function conclude() {
    setLoading(true);
    setError("");
    // The person's own evidence: saved ideas and ideas from their research.
    const ideas = [...saved, ...threads.flatMap((t) => t.messages.flatMap((m) => m.cards ?? []))]
      .slice(0, 40)
      .map(({ slug, headline, summary }) => ({ slug, headline, summary }));
    try {
      const res = await fetch("/api/mind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thoughts: thoughts.slice(0, 120).map(({ id, text }) => ({ id, text })), ideas }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      saveConclusion(body as MindConclusion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const canConclude = configured && thoughts.length >= 2 && !loading;

  // Rendered in two places (top on phones, side on desktop); CSS shows one.
  const panel = (where: "top" | "side") => (
    <aside className={s.panel} aria-labelledby={`adds-up-${where}`}>
      <div className={s.panelHead}>
        <h2 id={`adds-up-${where}`} className={s.panelTitle}>
          <Sparkles size={15} aria-hidden="true" />
          What it adds up to
        </h2>
        {conclusion && (
          <button type="button" className={s.update} onClick={conclude} disabled={!canConclude}>
            {loading ? <LoaderCircle size={14} className={s.spin} aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
            Update
          </button>
        )}
      </div>

      {error && <p className={s.error}>{error}</p>}

      {!conclusion ? (
        <div className={s.emptyPanel}>
          <p>Write down everything you’re thinking: half-ideas, worries, things people told you. Then let Unmet find the thread.</p>
          <button type="button" className="pill pill-dark" onClick={conclude} disabled={!canConclude}>
            {loading ? <LoaderCircle size={16} className={s.spin} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
            {loading ? "Thinking…" : "What does it add up to?"}
          </button>
          {!configured ? (
            <p className={s.hint}>The AI is being switched on.</p>
          ) : (
            thoughts.length < 2 && <p className={s.hint}>Add at least 2 thoughts.</p>
          )}
        </div>
      ) : (
        <div className={s.conclusion} aria-live="polite">
          <div className="rise">
            <p className={s.label}>You keep coming back to</p>
            <p className={s.core}>{conclusion.core}</p>
            <p className={s.meta}>
              From {conclusion.count} thoughts · AI conclusion, not evidence
              {stale && " · new thoughts since, press Update"}
            </p>
          </div>

          {conclusion.themes.length > 0 && (
            <div className="rise" style={stagger(1)}>
              <p className={s.label}>Themes</p>
              <ul className={s.themes}>
                {conclusion.themes.map((t, i) => (
                  <li key={t.name}>
                    <span className={`${s.dot} ${s[THEME_COLORS[i % THEME_COLORS.length]]}`} aria-hidden="true" />
                    <span className={s.themeName}>{t.name}</span>
                    <span className={s.themeCount}>{t.thoughtIds.length}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conclusion.checks.length > 0 && (
            <div className="rise" style={stagger(2)}>
              <p className={s.label}>Evidence check</p>
              <ul className={s.checks}>
                {conclusion.checks.map((c) => (
                  <li key={c.claim}>
                    {c.idea ? (
                      <CircleCheck size={18} className={s.backed} aria-label="Backed by evidence" />
                    ) : (
                      <CircleHelp size={18} className={s.unchecked} aria-label="Not checked yet" />
                    )}
                    <span className={s.claim}>
                      {c.claim}
                      {c.idea ? (
                        <Link href={`/app/idea/${c.idea.slug}`} className={s.claimLink}>
                          Backed by “{c.idea.headline}”
                        </Link>
                      ) : (
                        <span className={s.claimMeta}>Not checked yet</span>
                      )}
                    </span>
                    {!c.idea && (
                      <Link href={researchHref(c.claim)} className={s.checkBtn}>
                        Research this
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conclusion.tension && (
            <div className={`${s.tension} rise`} style={stagger(3)}>
              <p className={s.label}>Tension</p>
              <p>{conclusion.tension}</p>
            </div>
          )}

          <div>
            <p className={s.label}>Suggested next step</p>
            <p className={s.next}>{conclusion.nextStep}</p>
            <Link href={researchHref(conclusion.core)} className={`pill pill-dark ${s.fullBtn}`}>
              Research this idea <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <div className={s.layout}>
      <main className={s.main}>
        <h1 className={s.title}>Mind</h1>
        <p className={s.lead}>
          Dump every thought, half-idea and worry. Unmet groups them, checks them against real evidence, and tells you what they add up to.
        </p>

        <div className={s.mobilePanel}>{panel("top")}</div>

        <form className={s.capture} onSubmit={onSubmit}>
          <label htmlFor="thought" className="sr-only">
            What’s on your mind?
          </label>
          <textarea
            id="thought"
            className={s.textarea}
            rows={2}
            maxLength={5000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="What’s on your mind? Paste a whole list if you like, one thought per line…"
          />
          <div className={s.captureBar}>
            <span className={s.hint}>Enter to add · Shift + Enter for a new line</span>
            <button type="submit" className="pill pill-dark" disabled={!input.trim()}>
              Add {input.includes("\n") ? "thoughts" : "thought"}
            </button>
          </div>
        </form>

        {thoughts.length > 0 ? (
          <>
            <p className={s.count}>
              {thoughts.length} {thoughts.length === 1 ? "thought" : "thoughts"}
            </p>
            <ul className={s.thoughts}>
              {thoughts.map((t) => {
                const theme = themeOf.get(t.id);
                return (
                  <li key={t.id} className={`${s.thought} rise`}>
                    <p>{t.text}</p>
                    {theme && <span className={`${s.tag} ${s[theme.color]}`}>{theme.name}</span>}
                    <span className={s.time}>{ago(t.at)}</span>
                    <button type="button" className={s.remove} onClick={() => removeThought(t.id)} aria-label={`Remove “${t.text.slice(0, 40)}”`}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className={s.emptyList}>Nothing here yet. Start with whatever you keep thinking about, even if it’s messy.</p>
        )}
      </main>

      <div className={s.desktopPanel}>{panel("side")}</div>
    </div>
  );
}
