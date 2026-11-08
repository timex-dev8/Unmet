"use client";

import { useSyncExternalStore } from "react";
import { type Syncable, unionBy } from "./sync-types";
import type { Card } from "./types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  cards?: Card[];
  sourceCount?: number;
  mix?: string;
  suggestions?: string[];
  error?: boolean;
  pending?: boolean;
};

type Thread = { id: string; title: string; createdAt: number; updatedAt: number; messages: ChatMessage[] };

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
    // one-time move of the single chat from v1
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

// pending replies aren't stored or synced, a reload can't resume the stream
const storable = (list: Thread[]) => list.slice(0, MAX_THREADS).map((t) => ({ ...t, messages: t.messages.filter((m) => !m.pending).slice(-40) }));

function write(list: Thread[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(storable(list)));
  } catch {}
  listeners.forEach((l) => l());
}

const getSnapshot = () => (cache ??= read());
// other tab changed it, re-read but keep this tab's mid-answer chats
const subscribe = (l: () => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    const pending = (cache ?? []).filter((t) => t.messages.some((m) => m.pending));
    cache = null;
    if (pending.length) {
      const fresh = getSnapshot();
      cache = [...pending, ...fresh.filter((t) => !pending.some((p) => p.id === t.id))];
    }
    l();
  };
  listeners.add(l);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

export function useThreads() {
  const threads = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function useThread(id: string | undefined) {
  const threads = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return id ? threads.find((t) => t.id === id) : undefined;
}

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
  replace: (list) => {
    const busy = new Map(
      getSnapshot()
        .filter((t) => t.messages.some((m) => m.pending))
        .map((t) => [t.id, t]),
    );
    write(list.map((t) => busy.get(t.id) ?? t));
  },
  merge: (local, remote) =>
    unionBy(
      local,
      remote,
      (t) => t.id,
      (a, b) => (b.updatedAt > a.updatedAt ? b : a),
    ).sort((a, b) => b.updatedAt - a.updatedAt),
  subscribe,
  clear: () => write([]),
};
