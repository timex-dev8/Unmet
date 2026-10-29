"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Check, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useResearchChat, type ChatMessage } from "@/lib/research-store";
import type { ResearchEvent } from "@/lib/research-types";
import ResearchCard from "./ResearchCard";
import s from "./research.module.css";

const EXAMPLES = [
  "I want to solve problems for barbershops",
  "What frustrates freelance designers?",
  "Problems dog owners have with daycare",
  "Pain points of running a small restaurant",
];

const id = () => Math.random().toString(36).slice(2, 10);

export default function ResearchChat({ configured }: { configured: boolean }) {
  const { messages, set, clear } = useResearchChat();
  const [input, setInput] = useState("");
  const [includeReddit, setIncludeReddit] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = messages.some((m) => m.pending);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const patch = (msgId: string, fn: (m: ChatMessage) => Partial<ChatMessage>) =>
    set((list) => list.map((m) => (m.id === msgId ? { ...m, ...fn(m) } : m)));

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || !configured) return;
    setInput("");

    const prior = messages.filter((m) => !m.error);
    const history = prior.slice(-8).map((m) => ({ role: m.role, text: m.text.slice(0, 1500) }));
    const cards = prior
      .flatMap((m) => m.cards ?? [])
      .slice(-12)
      .map(({ slug, headline, summary }) => ({ slug, headline, summary }));

    const reply: ChatMessage = { id: id(), role: "assistant", text: "", steps: [], pending: true };
    set((list) => [...list, { id: id(), role: "user", text: message }, reply]);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, cards, includeReddit }),
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
            patch(reply.id, () => ({ text: event.answer, cards: event.cards, sourceCount: event.sourceCount, pending: false }));
          else patch(reply.id, () => ({ text: event.message, error: true, pending: false }));
        }
      }
      // Stream ended without a result (for example a timeout).
      patch(reply.id, (m) => (m.pending ? { text: "The research took too long. Please try again.", error: true, pending: false } : {}));
    } catch {
      patch(reply.id, () => ({ text: "Couldn’t reach Unmet. Check your connection and try again.", error: true, pending: false }));
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const empty = messages.length === 0;

  return (
    <main className={`${s.chat} ${empty ? s.chatEmpty : ""}`}>
      {empty ? (
        <div className={s.intro}>
          <span className={s.badge}>
            <Sparkles size={14} aria-hidden="true" />
            AI research
          </span>
          <h1 className={s.title}>What problem space do you want to explore?</h1>
          <p className={s.lead}>Unmet searches recent posts across the web and turns real complaints into ideas, with sources.</p>
        </div>
      ) : (
        <div className={s.thread} aria-live="polite">
          <h1 className="sr-only">Research chat</h1>
          {messages.map((m) => (m.role === "user" ? <UserBubble key={m.id} text={m.text} /> : <Reply key={m.id} m={m} />))}
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
          <button type="submit" className={s.send} disabled={!input.trim() || busy || !configured} aria-label="Send">
            {busy ? <LoaderCircle size={20} className={s.spin} aria-hidden="true" /> : <ArrowUp size={20} aria-hidden="true" />}
          </button>
        </form>
        <div className={s.options}>
          <label className={s.toggle}>
            <input type="checkbox" checked={includeReddit} onChange={(e) => setIncludeReddit(e.target.checked)} />
            <span className={s.switch} aria-hidden="true" />
            Include Reddit
          </label>
          {!empty && (
            <button type="button" className={s.newChat} onClick={clear} disabled={busy}>
              <RotateCcw size={14} aria-hidden="true" />
              New research
            </button>
          )}
        </div>
        {empty && configured && (
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
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className={s.userRow}>
      <p className={s.user}>{text}</p>
    </div>
  );
}

function Reply({ m }: { m: ChatMessage }) {
  const steps = m.steps ?? [];
  return (
    <div className={s.reply}>
      {steps.length > 0 && (
        <ol className={s.steps}>
          {steps.map((step, i) => {
            const running = m.pending && i === steps.length - 1;
            return (
              <li key={i} className={running ? s.stepRunning : undefined}>
                {running ? <LoaderCircle size={15} className={s.spin} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                {step}
              </li>
            );
          })}
        </ol>
      )}
      {m.pending && steps.length === 0 && (
        <p className={s.thinking}>
          <LoaderCircle size={15} className={s.spin} aria-hidden="true" /> Starting research…
        </p>
      )}
      {m.text && <p className={m.error ? s.error : s.answer}>{m.text}</p>}
      {m.cards && m.cards.length > 0 && (
        <div className={s.cards}>
          {m.cards.map((card, i) => (
            <ResearchCard key={card.slug} card={card} index={i} />
          ))}
        </div>
      )}
      {!m.pending && !m.error && m.sourceCount ? (
        <p className={s.footnote}>
          Based on {m.sourceCount} pages from the last 12 months. Quotes are checked word-for-word against their sources.
        </p>
      ) : null}
    </div>
  );
}
