"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, m, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { Bookmark, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import IdeaCard from "@/components/card/IdeaCard";
import ProductCard from "@/components/card/ProductCard";
import { markSkipped, useInterests, useSeenAtLoad } from "@/lib/interests";
import { profileKeywords, textMatch } from "@/lib/rank";
import { useSaved } from "@/lib/saved";
import type { Card, Product } from "@/lib/types";
import styles from "./feed.module.css";

// 1 = next, -1 = back, 2 = saved
type Dir = 1 | -1 | 2;

const SWIPE_DISTANCE = 100;
const SWIPE_VELOCITY = 600;
const HINT_KEY = "unmet:hint-seen";

type Item = Card | Product;
const isProduct = (item: Item | undefined): item is Product => (item as Product | undefined)?.kind === "product";
const keyOf = (item: Item) => (isProduct(item) ? `product-${item.slug}` : item.slug);

export default function SwipeFeed({ cards: input, products = [] }: { cards: Card[]; products?: Product[] }) {
  const { interests: liveInterests } = useInterests();
  // freeze ranking inputs once loaded so late interests dont reshuffle mid swipe
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [interests, setFrozen] = useState<typeof liveInterests | null>(null);
  if (hydrated && !interests) setFrozen(liveInterests);
  const seen = useSeenAtLoad();
  const cards = useMemo(() => {
    const keywords = interests ? profileKeywords(interests) : [];
    const matched = keywords.length ? [...input].sort((a, b) => textMatch(b, keywords) - textMatch(a, keywords)) : input;
    // unpassed cards first so a return visit opens on something new
    const problems = [...matched].sort((a, b) => Number(seen.includes(a.slug)) - Number(seen.includes(b.slug)));
    const mixed: Item[] = [];
    let productIndex = 0;
    let problemIndex = 0;
    while (problemIndex < problems.length || productIndex < products.length) {
      if ((mixed.length % 3 === 2 && productIndex < products.length) || problemIndex >= problems.length) mixed.push(products[productIndex++]);
      else mixed.push(problems[problemIndex++]);
    }
    return mixed;
  }, [input, products, interests, seen]);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<Dir>(1);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { save } = useSaved();
  const hintSeen = useHintSeen();
  const reduce = useReducedMotion();

  const card = cards[index];
  const nextCard = cards[index + 1];

  const flash = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }, []);

  const move = useCallback(
    (direction: Dir) => {
      markHintSeen();
      const current = cards[index];
      if (direction === 1 && current && !isProduct(current)) markSkipped(current.slug);
      setDir(direction);
      setIndex((i) => (direction === -1 ? Math.max(i - 1, 0) : Math.min(i + 1, cards.length)));
    },
    [cards, index],
  );

  const saveAndNext = useCallback(() => {
    const current = cards[index];
    if (!current) return;
    // products arent saved, a right swipe just moves on
    if (isProduct(current)) return move(1);
    save(current);
    flash("Saved");
    move(2);
  }, [cards, index, save, flash, move]);

  // keys: down/up move, S saves. ignored while typing or with a sheet open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (
        target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false]), dialog[open]") ||
        document.querySelector("dialog[open]")
      )
        return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        move(-1);
      } else if (e.key.toLowerCase() === "s") {
        saveAndNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, saveAndNext]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) saveAndNext();
    else if (offset.y < -SWIPE_DISTANCE || velocity.y < -SWIPE_VELOCITY) move(1);
    else if ((offset.y > SWIPE_DISTANCE || velocity.y > SWIPE_VELOCITY) && index > 0) move(-1);
  }

  const duration = reduce ? 0 : 0.32;
  const variants = {
    enter: (direction: Dir) => (direction === -1 ? { y: -500, opacity: 0 } : { y: 16, scale: 0.96, opacity: 0.6 }),
    center: { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 },
    exit: (direction: Dir) =>
      direction === 2 ? { x: 480, rotate: 10, opacity: 0 } : direction === 1 ? { y: -600, opacity: 0 } : { y: 40, scale: 0.96, opacity: 0 },
  };

  if (!cards.length) {
    return (
      <div className={styles.end}>
        <h2 className={styles.endTitle}>No ideas here yet.</h2>
        <p className={styles.endText}>Try another filter or search for a problem.</p>
        <Link href="/app/search" className="pill pill-dark">
          Search
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={styles.stage}>
        {nextCard && <div className={styles.peek} aria-hidden="true" />}

        <AnimatePresence initial={false} custom={dir}>
          {card ? (
            <SwipeCard key={keyOf(card)} card={card} dir={dir} variants={variants} duration={duration} onDragEnd={onDragEnd} />
          ) : (
            <m.div key="end" className={styles.end} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration }}>
              <h2 className={styles.endTitle}>You’ve seen every idea.</h2>
              <p className={styles.endText}>New problems are added as people post them.</p>
              <div className={styles.endActions}>
                <Link href="/app/board" className="pill pill-dark">
                  View saved
                </Link>
                <button type="button" className="pill" style={{ background: "var(--white)" }} onClick={() => setIndex(0)}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Start over
                </button>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {card && (
          <div className={styles.sideNav}>
            <button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="Previous idea">
              <ChevronUp size={22} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => move(1)} aria-label="Next idea">
              <ChevronDown size={22} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {card && (
          <>
            <button type="button" className={styles.navBtn} onClick={() => move(1)}>
              <ChevronUp size={16} aria-hidden="true" />
              <span className={styles.touchHint}>{hintSeen ? "Next" : "Swipe up for next · right to save"}</span>
              <span className={styles.keyHint}>Next · or use ↑ ↓ and S to save</span>
            </button>
            <span className={styles.counter} aria-live="polite">
              {index + 1} of {cards.length}
            </span>
          </>
        )}
      </div>

      <div className={`${styles.toast} ${toast ? styles.toastOn : ""}`} role="status" aria-live="polite">
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
  card: Item;
  dir: Dir;
  variants: Record<string, unknown>;
  duration: number;
  onDragEnd: (e: unknown, info: PanInfo) => void;
}) {
  const x = useMotionValue(0);
  const stamp = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const rotate = useTransform(x, [-200, 0, 200], [-6, 0, 6]);

  return (
    <m.div
      className={styles.cardWrap}
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
      {!isProduct(card) && (
        <m.div className={styles.stamp} style={{ opacity: stamp }} aria-hidden="true">
          <Bookmark size={18} fill="currentColor" />
          Save
        </m.div>
      )}
      {isProduct(card) ? <ProductCard product={card} /> : <IdeaCard card={card} />}
    </m.div>
  );
}

const hintListeners = new Set<() => void>();
function useHintSeen() {
  return useSyncExternalStore(
    (listener) => {
      hintListeners.add(listener);
      return () => hintListeners.delete(listener);
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
  hintListeners.forEach((listener) => listener());
}
