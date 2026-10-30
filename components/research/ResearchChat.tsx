"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, BookmarkPlus, Check, ExternalLink, LoaderCircle, Sparkles, X } from "lucide-react";
import SaveButton from "@/components/card/SaveButton";
import ShareButton from "@/components/card/ShareButton";
import { IdeaSections } from "@/components/idea/IdeaDetail";
import { digDeeperHref } from "@/lib/links";
import { createThread, newId, updateThread, useStoreReady, useThread, type ChatMessage } from "@/lib/research-store";
import type { Depth, ResearchEvent } from "@/lib/research-types";
import { authHeaders, useLowOnly } from "@/lib/auth";
import { useSaved } from "@/lib/saved";
import type { Card } from "@/lib/types";
import DepthPicker from "./DepthPicker";
import ResearchCard from "./ResearchCard";
import s from "./research.module.css";

const EXAMPLES = [
  "I want to solve problems for barbershops",
  "What do people hate about Calendly?",
  "What frustrates freelance designers?",
  "Problems dog owners have with daycare",
  "Pain points of running a small restaurant",
];

type Context = Pick<Card, "slug" | "headline" | "summary">;

export default function ResearchChat({
  configured,
  threadId,
  initialQuery,
  initialDepth,
  about,
}: {
  configured: boolean;
  /** The conversation to show; empty for a new research. */
  threadId?: string;
  /** Starts a research right away (from Home, a card's "Dig deeper", or the Mind page). */
  initialQuery?: string;
  /** Depth chosen on Home. */
  initialDepth?: Depth;
  /** The idea a "Dig deeper" research is about, sent to the AI as context. */
  about?: Context;
}) {
  const router = useRouter();
  const ready = useStoreReady();
  const thread = useThread(threadId);
  const messages = thread?.messages ?? [];
  const [input, setInput] = useState("");
  const [depth, setDepth] = useState<Depth>(initialDepth ?? "medium");
  const lowOnly = useLowOnly(); // guests research on Low only
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = messages.some((m) => m.pending);

  const lastSteps = messages[messages.length - 1]?.steps?.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastSteps]);

  // Close the side panel with Escape.
  useEffect(() => {
    if (!openCard) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpenCard(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCard]);

  // Arriving with ?q= (Home, Dig deeper, Mind): start that research once.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !initialQuery || threadId) return;
    started.current = true;
    if (configured) void send(initialQuery);
    else router.replace("/app/research", { scroll: false });
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || !configured) return;

    // A new research gets its own thread and URL; the stream keeps writing to it by id.
    let tid = threadId;
    if (!tid) {
      tid = createThread(message);
      router.replace(`/app/research/${tid}`, { scroll: false });
    }
    const id = tid;
    const patch = (msgId: string, fn: (m: ChatMessage) => Partial<ChatMessage>) =>
      updateThread(id, (list) => list.map((m) => (m.id === msgId ? { ...m, ...fn(m) } : m)));

    const prior = messages.filter((m) => !m.error);
    const history = prior.slice(-8).map((m) => ({ role: m.role, text: m.text.slice(0, 1500) }));
    const cards: Context[] = [
      ...(about && !threadId ? [about] : []),
      ...prior.flatMap((m) => m.cards ?? []).map(({ slug, headline, summary }) => ({ slug, headline, summary })),
    ].slice(-12);

    const reply: ChatMessage = { id: newId(), role: "assistant", text: "", steps: [], pending: true };
    updateThread(id, (list) => [...list, { id: newId(), role: "user", text: message }, reply]);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ message, history, cards, depth: lowOnly ? "low" : depth }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        patch(reply.id, () => ({ text: body.error ?? "Something went wrong. Please try again.", error: true, pending: false }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ResearchEvent;
          if (event.type === "step") patch(reply.id, (m) => ({ steps: [...(m.steps ?? []), event.label] }));
          else if (event.type === "result")
            patch(reply.id, () => ({ text: event.answer, cards: event.cards, sourceCount: event.sourceCount, mix: event.mix, pending: false }));
          else patch(reply.id, () => ({ text: event.message, error: true, pending: false }));
        }
      }
      // Stream ended without a result (for example a timeout).
      patch(reply.id, (m) => (m.pending ? { text: "The research took too long. Please try again.", error: true, pending: false } : {}));
    } catch {
      patch(reply.id, () => ({ text: "Couldn’t reach Unmet. Check your connection and try again.", error: true, pending: false }));
    }
  }

  function submit() {
    const text = input;
    setInput("");
    send(text);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  if (threadId && ready && !thread) {
    return (
      <main className={`${s.chat} ${s.chatEmpty}`}>
        <div className={s.intro}>
          <h1 className={s.title}>This research isn’t on this device.</h1>
          <p className={s.lead}>Research is kept in the browser where you ran it, until accounts arrive.</p>
          <p>
            <Link href="/app/research" className="pill pill-dark">
              Start a new research
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const empty = messages.length === 0;
  const lastAnswerId = [...messages].reverse().find((m) => m.role === "assistant" && !m.pending && !m.error)?.id;

  return (
    <div className={s.layout}>
      <main className={`${s.chat} ${empty ? s.chatEmpty : ""}`}>
        {empty ? (
          <div className={s.intro}>
            <span className={s.badge}>
              <Sparkles size={14} aria-hidden="true" />
              AI research
            </span>
            <h1 className={s.title}>{about ? `Dig into “${about.headline}”` : "What problem space do you want to explore?"}</h1>
            <p className={s.lead}>Unmet searches recent posts across the web and turns real complaints into ideas, with sources.</p>
          </div>
        ) : (
          <div className={s.thread} aria-live="polite">
            <h1 className={s.threadTitle}>{thread?.title ?? "Research"}</h1>
            {messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} text={m.text} />
              ) : (
                <Reply key={m.id} m={m} isLast={m.id === lastAnswerId} onAsk={(q) => send(q)} onOpen={setOpenCard} openSlug={openCard?.slug} />
              ),
            )}
            <div ref={endRef} />
          </div>
        )}

        <div className={s.composerWrap}>
          {!configured && <p className={s.notice}>AI research is being switched on. Check back soon.</p>}
          <form className={s.composer} onSubmit={onSubmit}>
            <label htmlFor="research-input" className="sr-only">
              Describe a market or problem
            </label>
            <textarea
              id="research-input"
              className={s.input}
              rows={1}
              maxLength={500}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={empty ? "I want to solve problems for barbershops" : "Ask a follow-up or explore something new"}
              disabled={!configured}
            />
            <DepthPicker value={depth} onChange={setDepth} disabled={busy} placement={empty ? "down" : "up"} />
            <button type="submit" className={s.send} disabled={!input.trim() || busy || !configured} aria-label="Send">
              {busy ? <LoaderCircle size={20} className={s.spin} aria-hidden="true" /> : <ArrowUp size={20} aria-hidden="true" />}
            </button>
          </form>
          {empty && configured && !about && (
            <div className={s.examples}>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className={s.example} onClick={() => send(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {openCard && (
        <aside className={s.panel} aria-label="Idea details">
          <div className={s.panelBar}>
            <span className={s.panelLabel}>Idea</span>
            <div className={s.panelTools}>
              <Link href={`/app/idea/${openCard.slug}`} className={s.panelBtn} aria-label="Open as a full page">
                <ExternalLink size={16} aria-hidden="true" />
              </Link>
              <button type="button" className={s.panelBtn} onClick={() => setOpenCard(null)} aria-label="Close panel">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className={s.panelBody}>
            <IdeaSections card={openCard} headingLevel={2} />
          </div>
          <div className={s.panelActions}>
            <SaveButton card={openCard} label="Save idea" />
            <Link href={digDeeperHref(openCard)} className={s.digBtn}>
              <Sparkles size={15} aria-hidden="true" />
              Dig deeper
            </Link>
            <ShareButton card={openCard} />
          </div>
        </aside>
      )}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className={s.userRow}>
      <p className={s.user}>{text}</p>
    </div>
  );
}

function StepList({ steps, pending }: { steps: string[]; pending?: boolean }) {
  return (
    <ol className={s.steps}>
      {steps.map((step, i) => {
        const running = pending && i === steps.length - 1;
        return (
          <li key={i} className={`rise ${running ? s.stepRunning : ""}`}>
            {running ? <LoaderCircle size={15} className={s.spin} aria-hidden="true" /> : <Check size={15} className={s.pop} aria-hidden="true" />}
            {step}
          </li>
        );
      })}
    </ol>
  );
}

function Reply({
  m,
  isLast,
  onAsk,
  onOpen,
  openSlug,
}: {
  m: ChatMessage;
  isLast: boolean;
  onAsk: (q: string) => void;
  onOpen: (card: Card) => void;
  openSlug?: string;
}) {
  const steps = m.steps ?? [];
  const cards = m.cards ?? [];
  const { save, isSaved } = useSaved();
  const allSaved = cards.length > 0 && cards.every((c) => isSaved(c.slug));

  const followUps =
    cards.length >= 2
      ? ["Compare #1 and #2", "Who already solves #1?", "Which is easiest to start?"]
      : cards.length === 1
        ? ["Who already solves this?", "Find more evidence for #1"]
        : [];

  return (
    <div className={s.reply}>
      {steps.length > 0 && m.pending && <StepList steps={steps} pending />}
      {steps.length > 0 && !m.pending && (
        // Once done, the steps fold into one line; the detail is a tap away.
        <details className={s.stepsFold}>
          <summary>
            <Check size={14} aria-hidden="true" />
            {m.mix ?? `${steps.length} steps`}
          </summary>
          <StepList steps={steps} />
        </details>
      )}
      {m.pending && steps.length === 0 && (
        <p className={s.thinking}>
          <LoaderCircle size={15} className={s.spin} aria-hidden="true" /> Starting research…
        </p>
      )}
      {m.text && <p className={m.error ? s.error : s.answer}>{m.text}</p>}
      {cards.length > 0 && (
        <div className={s.cards}>
          {cards.map((card, i) => (
            <ResearchCard key={card.slug} card={card} index={i} onOpen={onOpen} selected={card.slug === openSlug} />
          ))}
        </div>
      )}
      {!m.pending && !m.error && m.sourceCount ? (
        <p className={s.footnote}>Sources from the last 12 months; every quote is checked against its source.</p>
      ) : null}
      {isLast && cards.length > 0 && (
        <div className={s.followUps}>
          <button type="button" className={s.addAll} onClick={() => cards.forEach(save)} disabled={allSaved}>
            {allSaved ? <Check size={15} aria-hidden="true" /> : <BookmarkPlus size={15} aria-hidden="true" />}
            {allSaved ? "On your board" : cards.length > 1 ? `Add all ${cards.length} to board` : "Add to board"}
          </button>
          {followUps.map((q) => (
            <button key={q} type="button" className={s.example} onClick={() => onAsk(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
