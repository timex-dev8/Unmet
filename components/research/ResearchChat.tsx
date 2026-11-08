"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, BookmarkPlus, Check, ChevronRight, ExternalLink, LoaderCircle, Sparkles, X } from "lucide-react";
import SaveButton from "@/components/card/SaveButton";
import ShareButton from "@/components/card/ShareButton";
import { IdeaSections } from "@/components/idea/IdeaDetail";
import { digDeeperHref, ideaHref } from "@/lib/links";
import { createThread, newId, updateThread, useStoreReady, useThread, useThreads, type ChatMessage } from "@/lib/research-store";
import { EXAMPLE_SEARCHES, type Depth, type ResearchEvent } from "@/lib/research-types";
import { authHeaders, useGuest, useLowOnly, useUser } from "@/lib/auth";
import { useSaved } from "@/lib/saved";
import type { Card } from "@/lib/types";
import DepthPicker from "./DepthPicker";
import ResearchCard from "./ResearchCard";
import s from "./research.module.css";

type Context = Pick<Card, "slug" | "headline" | "summary">;

export default function ResearchChat({
  configured,
  threadId,
  initialQuery,
  initialDepth,
  about,
}: {
  configured: boolean;
  threadId?: string;
  initialQuery?: string;
  initialDepth?: Depth;
  about?: Context;
}) {
  const router = useRouter();
  const ready = useStoreReady();
  const thread = useThread(threadId);
  const messages = thread?.messages ?? [];
  const [input, setInput] = useState("");
  const [depth, setDepth] = useState<Depth>(initialDepth ?? "medium");
  const lowOnly = useLowOnly(); // guests get low only
  // undefined until session and guest flag are read, lowOnly isnt final before that
  const user = useUser();
  const guest = useGuest();
  const authKnown = user !== undefined && guest !== undefined;
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = messages.some((m) => m.pending);

  const lastSteps = messages[messages.length - 1]?.steps?.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastSteps]);

  useEffect(() => {
    if (!openCard) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpenCard(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCard]);

  // start the ?q= research once auth is known so ?depth=high doesnt run as a guests low
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !initialQuery || threadId || !authKnown) return;
    started.current = true;
    if (configured) void send(initialQuery);
    else router.replace("/app/research", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authKnown]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || !configured || !authKnown) return; // lowOnly would submit a low run before auth is known

    // new research gets its own thread and url, the stream writes to it by id
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
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let event: ResearchEvent;
            try {
              event = JSON.parse(line) as ResearchEvent;
            } catch {
              continue; // one bad line shouldnt kill the stream
            }
            if (event.type === "step") patch(reply.id, (m) => ({ steps: [...(m.steps ?? []), event.label] }));
            else if (event.type === "result")
              patch(reply.id, () => ({
                text: event.answer,
                cards: event.cards,
                sourceCount: event.sourceCount,
                mix: event.mix,
                suggestions: event.suggestions,
                pending: false,
              }));
            else patch(reply.id, () => ({ text: event.message, error: true, pending: false }));
          }
        }
      } catch (err) {
        void reader.cancel().catch(() => {});
        throw err;
      }
      patch(reply.id, (m) => (m.pending ? { text: "The research took too long. Please try again.", error: true, pending: false } : {}));
    } catch {
      patch(reply.id, () => ({ text: "Couldn’t reach Unmet. Check your connection and try again.", error: true, pending: false }));
    }
  }

  function submit() {
    if (!authKnown) return;
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
          <div className={s.intro} data-wash>
            <h1 className={s.title}>{about ? `Dig into “${about.headline}”` : "What do you want to find out?"}</h1>
            <p className={s.lead}>
              Ask about anything, or say you have no idea yet. You’ll get real problems people complain about, and ideas to solve them.
            </p>
          </div>
        ) : (
          <div className={s.thread} aria-live="polite">
            <h1 className={s.threadTitle}>{thread?.title ?? "Research"}</h1>
            {messages.map((m, idx) =>
              m.role === "user" ? (
                <UserBubble key={m.id} text={m.text} />
              ) : (
                <Reply
                  key={m.id}
                  m={m}
                  isLast={m.id === lastAnswerId}
                  lastQuery={messages.slice(0, idx).findLast((x) => x.role === "user")?.text ?? ""}
                  onAsk={(q) => send(q)}
                  onOpen={setOpenCard}
                  openSlug={openCard?.slug}
                />
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
              maxLength={800}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={empty ? "I don’t know what to build, give me ideas" : "Ask a follow-up or explore something new"}
              disabled={!configured}
            />
            {!lowOnly && <DepthPicker value={depth} onChange={setDepth} disabled={busy} placement={empty ? "down" : "up"} />}
            <button type="submit" className={`glossy ${s.send}`} disabled={!input.trim() || busy || !configured || !authKnown} aria-label="Send">
              {busy ? <LoaderCircle size={20} className="spin" aria-hidden="true" /> : <ArrowUp size={20} aria-hidden="true" />}
            </button>
          </form>
          {empty && configured && !about && <PastResearch onTry={send} />}
        </div>
      </main>

      {openCard && (
        <aside className={s.panel} aria-label="Idea details">
          <div className={s.panelBar}>
            <span className={s.panelLabel}>Idea</span>
            <div className={s.panelTools}>
              <Link href={ideaHref(openCard.slug)} className={s.panelBtn} aria-label="Open as a full page">
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
            {running ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Check size={15} className={s.pop} aria-hidden="true" />}
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
  lastQuery,
  onAsk,
  onOpen,
  openSlug,
}: {
  m: ChatMessage;
  isLast: boolean;
  lastQuery: string;
  onAsk: (q: string) => void;
  onOpen: (card: Card) => void;
  openSlug?: string;
}) {
  const steps = m.steps ?? [];
  const cards = m.cards ?? [];
  const { save, isSaved } = useSaved();
  const allSaved = cards.length > 0 && cards.every((c) => isSaved(c.slug));

  const niche = cards.filter((c) => c.signal === "niche");
  const popular = cards.filter((c) => c.signal !== "niche");
  const both = niche.length > 0 && popular.length > 0;
  const suggestions = m.suggestions ?? [];
  const followUps = [
    ...(lastQuery ? [{ label: "Find more niche problems", query: `Find more niche problems: ${lastQuery}` }] : []),
    ...(cards.length > 1 ? [{ label: "Which is easiest to build?", query: "Which is easiest to build?" }] : []),
    ...suggestions.map((q) => ({ label: q, query: q })),
  ];
  const showFootnote = !m.pending && !m.error && m.sourceCount && cards.length > 0;
  const group = (list: Card[], heading: string | null, offset: number) => (
    <>
      {heading && <h2 className={s.groupTitle}>{heading}</h2>}
      <div className={s.cards}>
        {list.map((card, i) => (
          <ResearchCard key={card.slug} card={card} index={offset + i} onOpen={onOpen} selected={card.slug === openSlug} />
        ))}
      </div>
    </>
  );

  return (
    <div className={s.reply}>
      {steps.length > 0 && m.pending && <StepList steps={steps} pending />}
      {steps.length > 0 && !m.pending && m.mix && (
        <details className={s.stepsFold}>
          <summary>
            <Check size={14} aria-hidden="true" />
            {m.mix}
          </summary>
          <StepList steps={steps} />
        </details>
      )}
      {m.pending && steps.length === 0 && (
        <p className={s.thinking}>
          <LoaderCircle size={15} className="spin" aria-hidden="true" /> Starting research…
        </p>
      )}
      {m.text && <p className={m.error ? s.error : s.answer}>{m.text}</p>}
      {popular.length > 0 && group(popular, both ? "Main problems" : null, 0)}
      {niche.length > 0 && group(niche, "Niche problems: smaller and less proven", popular.length)}
      {showFootnote ? <p className={s.footnote}>Sources from the last 12 months; every quote is checked against its source.</p> : null}
      {!m.pending && !m.error && cards.length === 0 && suggestions.length > 0 && (
        <div className={s.followUps}>
          {suggestions.map((q) => (
            <button key={q} type="button" className={s.example} onClick={() => onAsk(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      {isLast && cards.length > 0 && (
        <div className={s.followUps}>
          <button type="button" className={s.addAll} onClick={() => cards.forEach(save)} disabled={allSaved}>
            {allSaved ? <Check size={15} aria-hidden="true" /> : <BookmarkPlus size={15} aria-hidden="true" />}
            {allSaved ? "On your board" : cards.length > 1 ? `Add all ${cards.length} to board` : "Add to board"}
          </button>
          {followUps.map((f, i) => (
            <button key={f.label} type="button" className={i === 0 ? `glossy ${s.nextStep}` : s.example} onClick={() => onAsk(f.query)}>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PastResearch({ onTry }: { onTry: (q: string) => void }) {
  const threads = useThreads().filter((t) => t.messages.length > 0);
  if (!threads.length) {
    return (
      <div className={s.examples}>
        {EXAMPLE_SEARCHES.map((ex) => (
          <button key={ex} type="button" className={s.example} onClick={() => onTry(ex)}>
            {ex}
          </button>
        ))}
      </div>
    );
  }
  return (
    <section className={s.past} aria-labelledby="past-research">
      <h2 id="past-research" className={`fade-text ${s.pastTitle}`}>
        Your research
      </h2>
      <ul className={s.pastList}>
        {threads.slice(0, 12).map((t) => {
          const ideas = t.messages.reduce((n, m) => n + (m.cards?.length ?? 0), 0);
          return (
            <li key={t.id}>
              <Link href={`/app/research/${t.id}`} className={s.pastItem}>
                <span className={s.pastText}>
                  <span className={s.pastName}>{t.title}</span>
                  <span className={s.pastMeta}>
                    {ideas} {ideas === 1 ? "idea" : "ideas"} · {when(t.updatedAt)}
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function when(at: number) {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
