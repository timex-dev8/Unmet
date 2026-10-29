"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import { Bookmark, ChevronUp, RotateCcw } from "lucide-react";
import IdeaCard from "@/components/card/IdeaCard";
import { useSaved } from "@/lib/saved";
import type { Card } from "@/lib/types";
import s from "./feed.module.css";

// Swipe directions: 1 = next (up), -1 = back (down), 2 = saved (right).
type Dir = 1 | -1 | 2;

const SWIPE_DISTANCE = 100;
const SWIPE_VELOCITY = 600;
const HINT_KEY = "unmet:hint-seen";

export default function SwipeFeed({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<Dir>(1);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { save } = useSaved();
  const hintSeen = useHintSeen();
  const reduce = useReducedMotion();

  const card = cards[index];
  const nextCard = cards[index + 1];

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }, []);

  const go = useCallback(
    (d: Dir) => {
      markHintSeen();
      setDir(d);
      setIndex((i) => (d === -1 ? Math.max(i - 1, 0) : Math.min(i + 1, cards.length)));
    },
    [cards.length],
  );

  const saveAndNext = useCallback(() => {
    const current = cards[index];
    if (!current) return;
    save(current);
    flash("Saved");
    go(2);
  }, [cards, index, save, flash, go]);

  // Keyboard: ↓ / ↑ to move, S to save. Ignored while typing or when a sheet is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, dialog[open]") || document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        go(-1);
      } else if (e.key.toLowerCase() === "s") {
        saveAndNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, saveAndNext]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) saveAndNext();
    else if (offset.y < -SWIPE_DISTANCE || velocity.y < -SWIPE_VELOCITY) go(1);
    else if ((offset.y > SWIPE_DISTANCE || velocity.y > SWIPE_VELOCITY) && index > 0) go(-1);
  }

  const duration = reduce ? 0 : 0.32;
  const variants = {
    enter: (d: Dir) => (d === -1 ? { y: -500, opacity: 0 } : { y: 16, scale: 0.96, opacity: 0.6 }),
    center: { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 },
    exit: (d: Dir) =>
      d === 2
        ? { x: 480, rotate: 10, opacity: 0 }
        : d === 1
          ? { y: -600, opacity: 0 }
          : { y: 40, scale: 0.96, opacity: 0 },
  };

  if (!cards.length) {
    return (
      <div className={s.end}>
        <h2 className={s.endTitle}>No ideas here yet.</h2>
        <p className={s.endText}>Try another filter or search for a problem.</p>
        <Link href="/search" className="pill pill-dark">
          Search
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={s.stage}>
        {nextCard && <div className={s.peek} aria-hidden="true" />}

        <AnimatePresence initial={false} custom={dir}>
          {card ? (
            <SwipeCard
              key={card.slug}
              card={card}
              dir={dir}
              variants={variants}
              duration={duration}
              onDragEnd={onDragEnd}
            />
          ) : (
            <motion.div
              key="end"
              className={s.end}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration }}
            >
              <h2 className={s.endTitle}>You’ve seen every idea.</h2>
              <p className={s.endText}>New problems are added as people post them.</p>
              <div className={s.endActions}>
                <Link href="/saved" className="pill pill-dark">
                  View saved
                </Link>
                <button type="button" className="pill" style={{ background: "var(--white)" }} onClick={() => setIndex(0)}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Start over
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={s.footer}>
        {card && (
          <>
            <button type="button" className={s.navBtn} onClick={() => go(1)}>
              <ChevronUp size={16} aria-hidden="true" />
              {hintSeen ? "Next" : "Swipe up for next · right to save"}
            </button>
            <span className={s.counter} aria-live="polite">
              {index + 1} of {cards.length}
            </span>
          </>
        )}
      </div>

      <div className={`${s.toast} ${toast ? s.toastOn : ""}`} role="status" aria-live="polite">
        {toast && (
          <>
            <Bookmark size={15} fill="currentColor" aria-hidden="true" />
            {toast}
          </>
        )}
      </div>
    </>
  );
}

function SwipeCard({
  card,
  dir,
  variants,
  duration,
  onDragEnd,
}: {
  card: Card;
  dir: Dir;
  variants: Record<string, unknown>;
  duration: number;
  onDragEnd: (e: unknown, info: PanInfo) => void;
}) {
  const x = useMotionValue(0);
  const stamp = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const rotate = useTransform(x, [-200, 0, 200], [-6, 0, 6]);

  return (
    <motion.div
      className={s.cardWrap}
      custom={dir}
      variants={variants as never}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration, ease: [0.2, 0.8, 0.2, 1] }}
      drag
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={onDragEnd}
      style={{ x, rotate }}
    >
      <motion.div className={s.stamp} style={{ opacity: stamp }} aria-hidden="true">
        <Bookmark size={18} fill="currentColor" />
        Save
      </motion.div>
      <IdeaCard card={card} />
    </motion.div>
  );
}

// The "swipe up" hint shows until the first swipe, remembered in this browser.
const hintListeners = new Set<() => void>();
function useHintSeen() {
  return useSyncExternalStore(
    (l) => {
      hintListeners.add(l);
      return () => hintListeners.delete(l);
    },
    () => {
      try {
        return localStorage.getItem(HINT_KEY) === "1";
      } catch {
        return true;
      }
    },
    () => true,
  );
}
function markHintSeen() {
  try {
    if (localStorage.getItem(HINT_KEY) === "1") return;
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    return;
  }
  hintListeners.forEach((l) => l());
}
