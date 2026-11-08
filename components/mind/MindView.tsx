"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Camera, ChevronDown, Dog, LoaderCircle, Scissors, Sprout, X, type LucideIcon } from "lucide-react";
import { ideaHref, researchHref } from "@/lib/links";
import { addThought, mindMark, removeThought, saveConclusion, useMind } from "@/lib/mind";
import type { MindBrief } from "@/lib/mind-types";
import { useThreads } from "@/lib/research-store";
import { useSaved } from "@/lib/saved";
import s from "./mind.module.css";

// Shape (route /app/mind): someone describes an idea in their own words, note by note, and the AI
// turns the notes into a clear brief.

const STARTERS = [
  { label: "A feature", text: "It should " },
  { label: "Who it’s for", text: "It’s for " },
  { label: "A worry", text: "I’m not sure about " },
];

const SPARKS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Dog, title: "Dog walkers", text: "A booking app for dog walkers with payments and reviews, not sure about pricing." },
  { icon: Scissors, title: "Barbershop no-shows", text: "Barbers lose slots to no-shows. I want deposits, but worry clients will hate it." },
  { icon: Camera, title: "Wedding photo backlog", text: "Photographers take weeks to cull photos. A tool that sorts the best shots first." },
  { icon: Sprout, title: "Plant care for renters", text: "Renters kill plants when they travel. Maybe a neighbour swap or reminders." },
];

const STEPS = ["Write rough notes", "Get a clear brief", "Know what to test first"];

/** Shown before the first brief, so people know what they'll get. */
const EXAMPLE: MindBrief = {
  idea: "A website where dog walkers take bookings, get paid and collect reviews in one place.",
  forWho: "Independent dog walkers who find clients on their own.",
  problem: "Bookings, payments and reviews are spread across texts, cash and word of mouth.",
  buildFirst: ["Booking calendar", "Online payments", "Reviews from owners"],
  later: ["Route planning"],
  questions: ["How will you charge: per walk, monthly, or a cut of each payment?"],
  nextStep: "Ask five local dog walkers how they take bookings and get paid today.",
  matchSlug: "",
  matchHeadline: "",
};

/** Delay for the shared `.rise` entrance (40ms per step, see globals.css). */
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

