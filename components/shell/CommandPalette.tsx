"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { House, Layers, LayoutGrid, Lightbulb, MessageSquare, NotebookPen, Plus, Search, Sparkles, type LucideIcon } from "lucide-react";
import { ideaHref, researchHref, searchHref } from "@/lib/links";
import { useThreads } from "@/lib/research-store";
import { useSaved } from "@/lib/saved";
import type { Card } from "@/lib/types";
import s from "./palette.module.css";

type Item = { id: string; group: "Actions" | "Ideas" | "Research"; label: string; sub?: string; href: string; Icon: LucideIcon };

const ACTIONS: Item[] = [
  { id: "a-new", group: "Actions", label: "New research", href: "/app/research", Icon: Plus },
  { id: "a-mind", group: "Actions", label: "Shape an idea", sub: "Shape", href: "/app/mind", Icon: NotebookPen },
  { id: "a-home", group: "Actions", label: "Go to Home", href: "/app", Icon: House },
  { id: "a-feed", group: "Actions", label: "Go to Feed", href: "/app/feed", Icon: Layers },
  { id: "a-board", group: "Actions", label: "Go to Board", href: "/app/board", Icon: LayoutGrid },
];

const matches = (text: string, words: string[]) => {
  const t = text.toLowerCase();
  return words.every((w) => t.includes(w));
};

/** Search saved ideas, research and actions from anywhere (the feed and samples are searched on the server: /app/search). Loaded on first open by TopBar. */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { saved } = useSaved();
  const threads = useThreads();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const items = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const ideaPool = new Map<string, Card>();
    for (const c of [...saved, ...threads.flatMap((t) => t.messages.flatMap((m) => m.cards ?? []))]) {
      if (!ideaPool.has(c.slug)) ideaPool.set(c.slug, c);
    }
    const ideas: Item[] = [...ideaPool.values()]
      .filter((c) => matches(`${c.headline} ${c.summary} ${c.category}`, words))
      .slice(0, words.length ? 6 : 4)
      .map((c) => ({ id: `i-${c.slug}`, group: "Ideas", label: c.headline, sub: c.category, href: ideaHref(c.slug), Icon: Lightbulb }));
    const research: Item[] = threads
      .filter((t) => matches(t.title, words))
      .slice(0, 4)
      .map((t) => ({ id: `r-${t.id}`, group: "Research", label: t.title, href: `/app/research/${t.id}`, Icon: MessageSquare }));
    const actions = ACTIONS.filter((a) => matches(`${a.label} ${a.sub ?? ""}`, words));
    const q = query.trim();
    const launch: Item[] = q
      ? [
          {
            id: "q-research",
            group: "Actions",
            label: `Research “${q}”`,
            sub: "Search the web for real complaints",
            href: researchHref(q),
            Icon: Sparkles,
          },
          { id: "q-search", group: "Actions", label: `Search ideas for “${q}”`, href: searchHref(q), Icon: Search },
        ]
      : [];
    return [...launch, ...ideas, ...research, ...actions];
  }, [query, saved, threads]);

  const current = Math.min(active, Math.max(items.length - 1, 0));

  function go(item: Item | undefined) {
    if (!item) return;
    onClose();
    setQuery("");
    setActive(0);
    router.push(item.href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((current + 1) % Math.max(items.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((current - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[current]);
    }
  }

  let lastGroup = "";
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-label="Search and commands"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click outside
      }}
    >
      <div className={s.box}>
        <div className={s.inputRow}>
          <Search size={18} aria-hidden="true" />
          <input
            className={s.input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search ideas, research, or type a market to research…"
            aria-label="Search"
            aria-controls="palette-list"
            aria-activedescendant={items[current] ? `pal-${items[current].id}` : undefined}
            autoFocus
          />
          <kbd className={s.kbd}>Esc</kbd>
        </div>
        <ul id="palette-list" className={s.list} role="listbox" aria-label="Results">
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.id} role="presentation">
                {header && <p className={s.group}>{header}</p>}
                <button
                  type="button"
                  id={`pal-${item.id}`}
                  role="option"
                  aria-selected={i === current}
                  className={`${s.item} ${i === current ? s.itemOn : ""}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item)}
                >
                  <item.Icon size={17} aria-hidden="true" />
                  <span className={s.label}>{item.label}</span>
                  {item.sub && <span className={s.sub}>{item.sub}</span>}
                </button>
              </li>
            );
          })}
          {items.length === 0 && <li className={s.none}>No matches. Try another word.</li>}
        </ul>
      </div>
    </dialog>
  );
}
