"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { House, Layers, LayoutGrid, Lightbulb, MessageSquare, NotebookPen, Plus, Search, Sparkles, type LucideIcon } from "lucide-react";
import { ideaHref, researchHref, searchHref } from "@/lib/links";
import { useThreads } from "@/lib/research-store";
import { useSaved } from "@/lib/saved";
import type { Card } from "@/lib/types";
import styles from "./palette.module.css";

type Item = { id: string; group: "Actions" | "Ideas" | "Research"; label: string; sub?: string; href: string; Icon: LucideIcon };

const ACTIONS: Item[] = [
  { id: "a-new", group: "Actions", label: "New research", href: "/app/research", Icon: Plus },
  { id: "a-mind", group: "Actions", label: "Shape an idea", sub: "Shape", href: "/app/mind", Icon: NotebookPen },
  { id: "a-home", group: "Actions", label: "Go to Home", href: "/app", Icon: House },
  { id: "a-feed", group: "Actions", label: "Go to Feed", href: "/app/feed", Icon: Layers },
  { id: "a-board", group: "Actions", label: "Go to Board", href: "/app/board", Icon: LayoutGrid },
];

const matches = (text: string, words: string[]) => {
  const lowerText = text.toLowerCase();
  return words.every((word) => lowerText.includes(word));
};

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { saved } = useSaved();
  const threads = useThreads();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const items = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const ideaPool = new Map<string, Card>();
    for (const card of [...saved, ...threads.flatMap((thread) => thread.messages.flatMap((chatMessage) => chatMessage.cards ?? []))]) {
      if (!ideaPool.has(card.slug)) ideaPool.set(card.slug, card);
    }
    const ideas: Item[] = [...ideaPool.values()]
      .filter((card) => matches(`${card.headline} ${card.summary} ${card.category}`, words))
      .slice(0, words.length ? 6 : 4)
      .map((card) => ({
        id: `i-${card.slug}`,
        group: "Ideas",
        label: card.headline,
        sub: card.category,
        href: ideaHref(card.slug),
        Icon: Lightbulb,
      }));
    const research: Item[] = threads
      .filter((thread) => matches(thread.title, words))
      .slice(0, 4)
      .map((thread) => ({ id: `r-${thread.id}`, group: "Research", label: thread.title, href: `/app/research/${thread.id}`, Icon: MessageSquare }));
    const actions = ACTIONS.filter((action) => matches(`${action.label} ${action.sub ?? ""}`, words));
    const trimmedQuery = query.trim();
    const launch: Item[] = trimmedQuery
      ? [
          {
            id: "q-research",
            group: "Actions",
            label: `Research “${trimmedQuery}”`,
            sub: "Search the web for real complaints",
            href: researchHref(trimmedQuery),
            Icon: Sparkles,
          },
          { id: "q-search", group: "Actions", label: `Search ideas for “${trimmedQuery}”`, href: searchHref(trimmedQuery), Icon: Search },
        ]
      : [];
    return [...launch, ...ideas, ...research, ...actions];
  }, [query, saved, threads]);

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  function openItem(item: Item | undefined) {
    if (!item) return;
    onClose();
    setQuery("");
    setActive(0);
    router.push(item.href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((activeIndex + 1) % Math.max(items.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((activeIndex - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      openItem(items[activeIndex]);
    }
  }

  let lastGroup = "";
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Search and commands"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose(); // backdrop click
      }}
    >
      <div className={styles.box}>
        <div className={styles.inputRow}>
          <Search size={18} aria-hidden="true" />
          <input
            className={styles.input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search ideas, research, or type a market to research…"
            aria-label="Search"
            aria-controls="palette-list"
            aria-activedescendant={items[activeIndex] ? `pal-${items[activeIndex].id}` : undefined}
            autoFocus
          />
        </div>
        <ul id="palette-list" className={styles.list} role="listbox" aria-label="Results">
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.id} role="presentation">
                {header && <p className={styles.group}>{header}</p>}
                <button
                  type="button"
                  id={`pal-${item.id}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`${styles.item} ${i === activeIndex ? styles.itemOn : ""}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => openItem(item)}
                >
                  <item.Icon size={17} aria-hidden="true" />
                  <span className={styles.label}>{item.label}</span>
                  {item.sub && <span className={styles.sub}>{item.sub}</span>}
                </button>
              </li>
            );
          })}
          {items.length === 0 && <li className={styles.none}>No matches. Try another word.</li>}
        </ul>
      </div>
    </dialog>
  );
}