export default function MindView({ configured }: { configured: boolean }) {
  const { thoughts, conclusion: brief } = useMind();
  const { saved } = useSaved();
  const threads = useThreads();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);

  // The box grows as you type; shrink it back once a note is added and the text clears.
  useEffect(() => {
    if (!input && box.current) box.current.style.height = "";
  }, [input]);

  // Notes are stored newest first; show and send them in the order they were written.
  const notes = [...thoughts].reverse();
  const stale = Boolean(brief && (brief.count !== thoughts.length || thoughts.some((t) => t.at > brief.at)));

  function add() {
    addThought(input);
    setInput("");
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    add();
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      add();
    }
  }
  function spark(text: string) {
    addThought(text);
    box.current?.focus();
  }
  function start(text: string) {
    const next = input.trim() ? `${input.trimEnd()}\n${text}` : text;
    setInput(next);
    box.current?.focus();
    // After React writes the new value, put the cursor at its end.
    requestAnimationFrame(() => box.current?.setSelectionRange(next.length, next.length));
  }

  async function shape() {
    setLoading(true);
    setError("");
    const mark = mindMark();
    // The person's own problems: saved ideas and ideas from their research.
    const ideas = [...saved, ...threads.flatMap((t) => t.messages.flatMap((m) => m.cards ?? []))]
      .slice(0, 40)
      .map(({ slug, headline, summary }) => ({ slug, headline, summary }));
    try {
      const res = await fetch("/api/mind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thoughts: notes.slice(-120).map(({ id, text }) => ({ id, text })), ideas }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      saveConclusion(body as MindBrief, mark.at, mark.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const canShape = configured && notes.length > 0 && !loading;
  const empty = !brief && notes.length === 0;
  const showButton = !brief || stale || loading;

  return (
    <div className={`${s.page} ${empty ? s.empty : ""}`} data-wash={empty ? "" : undefined}>
      <header className={`${s.head} ${empty ? s.in : ""}`} style={stagger(0)}>
        <h1 className={s.title}>Shape your idea</h1>
        <p className={s.lead}>Turn your idea into a clear plan before you build.</p>
      </header>

      <div className={`${s.grid} ${brief ? s.split : ""}`}>
        <section className={s.write} aria-label="Your notes">
          <form className={`${s.composer} ${empty ? s.in : ""}`} style={stagger(1)} onSubmit={onSubmit}>
            <label htmlFor="note" className="sr-only">
              Describe your idea
            </label>
            <textarea
              id="note"
              ref={box}
              className={s.textarea}
              rows={2}
              maxLength={2000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${t.scrollHeight}px`;
              }}
              placeholder="I want to build… It should… I’m not sure about…"
            />
            <div className={s.bar}>
              <div className={s.chips}>
                {STARTERS.map((c) => (
                  <button key={c.label} type="button" className={s.chip} onMouseDown={(e) => e.preventDefault()} onClick={() => start(c.text)}>
                    + {c.label}
                  </button>
                ))}
              </div>
              <button type="submit" className={s.add} disabled={!input.trim()} aria-label="Add note">
                <ArrowUp size={18} aria-hidden="true" />
              </button>
            </div>
          </form>
          <p className={s.hint}>Enter adds a note · Shift + Enter for a new line</p>

          {notes.length > 0 && (
            <>
              <h2 className={s.label}>
                {notes.length} {notes.length === 1 ? "note" : "notes"}
              </h2>
              <ul className={s.notes}>
                {notes.map((t) => (
                  <li key={t.id} className={`${s.note} rise`}>
                    <p>{t.text}</p>
                    <button type="button" className={s.remove} onClick={() => removeThought(t.id)} aria-label={`Remove “${t.text.slice(0, 40)}”`}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {showButton && (
            <div className={s.action}>
              <button type="button" className={`pill glossy ${s.shape}`} onClick={shape} disabled={!canShape}>
                {loading && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
                {loading ? "Making it clear…" : brief ? "Update" : "Make it clear"}
              </button>
              {!configured ? (
                <p className={s.helper}>The AI is being switched on.</p>
              ) : notes.length === 0 ? (
                <p className={s.helper}>Add a note first. One long description is enough.</p>
              ) : (
                stale && !loading && <p className={s.helper}>Your notes changed since this brief.</p>
              )}
            </div>
          )}
          {empty && (
            <>
              <section className={`${s.sparks} ${s.in}`} style={stagger(2)} aria-labelledby="sparks-label">
                <h2 id="sparks-label" className={s.caption}>
                  Start from a spark
                </h2>
                <div className={s.sparkGrid}>
                  {SPARKS.map(({ icon: Icon, title, text }) => (
                    <button key={title} type="button" className={s.spark} onClick={() => spark(text)}>
                      <Icon size={20} className={s.sparkIcon} aria-hidden="true" />
                      <span className={s.sparkTitle}>{title}</span>
                      <span className={s.sparkText}>{text}</span>
                    </button>
                  ))}
                </div>
              </section>
              <ol className={`${s.steps} ${s.in}`} style={stagger(3)} aria-label="How it works">
                {STEPS.map((step, i) => (
                  <li key={step} className={s.step}>
                    <span className={s.stepNum} aria-hidden="true">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </>
          )}
          {!brief && (
            // The example stays folded away until asked for
            <details className={s.exampleToggle}>
              <summary>
                See an example brief
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <Brief brief={EXAMPLE} example />
            </details>
          )}
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
        </section>

        {brief && (
          <section className={s.side} aria-live="polite" aria-label="Your brief">
            <Brief brief={brief} count={brief.count} quiet={stale} />
          </section>
        )}
      </div>
    </div>
  );
}

function Brief({ brief, count, quiet, example }: { brief: MindBrief; count?: number; quiet?: boolean; example?: boolean }) {
  const sections: { title: string; body: string | string[]; numbered?: boolean }[] = [
    { title: "Who it’s for", body: brief.forWho },
    { title: "The problem it solves", body: brief.problem },
    { title: "Build first", body: brief.buildFirst, numbered: true },
    { title: "Later", body: brief.later },
    { title: "Unclear or risky", body: brief.questions },
    { title: "This week", body: brief.nextStep },
  ];
  const research = researchHref(brief.forWho ? `${brief.problem || brief.idea} (${brief.forWho})` : brief.problem || brief.idea);

  return (
    <article className={`${s.brief} ${example ? s.example : ""}`}>
      <p className={s.label}>{example ? "Example · what you’ll get" : "Your idea"}</p>
      <p className={s.idea}>{brief.idea}</p>
      {!example && (
        <p className={s.meta}>
          <strong>AI summary of your words, not evidence.</strong> From {count} {count === 1 ? "note" : "notes"}.
        </p>
      )}

      <div className={s.sections}>
        {sections.map((sec, i) => {
          const empty = Array.isArray(sec.body) ? sec.body.length === 0 : !sec.body.trim();
          if (empty && (sec.title === "Later" || sec.title === "Unclear or risky")) return null;
          const List = sec.numbered ? "ol" : "ul";
          return (
            <div key={sec.title} className={`${s.section} ${example ? "" : "rise"}`} style={stagger(i + 1)}>
              <h3 className={s.label}>{sec.title}</h3>
              {empty ? (
                <p className={s.missing}>Not clear from your notes yet.</p>
              ) : Array.isArray(sec.body) ? (
                <List className={s.list}>
                  {sec.body.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </List>
              ) : (
                <p className={s.text}>{sec.body}</p>
              )}
            </div>
          );
        })}
      </div>

      {!example && (
        <div className={s.actions}>
          <Link href={research} className={`pill ${quiet ? s.quietBtn : "glossy"} ${s.check}`}>
            Check demand <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {brief.matchSlug && (
            <Link href={ideaHref(brief.matchSlug)} className={s.match}>
              You’ve already found this problem: “{brief.matchHeadline || "see the evidence"}” →
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
