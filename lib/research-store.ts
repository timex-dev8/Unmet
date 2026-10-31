"use client";

import { useSyncExternalStore } from "react";
import { type Syncable, unionBy } from "./sync-types";
import type { Card } from "./types";

// Research conversations ("threads"), kept in this browser so a reload doesn't lose them,
// and synced to the account when signed in (lib/sync.ts).

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  cards?: Card[];
  sourceCount?: number;
  mix?: string;
  error?: boolean;
  pending?: boolean;
};

export type Thread = { id: string; title: string; createdAt: number; updatedAt: number; messages: ChatMessage[] };

const KEY = "unmet:research:v2";
const OLD_KEY = "unmet:research:v1";
const EMPTY: Thread[] = [];
const MAX_THREADS = 40;
const listeners = new Set<() => void>();
let cache: Thread[] | null = null;

export const newId = () => Math.random().toString(36).slice(2, 10);

function read(): Thread[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    // One-time move of the single chat from the first version.
    const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? "[]") as ChatMessage[];
    const messages = Array.isArray(old) ? old.filter((m) => !m.pending) : [];
    if (!messages.length) return [];
    const now = Date.now();
    const title = messages.find((m) => m.role === "user")?.text ?? "Research";
    return [{ id: newId(), title, createdAt: now, updatedAt: now, messages }];
  } catch {
    return [];
  }
}

// A reload mid-answer can't resume the stream, so pending replies aren't stored (or synced).
const storable = (list: Thread[]) => list.slice(0, MAX_THREADS).map((t) => ({ ...t, messages: t.messages.filter((m) => !m.pending).slice(-40) }));

function write(list: Thread[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(storable(list)));
  } catch {
    // storage full or blocked: keep it in memory for this visit
  }
  listeners.forEach((l) => l());
}

const getSnapshot = () => (cache ??= read());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** All threads, most recently active first. */
export function useThreads() {
  const threads = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function useThread(id: string | undefined) {
  const threads = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return id ? threads.find((t) => t.id === id) : undefined;
}

/** True once the browser store is readable (avoids a "not found" flash while hydrating). */
export function useStoreReady() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function createThread(title: string) {
  const now = Date.now();
  const thread: Thread = { id: newId(), title: title.slice(0, 80), createdAt: now, updatedAt: now, messages: [] };
  write([thread, ...getSnapshot()]);
  return thread.id;
}

export function updateThread(id: string, fn: (messages: ChatMessage[]) => ChatMessage[]) {
  write(getSnapshot().map((t) => (t.id === id ? { ...t, messages: fn(t.messages), updatedAt: Date.now() } : t)));
}

/** Finds an idea card from past research in this browser (for /app/idea/[slug]). */
export function findResearchCard(slug: string): Card | undefined {
  for (const t of getSnapshot()) {
    for (const m of t.messages) {
      const card = m.cards?.find((c) => c.slug === slug);
      if (card) return card;
    }
  }
  return undefined;
}

export const threadsSync: Syncable<Thread[]> = {
  kind: "threads",
  get: () => storable(getSnapshot()),
  // A chat that's mid-answer here keeps its local copy, so the running research isn't lost.
  replace: (list) => {
    const busy = new Map(
      getSnapshot()
        .filter((t) => t.messages.some((m) => m.pending))
        .map((t) => [t.id, t]),
    );
    write(list.map((t) => busy.get(t.id) ?? t));
  },
  // Same thread on both sides: keep the one touched last.
  merge: (local, remote) =>
    unionBy(
      local,
      remote,
      (t) => t.id,
      (a, b) => (b.updatedAt > a.updatedAt ? b : a),
    ).sort((a, b) => b.updatedAt - a.updatedAt),
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  clear: () => write([]),
};
