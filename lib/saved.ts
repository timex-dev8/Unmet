"use client";

import { useCallback, useSyncExternalStore } from "react";
import { type Syncable, unionBy } from "./sync-types";
import type { Card } from "./types";

// snapshot of each card is stored so /saved works even if the feed changes
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
  } catch {}
  listeners.forEach((listener) => listener());
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

  const isSaved = useCallback((slug: string) => saved.some((savedCard) => savedCard.slug === slug), [saved]);

  const save = useCallback((card: Card) => {
    const list = getSnapshot();
    if (!list.some((savedCard) => savedCard.slug === card.slug)) write([card, ...list]);
  }, []);

  const remove = useCallback((slug: string) => {
    write(getSnapshot().filter((savedCard) => savedCard.slug !== slug));
  }, []);

  const toggle = useCallback(
    (card: Card) => (getSnapshot().some((savedCard) => savedCard.slug === card.slug) ? remove(card.slug) : save(card)),
    [remove, save],
  );

  return { saved, isSaved, save, remove, toggle };
}

export const savedSync: Syncable<Card[]> = {
  kind: "saved",
  get: getSnapshot,
  replace: (list) => write(list),
  merge: (local, remote) => unionBy(local, remote, (card) => card.slug),
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  clear: () => write([]),
};
