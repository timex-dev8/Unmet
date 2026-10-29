"use client";

import { useSyncExternalStore } from "react";
import type { MindConclusion } from "./mind-types";

// Your thoughts and the last AI conclusion about them, kept in this browser (Supabase later).

export type Thought = { id: string; text: string; at: number };
type MindState = { thoughts: Thought[]; conclusion: (MindConclusion & { at: number; count: number }) | null };

const KEY = "unmet:mind:v1";
const EMPTY: MindState = { thoughts: [], conclusion: null };
const listeners = new Set<() => void>();
let cache: MindState | null = null;

function read(): MindState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return parsed && Array.isArray(parsed.thoughts) ? { ...EMPTY, ...parsed } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(next: MindState) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: keep it for this visit
  }
  listeners.forEach((l) => l());
}

const getSnapshot = () => (cache ??= read());

export function useMind() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot,
    () => EMPTY,
  );
}

/** Adds one thought per non-empty line. */
export function addThoughts(text: string) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 50);
  if (!lines.length) return;
  const now = Date.now();
  const fresh = lines.map((t, i) => ({ id: Math.random().toString(36).slice(2, 10), text: t.slice(0, 500), at: now - i }));
  const cur = getSnapshot();
  write({ ...cur, thoughts: [...fresh, ...cur.thoughts].slice(0, 200) });
}

export function removeThought(id: string) {
  const cur = getSnapshot();
  write({ ...cur, thoughts: cur.thoughts.filter((t) => t.id !== id) });
}

export function saveConclusion(conclusion: MindConclusion) {
  const cur = getSnapshot();
  write({ ...cur, conclusion: { ...conclusion, at: Date.now(), count: cur.thoughts.length } });
}
