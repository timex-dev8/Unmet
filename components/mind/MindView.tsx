"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Camera, ChevronDown, Dog, LoaderCircle, Scissors, Sprout, X, type LucideIcon } from "lucide-react";
import { ideaHref, researchHref } from "@/lib/links";
import { addThought, mindMark, removeThought, saveConclusion, useMind } from "@/lib/mind";
import type { MindBrief } from "@/lib/mind-types";
import { useThreads } from "@/lib/research-store";
import { useSaved } from "@/lib/saved";
import styles from "./mind.module.css";

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

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

export default function MindView({ configured }: { configured: boolean }) {
  const { thoughts, conclusion: brief } = useMind();
  const { saved } = useSaved();
  const threads = useThreads();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const noteInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!input && noteInput.current) noteInput.current.style.height = "";
  }, [input]);

  // notes are stored newest first, send them in written order
  const notes = [...thoughts].reverse();
  const stale = Boolean(brief && (brief.count !== thoughts.length || thoughts.some((thought) => thought.at > brief.at)));

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
    noteInput.current?.focus();
  }
  function start(text: string) {
    const next = input.trim() ? `${input.trimEnd()}\n${text}` : text;
    setInput(next);
    noteInput.current?.focus();
    requestAnimationFrame(() => noteInput.current?.setSelectionRange(next.length, next.length));
  }

  async function shape() {
    setLoading(true);
    setError("");
    const mark = mindMark();
    const ideas = [...saved, ...threads.flatMap((thread) => thread.messages.flatMap((chatMessage) => chatMessage.cards ?? []))]
      .slice(0, 40)
      .map(({ slug, headline, summary }) => ({ slug, headline, summary }));
    try {
      const response = await fetch("/api/mind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thoughts: notes.slice(-120).map(({ id, text }) => ({ id, text })), ideas }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
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
    <div className={`${styles.page} ${empty ? styles.empty : ""}`} data-wash={empty ? "" : undefined}>
      <header className={`${styles.head} ${empty ? styles.in : ""}`} style={stagger(0)}>
        <h1 className={styles.title}>Shape your idea</h1>
        <p className={styles.lead}>Turn your idea into a clear plan before you build.</p>
      </header>

      <div className={`${styles.grid} ${brief ? styles.split : ""}`}>
        <section className={styles.write} aria-label="Your notes">
          <form className={`${styles.composer} ${empty ? styles.in : ""}`} style={stagger(1)} onSubmit={onSubmit}>
            <label htmlFor="note" className="sr-only">
              Describe your idea
            </label>
            <textarea
              id="note"
              ref={noteInput}
              className={styles.textarea}
              rows={2}
              maxLength={2000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onInput={(e) => {
                const textarea = e.currentTarget;
                textarea.style.height = "auto";
                textarea.style.height = `${textarea.scrollHeight}px`;
              }}
              placeholder="I want to build… It should… I’m not sure about…"
            />
            <div className={styles.bar}>
              <div className={styles.chips}>
                {STARTERS.map((starter) => (
                  <button
                    key={starter.label}
                    type="button"
                    className={styles.chip}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => start(starter.text)}
                  >
                    + {starter.label}
                  </button>
                ))}
              </div>
              <button type="submit" className={styles.add} disabled={!input.trim()} aria-label="Add note">
                <ArrowUp size={18} aria-hidden="true" />
              </button>
            </div>
          </form>
          <p className={styles.hint}>Enter adds a note · Shift + Enter for a new line</p>

          {notes.length > 0 && (
            <>
              <h2 className={styles.label}>
                {notes.length} {notes.length === 1 ? "note" : "notes"}
              </h2>
              <ul className={styles.notes}>
                {notes.map((note) => (
                  <li key={note.id} className={`${styles.note} rise`}>
                    <p>{note.text}</p>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => removeThought(note.id)}
                      aria-label={`Remove “${note.text.slice(0, 40)}”`}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {showButton && (
            <div className={styles.action}>
              <button type="button" className={`pill glossy ${styles.shape}`} onClick={shape} disabled={!canShape}>
                {loading && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
                {loading ? "Making it clear…" : brief ? "Update" : "Make it clear"}
              </button>
              {!configured ? (
                <p className={styles.helper}>The AI is being switched on.</p>
              ) : notes.length === 0 ? (
                <p className={styles.helper}>Add a note first. One long description is enough.</p>
              ) : (
                stale && !loading && <p className={styles.helper}>Your notes changed since this brief.</p>
              )}
            </div>
          )}
          {empty && (
            <>
              <section className={`${styles.sparks} ${styles.in}`} style={stagger(2)} aria-labelledby="sparks-label">
                <h2 id="sparks-label" className={styles.caption}>
                  Start from a spark
                </h2>
                <div className={styles.sparkGrid}>
                  {SPARKS.map(({ icon: Icon, title, text }) => (
                    <button key={title} type="button" className={styles.spark} onClick={() => spark(text)}>
                      <Icon size={20} className={styles.sparkIcon} aria-hidden="true" />
                      <span className={styles.sparkTitle}>{title}</span>
                      <span className={styles.sparkText}>{text}</span>
                    </button>
                  ))}
                </div>
              </section>
              <ol className={`${styles.steps} ${styles.in}`} style={stagger(3)} aria-label="How it works">
                {STEPS.map((step, i) => (
                  <li key={step} className={styles.step}>
                    <span className={styles.stepNum} aria-hidden="true">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </>
          )}
          {!brief && (
            <details className={styles.exampleToggle}>
              <summary>
                See an example brief
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <Brief brief={EXAMPLE} example />
            </details>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>

        {brief && (
          <section className={styles.side} aria-live="polite" aria-label="Your brief">
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
    <article className={`${styles.brief} ${example ? styles.example : ""}`}>
      <p className={styles.label}>{example ? "Example · what you’ll get" : "Your idea"}</p>
      <p className={styles.idea}>{brief.idea}</p>
      {!example && (
        <p className={styles.meta}>
          <strong>AI summary of your words, not evidence.</strong> From {count} {count === 1 ? "note" : "notes"}.
        </p>
      )}

      <div className={styles.sections}>
        {sections.map((section, i) => {
          const empty = Array.isArray(section.body) ? section.body.length === 0 : !section.body.trim();
          if (empty && (section.title === "Later" || section.title === "Unclear or risky")) return null;
          const List = section.numbered ? "ol" : "ul";
          return (
            <div key={section.title} className={`${styles.section} ${example ? "" : "rise"}`} style={stagger(i + 1)}>
              <h3 className={styles.label}>{section.title}</h3>
              {empty ? (
                <p className={styles.missing}>Not clear from your notes yet.</p>
              ) : Array.isArray(section.body) ? (
                <List className={styles.list}>
                  {section.body.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </List>
              ) : (
                <p className={styles.text}>{section.body}</p>
              )}
            </div>
          );
        })}
      </div>

      {!example && (
        <div className={styles.actions}>
          <Link href={research} className={`pill ${quiet ? styles.quietBtn : "glossy"} ${styles.check}`}>
            Check demand <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {brief.matchSlug && (
            <Link href={ideaHref(brief.matchSlug)} className={styles.match}>
              You’ve already found this problem: “{brief.matchHeadline || "see the evidence"}” →
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
