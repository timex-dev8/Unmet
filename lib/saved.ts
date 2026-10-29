"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Card } from "./types";

// Saves live in this browser only (no accounts in the demo).
// We store a snapshot of each card so /saved works even if the feed changes.
const KEY = "unmet:saved:v1";
const EMPTY: Card[] = [];
const listeners = new Set<() => void>();
let cache: Card[] | null = null;

function read(): Card[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Card[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Private mode or storage full: keep the in-memory list for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => (cache ??= read());
const getServerSnapshot = () => EMPTY;

export function useSaved() {
  const saved = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isSaved = useCallback((slug: string) => saved.some((c) => c.slug === slug), [saved]);

  const save = useCallback((card: Card) => {
    const list = getSnapshot();
    if (!list.some((c) => c.slug === card.slug)) write([card, ...list]);
  }, []);

  const remove = useCallback((slug: string) => {
    write(getSnapshot().filter((c) => c.slug !== slug));
  }, []);

  const toggle = useCallback(
    (card: Card) => (getSnapshot().some((c) => c.slug === card.slug) ? remove(card.slug) : save(card)),
    [remove, save],
  );

  return { saved, isSaved, save, remove, toggle };
}
