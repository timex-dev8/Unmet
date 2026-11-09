"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { ArrowLeft, ArrowRight, NotebookPen, Sparkles, X } from "lucide-react";
import { TrendBadge, windowLabel } from "@/components/card/parts";
import Highlight from "@/components/motion/Highlight";
import { entryFor, moveTo, nextStage, prevStage, removeEntry, setNote, STAGES, stageLabel, useBoard, type Stage } from "@/lib/board";
import { STAGE_COLORS } from "@/lib/colors";
import { digDeeperHref, ideaHref } from "@/lib/links";
import { useSaved } from "@/lib/saved";
import { categoryLabel, type Card } from "@/lib/types";
import styles from "./board.module.css";

export default function BoardView() {
  const { saved, remove } = useSaved();
  const board = useBoard();
  const [tab, setTab] = useState<Stage>("spotted");
  const [dropTarget, setDropTarget] = useState<Stage | null>(null);

  const byStage = new Map<Stage, Card[]>(STAGES.map((stageDef) => [stageDef.id, []]));
  // unknown stage (synced from another version) shows as spotted
  for (const card of saved) (byStage.get(entryFor(board, card.slug).stage) ?? byStage.get("spotted")!).push(card);
  for (const list of byStage.values()) list.sort((a, b) => entryFor(board, b.slug).movedAt - entryFor(board, a.slug).movedAt);

  function onDrop(e: DragEvent, stage: Stage) {
    e.preventDefault();
    const slug = e.dataTransfer.getData("text/plain");
    // only these cards, any text can be dragged in from another page
    if (saved.some((savedCard) => savedCard.slug === slug)) moveTo(slug, stage);
    setDropTarget(null);
  }

  if (saved.length === 0) {
    return (
      <main className={styles.page}>
        <Header count={0} />
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Your board is empty. Every product you’ll build starts as a saved idea.</p>
          <p>Save ideas from the feed, research or Home. They land here as “Spotted”, then you move them forward as you learn.</p>
          <div className={styles.emptyActions}>
            <Link href="/app/research" className="pill pill-dark">
              Start a research
            </Link>
            <Link href="/app/feed" className="pill" style={{ background: "var(--gray)" }}>
              Open the feed
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Header count={saved.length} />

      <div className={styles.tabs} role="tablist" aria-label="Stages">
        {STAGES.map((stageDef) => (
          <button
            key={stageDef.id}
            type="button"
            role="tab"
            aria-selected={tab === stageDef.id}
            className={styles.tab}
            onClick={() => setTab(stageDef.id)}
          >
            {tab === stageDef.id && <Highlight id="board-stage" className={styles.tabPill} />}
            <span className={styles.stageDot} style={{ background: STAGE_COLORS[stageDef.id] }} aria-hidden="true" />
            <b>{byStage.get(stageDef.id)!.length}</b>
            {stageDef.label}
          </button>
        ))}
      </div>

      <div className={styles.columns}>
        {STAGES.map((stageDef) => (
          <section
            key={stageDef.id}
            aria-label={stageDef.label}
            className={`${styles.column} ${tab === stageDef.id ? styles.columnActive : ""} ${dropTarget === stageDef.id ? styles.dropping : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(stageDef.id);
            }}
            onDragLeave={() => setDropTarget((current) => (current === stageDef.id ? null : current))}
            onDrop={(e) => onDrop(e, stageDef.id)}
          >
            <div className={styles.colHead}>
              <span className={styles.stageDot} style={{ background: STAGE_COLORS[stageDef.id] }} aria-hidden="true" />
              <h2 className={styles.colTitle}>{stageDef.label}</h2>
              <span className={styles.colCount}>{byStage.get(stageDef.id)!.length}</span>
            </div>
            <p className={styles.colHint}>{stageDef.hint}</p>
            {byStage.get(stageDef.id)!.map((card) => (
              <Item
                key={card.slug}
                card={card}
                stage={stageDef.id}
                note={entryFor(board, card.slug).note}
                onRemove={() => {
                  remove(card.slug);
                  removeEntry(card.slug);
                }}
              />
            ))}
            {byStage.get(stageDef.id)!.length === 0 && <div className={styles.drop}>Drop ideas here</div>}
          </section>
        ))}
      </div>
    </main>
  );
}

function Header({ count }: { count: number }) {
  return (
    <div className={styles.head}>
      <h1 className={styles.title}>Your board</h1>
      {count > 0 && (
        <p className={styles.sub}>
          {count} saved {count === 1 ? "idea" : "ideas"}. Move each one forward as you learn more.
        </p>
      )}
    </div>
  );
}

function Item({ card, stage, note, onRemove }: { card: Card; stage: Stage; note: string; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // timer not onAnimationComplete so it works in background tabs
  const leave = () => {
    setLeaving(true);
    setTimeout(onRemove, 220);
  };
  const next = nextStage(stage);
  const prev = prevStage(stage);
  const evidence = card.evidence;

  // same layoutId in every column so a moved card glides over, layout closes the gap
  return (
    <m.div
      layout
      layoutId={card.slug}
      animate={leaving ? { opacity: 0, scale: 0.94 } : { opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 36, opacity: { duration: 0.2 } }}
    >
      <article
        className={styles.item}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", card.slug);
          event.dataTransfer.effectAllowed = "move";
        }}
      >
        <div className={styles.meta}>
          <span>{categoryLabel(card.category)}</span>
          <TrendBadge trend={card.trend} />
          <button type="button" className={styles.remove} onClick={leave} aria-label={`Remove “${card.headline}” from board`}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <h3 className={styles.itemTitle}>
          <Link href={ideaHref(card.slug)}>{card.headline}</Link>
        </h3>
        <p className={styles.evidence}>
          <strong>{evidence.posts} mentions</strong> · {evidence.site} · {windowLabel(evidence.days)}
        </p>

        {editing ? (
          <textarea
            className={styles.noteInput}
            defaultValue={note}
            autoFocus
            rows={3}
            placeholder="What did you learn? Who should you talk to?"
            aria-label={`Note for “${card.headline}”`}
            onBlur={(event) => {
              setNote(card.slug, event.target.value.trim());
              setEditing(false);
            }}
          />
        ) : note ? (
          <button type="button" className={styles.note} onClick={() => setEditing(true)} aria-label="Edit note">
            {note}
          </button>
        ) : null}

        <div className={styles.actions}>
          {prev && (
            <button type="button" className={styles.iconBtn} onClick={() => moveTo(card.slug, prev)} aria-label={`Move back to ${stageLabel(prev)}`}>
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
          )}
          {next ? (
            <button type="button" className={`glossy ${styles.moveBtn}`} onClick={() => moveTo(card.slug, next)}>
              {stageLabel(next)} <ArrowRight size={15} aria-hidden="true" />
            </button>
          ) : (
            <span className={styles.done}>In progress</span>
          )}
          {!note && !editing && (
            <button type="button" className={styles.iconBtn} onClick={() => setEditing(true)} aria-label="Add a note">
              <NotebookPen size={16} aria-hidden="true" />
            </button>
          )}
          <Link href={digDeeperHref(card)} className={styles.iconBtn} aria-label={`Dig deeper into “${card.headline}”`}>
            <Sparkles size={16} aria-hidden="true" />
          </Link>
        </div>
      </article>
    </m.div>
  );
}
