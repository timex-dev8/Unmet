"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, BookmarkPlus, Check, ChevronRight, ExternalLink, LoaderCircle, Sparkles, Square, X } from "lucide-react";
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
import styles from "./research.module.css";

type Context = Pick<Card, "slug" | "headline" | "summary">;

const STOPPED = "Stopped.";
// the new-thread url change remounts this component, so running requests live out here
const running = new Map<string, AbortController>();

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
  const panelRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const busy = messages.some((chatMessage) => chatMessage.pending);
  // only announce a finish this page actually watched, not when opening an old thread
  const [watched, setWatched] = useState(false);
  if (busy && !watched) setWatched(true);

  const last = messages[messages.length - 1];
  const lastSteps = last?.steps?.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastSteps]);

  const openPanel = (card: Card, link: HTMLElement) => {
    openerRef.current = link;
    setOpenCard(card);
  };
  const closePanel = useCallback(() => {
    setOpenCard(null);
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!openCard) return;
    panelRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && closePanel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCard, closePanel]);

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
    let activeThreadId = threadId;
    if (!activeThreadId) {
      activeThreadId = createThread(message);
      router.replace(`/app/research/${activeThreadId}`, { scroll: false });
    }
    const streamThreadId = activeThreadId;
    const patch = (msgId: string, fn: (chatMessage: ChatMessage) => Partial<ChatMessage>) =>
      updateThread(streamThreadId, (list) =>
        list.map((chatMessage) => (chatMessage.id === msgId ? { ...chatMessage, ...fn(chatMessage) } : chatMessage)),
      );

    const prior = messages.filter((chatMessage) => !chatMessage.error && chatMessage.text !== STOPPED);
    const history = prior.slice(-8).map((chatMessage) => ({ role: chatMessage.role, text: chatMessage.text.slice(0, 1500) }));
    const cards: Context[] = [
      ...(about && !threadId ? [about] : []),
      ...prior.flatMap((chatMessage) => chatMessage.cards ?? []).map(({ slug, headline, summary }) => ({ slug, headline, summary })),
    ].slice(-12);

    const reply: ChatMessage = { id: newId(), role: "assistant", text: "", steps: [], pending: true };
    updateThread(streamThreadId, (list) => [...list, { id: newId(), role: "user", text: message }, reply]);

    // stop marks the reply right away, so failures from the aborted stream find it no longer pending
    const fail = (text: string) => patch(reply.id, (chatMessage) => (chatMessage.pending ? { text, error: true, pending: false } : {}));
    const controller = new AbortController();
    running.set(streamThreadId, controller);
    controller.signal.addEventListener("abort", () => patch(reply.id, () => ({ text: STOPPED, pending: false })));

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ message, history, cards, depth: lowOnly ? "low" : depth }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        fail(body.error ?? "Something went wrong. Please try again.");
        return;
      }

      const reader = response.body.getReader();
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
            if (event.type === "step") patch(reply.id, (chatMessage) => ({ steps: [...(chatMessage.steps ?? []), event.label] }));
            else if (event.type === "result")
              patch(reply.id, () => ({
                text: event.answer,
                cards: event.cards,
                sourceCount: event.sourceCount,
                mix: event.mix,
                suggestions: event.suggestions,
                pending: false,
              }));
            else fail(event.message);
          }
        }
      } catch (err) {
        void reader.cancel().catch(() => {});
        throw err;
      }
      fail("The research took too long. Please try again.");
    } catch {
      fail("Couldn’t reach Unmet. Check your connection and try again.");
    } finally {
      if (running.get(streamThreadId) === controller) running.delete(streamThreadId);
    }
  }

  function stop() {
    if (threadId) running.get(threadId)?.abort();
  }

  function submit() {
    if (!authKnown || busy) return;
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
      <main className={`${styles.chat} ${styles.chatEmpty}`}>
        <div className={styles.intro}>
          <h1 className={styles.title}>This research isn’t on this device.</h1>
          <p className={styles.lead}>Research syncs when you’re signed in, but as a guest it stays in the browser where you ran it.</p>
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
  const lastAnswerId = [...messages]
    .reverse()
    .find((chatMessage) => chatMessage.role === "assistant" && !chatMessage.pending && !chatMessage.error && chatMessage.text !== STOPPED)?.id;
  const status = busy
    ? (last?.steps?.at(-1) ?? "Starting research")
    : !watched
      ? ""
      : last?.error || last?.text === STOPPED
        ? last.text
        : "Research finished";

  return (
    <div className={styles.layout}>
      <main className={`${styles.chat} ${empty ? styles.chatEmpty : ""}`}>
        <p role="status" className="sr-only">
          {status}
        </p>
        {empty ? (
          <div className={styles.intro} data-wash>
            <h1 className={styles.title}>{about ? `Dig into “${about.headline}”` : "What do you want to find out?"}</h1>
            <p className={styles.lead}>
              Ask about anything, or say you have no idea yet. You’ll get real problems people complain about, and ideas to solve them.
            </p>
          </div>
        ) : (
          <div className={styles.thread}>
            <h1 className={styles.threadTitle} title={thread?.title}>
              {thread?.title ?? "Research"}
            </h1>
            {messages.map((chatMessage, messageIndex) =>
              chatMessage.role === "user" ? (
                <UserBubble key={chatMessage.id} text={chatMessage.text} />
              ) : (
                <Reply
                  key={chatMessage.id}
                  chatMessage={chatMessage}
                  isLast={chatMessage.id === lastAnswerId}
                  lastQuery={messages.slice(0, messageIndex).findLast((earlier) => earlier.role === "user")?.text ?? ""}
                  onAsk={(question) => send(question)}
                  onOpen={openPanel}
                  openSlug={openCard?.slug}
                />
              ),
            )}
            <div ref={endRef} />
          </div>
        )}

        <div className={styles.composerWrap}>
          {!configured && <p className={styles.notice}>AI research is being switched on. Check back soon.</p>}
          <form className={styles.composer} onSubmit={onSubmit}>
            <label htmlFor="research-input" className="sr-only">
              Describe a market or problem
            </label>
            <textarea
              id="research-input"
              className={styles.input}
              rows={1}
              maxLength={800}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={empty ? "Ask about a market, product or problem" : "Ask a follow-up"}
              disabled={!configured}
            />
            {!lowOnly && <DepthPicker value={depth} onChange={setDepth} disabled={busy} placement={empty ? "down" : "up"} />}
            {/* keyed so a click on stop can't land on the submit button that replaces it */}
            {busy ? (
              <button key="stop" type="button" className={`send-btn ${styles.stop}`} onClick={stop} aria-label="Stop research">
                <Square size={16} fill="currentColor" aria-hidden="true" />
              </button>
            ) : (
              <button key="send" type="submit" className="send-btn glossy" disabled={!input.trim() || !configured || !authKnown} aria-label="Send">
                <ArrowUp size={20} aria-hidden="true" />
              </button>
            )}
          </form>
          {empty && configured && !about && <PastResearch onTry={send} />}
        </div>
      </main>

      {openCard && (
        <aside ref={panelRef} tabIndex={-1} className={styles.panel} aria-label="Idea details">
          <div className={styles.panelBar}>
            <span className={styles.panelLabel}>Idea</span>
            <div className={styles.panelTools}>
              <Link href={ideaHref(openCard.slug)} className={styles.panelBtn} aria-label="Open as a full page">
                <ExternalLink size={16} aria-hidden="true" />
              </Link>
              <button type="button" className={styles.panelBtn} onClick={closePanel} aria-label="Close panel">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className={styles.panelBody}>
            <IdeaSections card={openCard} headingLevel={2} />
          </div>
          <div className={styles.panelActions}>
            <SaveButton card={openCard} label="Save idea" />
            <Link href={digDeeperHref(openCard)} className={styles.digBtn}>
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
    <div className={styles.userRow}>
      <p className={styles.user}>{text}</p>
    </div>
  );
}

function StepList({ steps, pending }: { steps: string[]; pending?: boolean }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step, i) => {
        const running = pending && i === steps.length - 1;
        return (
          <li key={i} className={`rise ${running ? styles.stepRunning : ""}`}>
            {running ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Check size={15} className={styles.pop} aria-hidden="true" />}
            {step}
          </li>
        );
      })}
    </ol>
  );
}

