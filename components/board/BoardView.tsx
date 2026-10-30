"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, NotebookPen, Sparkles, X } from "lucide-react";
import { TrendBadge, windowLabel } from "@/components/card/parts";
import Highlight from "@/components/motion/Highlight";
import { entryFor, moveTo, nextStage, prevStage, setNote, STAGES, stageLabel, useBoard, type Stage } from "@/lib/board";
import { STAGE_COLORS } from "@/lib/colors";
import { digDeeperHref } from "@/lib/links";
import { useSaved } from "@/lib/saved";
import type { Card } from "@/lib/types";
import s from "./board.module.css";

export default function BoardView() {
  const { saved, remove } = useSaved();
  const board = useBoard();
  const [tab, setTab] = useState<Stage>("spotted");
  const [dropTarget, setDropTarget] = useState<Stage | null>(null);

  const byStage = new Map<Stage, Card[]>(STAGES.map((st) => [st.id, []]));
  for (const card of saved) byStage.get(entryFor(board, card.slug).stage)!.push(card);
  // Most recently moved first within each column.
  for (const list of byStage.values()) list.sort((a, b) => entryFor(board, b.slug).movedAt - entryFor(board, a.slug).movedAt);

  function onDrop(e: DragEvent, stage: Stage) {
    e.preventDefault();
    const slug = e.dataTransfer.getData("text/plain");
    if (slug) moveTo(slug, stage);
    setDropTarget(null);
  }

  if (saved.length === 0) {
    return (
      <main className={s.page}>
        <Header count={0} />
        <div className={s.empty}>
          <p className={s.emptyTitle}>Your board is empty.</p>
          <p>Save ideas from the feed, research or Home. They land here as “Spotted”, then you move them forward as you learn.</p>
          <div className={s.emptyActions}>
            <Link href="/app/feed" className="pill pill-dark">
              Open the feed
            </Link>
            <Link href="/app/research" className="pill" style={{ background: "var(--white)" }}>
              Start a research
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={s.page}>
      <Header count={saved.length} />

      {/* Phone: one stage at a time */}
      <div className={s.tabs} role="tablist" aria-label="Stages">
        {STAGES.map((st) => (
          <button key={st.id} type="button" role="tab" aria-selected={tab === st.id} className={s.tab} onClick={() => setTab(st.id)}>
            {tab === st.id && <Highlight id="board-stage" className={s.tabPill} />}
            <span className={s.stageDot} style={{ background: STAGE_COLORS[st.id] }} aria-hidden="true" />
            <b>{byStage.get(st.id)!.length}</b>
            {st.label}
          </button>
        ))}
      </div>

      <div className={s.columns}>
        {STAGES.map((st) => (
          <section
            key={st.id}
            aria-label={st.label}
            className={`${s.column} ${tab === st.id ? s.columnActive : ""} ${dropTarget === st.id ? s.dropping : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(st.id);
            }}
            onDragLeave={() => setDropTarget((t) => (t === st.id ? null : t))}
            onDrop={(e) => onDrop(e, st.id)}
          >
            <div className={s.colHead}>
              <span className={s.stageDot} style={{ background: STAGE_COLORS[st.id] }} aria-hidden="true" />
              <h2 className={s.colTitle}>{st.label}</h2>
              <span className={s.colCount}>{byStage.get(st.id)!.length}</span>
            </div>
            <p className={s.colHint}>{st.hint}</p>
            {byStage.get(st.id)!.map((card) => (
              <Item key={card.slug} card={card} stage={st.id} note={entryFor(board, card.slug).note} onRemove={() => remove(card.slug)} />
            ))}
            {byStage.get(st.id)!.length === 0 && <div className={s.drop}>Drop ideas here</div>}
          </section>
        ))}
      </div>
    </main>
  );
}

function Header({ count }: { count: number }) {
  return (
    <div className={s.head}>
      <h1 className={s.title}>Board</h1>
      <p className={s.sub}>
        {count} {count === 1 ? "idea" : "ideas"} · move them forward as you learn · on this device
      </p>
    </div>
  );
}

function Item({ card, stage, note, onRemove }: { card: Card; stage: Stage; note: string; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Fade out first, then remove. A timer, not onAnimationComplete, so it also works in background tabs.
  const leave = () => {
    setLeaving(true);
    setTimeout(onRemove, 220);
  };
  const next = nextStage(stage);
  const prev = prevStage(stage);
  const e = card.evidence;

  // The wrapper carries the motion: same layoutId in every column, so a moved card glides
  // from its old column to the new one; `layout` lets the cards around it close the gap smoothly.
  return (
    <motion.div
      layout
      layoutId={card.slug}
      animate={leaving ? { opacity: 0, scale: 0.94 } : { opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 36, opacity: { duration: 0.2 } }}
    >
      <article
        className={s.item}
        draggable
        onDragStart={(ev) => {
          ev.dataTransfer.setData("text/plain", card.slug);
          ev.dataTransfer.effectAllowed = "move";
        }}
      >
        <div className={s.meta}>
          <span>{card.category}</span>
          <TrendBadge trend={card.trend} />
          <button type="button" className={s.remove} onClick={leave} aria-label={`Remove “${card.headline}” from board`}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <h3 className={s.itemTitle}>
          <Link href={`/app/idea/${card.slug}`}>{card.headline}</Link>
        </h3>
        <p className={s.evidence}>
          <strong>{e.posts} mentions</strong> · {e.site} · {windowLabel(e.days)}
        </p>

        {editing ? (
          <textarea
            className={s.noteInput}
            defaultValue={note}
            autoFocus
            rows={3}
            placeholder="What did you learn? Who should you talk to?"
            aria-label={`Note for “${card.headline}”`}
            onBlur={(ev) => {
              setNote(card.slug, ev.target.value.trim());
              setEditing(false);
            }}
          />
        ) : note ? (
          <button type="button" className={s.note} onClick={() => setEditing(true)} aria-label="Edit note">
            {note}
          </button>
        ) : null}

        <div className={s.actions}>
          {prev && (
            <button type="button" className={s.iconBtn} onClick={() => moveTo(card.slug, prev)} aria-label={`Move back to ${stageLabel(prev)}`}>
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
          )}
          {next ? (
            <button type="button" className={s.moveBtn} onClick={() => moveTo(card.slug, next)}>
              {stageLabel(next)} <ArrowRight size={15} aria-hidden="true" />
            </button>
          ) : (
            <span className={s.done}>In progress</span>
          )}
          {!note && !editing && (
            <button type="button" className={s.iconBtn} onClick={() => setEditing(true)} aria-label="Add a note">
              <NotebookPen size={16} aria-hidden="true" />
            </button>
          )}
          <Link href={digDeeperHref(card)} className={s.iconBtn} aria-label={`Dig deeper into “${card.headline}”`}>
            <Sparkles size={16} aria-hidden="true" />
          </Link>
        </div>
      </article>
    </motion.div>
  );
}