function Reply({
  chatMessage,
  isLast,
  lastQuery,
  onAsk,
  onOpen,
  openSlug,
}: {
  chatMessage: ChatMessage;
  isLast: boolean;
  lastQuery: string;
  onAsk: (question: string) => void;
  onOpen: (card: Card, link: HTMLElement) => void;
  openSlug?: string;
}) {
  const steps = chatMessage.steps ?? [];
  const cards = chatMessage.cards ?? [];
  const { save, isSaved } = useSaved();
  const allSaved = cards.length > 0 && cards.every((card) => isSaved(card.slug));

  const niche = cards.filter((card) => card.signal === "niche");
  const popular = cards.filter((card) => card.signal !== "niche");
  const both = niche.length > 0 && popular.length > 0;
  const suggestions = chatMessage.suggestions ?? [];
  const followUps = [
    ...(lastQuery ? [{ label: "Find more niche problems", query: `Find more niche problems: ${lastQuery}` }] : []),
    ...(cards.length > 1 ? [{ label: "Which is easiest to build?", query: "Which is easiest to build?" }] : []),
    ...suggestions.map((suggestion) => ({ label: suggestion, query: suggestion })),
  ];
  const showFootnote = !chatMessage.pending && !chatMessage.error && chatMessage.sourceCount && cards.length > 0;
  const group = (list: Card[], heading: string | null, offset: number) => (
    <>
      {heading && <h2 className={styles.groupTitle}>{heading}</h2>}
      <div className={styles.cards}>
        {list.map((card, i) => (
          <ResearchCard key={card.slug} card={card} index={offset + i} onOpen={onOpen} selected={card.slug === openSlug} />
        ))}
      </div>
    </>
  );

  return (
    <div className={styles.reply}>
      {steps.length > 0 && chatMessage.pending && <StepList steps={steps} pending />}
      {steps.length > 0 && !chatMessage.pending && chatMessage.mix && (
        <details className={styles.stepsFold}>
          <summary>
            <Check size={14} aria-hidden="true" />
            {chatMessage.mix}
          </summary>
          <StepList steps={steps} />
        </details>
      )}
      {chatMessage.pending && steps.length === 0 && (
        <p className={styles.thinking}>
          <LoaderCircle size={15} className="spin" aria-hidden="true" /> Starting research…
        </p>
      )}
      {chatMessage.text && <p className={chatMessage.error ? styles.error : styles.answer}>{chatMessage.text}</p>}
      {chatMessage.error && lastQuery && (
        <button type="button" className={styles.retry} onClick={() => onAsk(lastQuery)}>
          Try again
        </button>
      )}
      {popular.length > 0 && group(popular, both ? "Main problems" : null, 0)}
      {niche.length > 0 && group(niche, "Niche problems: smaller and less proven", popular.length)}
      {showFootnote ? <p className={styles.footnote}>Sources from the last 12 months; every quote is checked against its source.</p> : null}
      {!chatMessage.pending && !chatMessage.error && cards.length === 0 && suggestions.length > 0 && (
        <div className={styles.followUps}>
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" className={styles.example} onClick={() => onAsk(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}
      {isLast && cards.length > 0 && (
        <div className={styles.followUps}>
          <button type="button" className={styles.addAll} onClick={() => cards.forEach(save)} disabled={allSaved}>
            {allSaved ? <Check size={15} aria-hidden="true" /> : <BookmarkPlus size={15} aria-hidden="true" />}
            {allSaved ? "On your board" : cards.length > 1 ? `Add all ${cards.length} to board` : "Add to board"}
          </button>
          {followUps.map((followUp, i) => (
            <button
              key={followUp.label}
              type="button"
              className={i === 0 ? `glossy ${styles.nextStep}` : styles.example}
              onClick={() => onAsk(followUp.query)}
            >
              {followUp.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PastResearch({ onTry }: { onTry: (question: string) => void }) {
  const threads = useThreads().filter((thread) => thread.messages.length > 0);
  if (!threads.length) {
    return (
      <div className={styles.examples}>
        {EXAMPLE_SEARCHES.map((example) => (
          <button key={example} type="button" className={styles.example} onClick={() => onTry(example)}>
            {example}
          </button>
        ))}
      </div>
    );
  }
  return (
    <section className={styles.past} aria-labelledby="past-research">
      <h2 id="past-research" className={`fade-text ${styles.pastTitle}`}>
        Your research
      </h2>
      <ul className={styles.pastList}>
        {threads.slice(0, 12).map((thread) => {
          const ideas = thread.messages.reduce((total, chatMessage) => total + (chatMessage.cards?.length ?? 0), 0);
          return (
            <li key={thread.id}>
              <Link href={`/app/research/${thread.id}`} className={styles.pastItem}>
                <span className={styles.pastText}>
                  <span className={styles.pastName}>{thread.title}</span>
                  <span className={styles.pastMeta}>
                    {ideas} {ideas === 1 ? "idea" : "ideas"} · {when(thread.updatedAt)}
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
