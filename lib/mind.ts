"use client";

import { useSyncExternalStore } from "react";
import type { MindBrief } from "./mind-types";
import { type Syncable, unionBy } from "./sync-types";

// Your notes about an idea and the last AI brief made from them (the Shape screen), kept in this
// browser and synced to the account when signed in (lib/sync.ts).

export type Thought = { id: string; text: string; at: number };
type MindState = { thoughts: Thought[]; conclusion: (MindBrief & { at: number; count: number }) | null };

/** Conclusions saved before Shape (no `idea`) count as none, so "Make it clear" shows again. */
function clean(state: MindState): MindState {
  return state.conclusion && typeof state.conclusion.idea === "string" ? state : { ...state, conclusion: null };
}

const KEY = "unmet:mind:v1";
const EMPTY: MindState = { thoughts: [], conclusion: null };
const listeners = new Set<() => void>();
let cache: MindState | null = null;

function read(): MindState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return parsed && Array.isArray(parsed.thoughts) ? clean({ ...EMPTY, ...parsed }) : EMPTY;
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

// Another tab changed the stored value: drop the in-memory copy and re-read.
function subscribe(l: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  listeners.add(l);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMind() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

/** Adds one note, newest first. A long description with line breaks stays one note. */
export function addThought(text: string) {
  const note = text.trim().slice(0, 2000);
  if (!note) return;
  const cur = getSnapshot();
  write({ ...cur, thoughts: [{ id: Math.random().toString(36).slice(2, 10), text: note, at: Date.now() }, ...cur.thoughts].slice(0, 200) });
}

export function removeThought(id: string) {
  const cur = getSnapshot();
  write({ ...cur, thoughts: cur.thoughts.filter((t) => t.id !== id) });
}

/** Marks the moment a brief is requested (see saveConclusion). */
export const mindMark = () => ({ at: Date.now(), count: getSnapshot().thoughts.length });

/** `at` and `count` are captured when the brief was requested, so notes added while it loaded still show as changed. */
export function saveConclusion(conclusion: MindBrief, at: number = Date.now(), count?: number) {
  const cur = getSnapshot();
  write({ ...cur, conclusion: { ...conclusion, at, count: count ?? cur.thoughts.length } });
}

export const mindSync: Syncable<MindState> = {
  kind: "mind",
  get: getSnapshot,
  replace: (state) => write(clean(state)),
  merge: (local, remote) => {
    const [mine, theirs] = [clean(local).conclusion, clean(remote).conclusion];
    return {
      thoughts: unionBy(local.thoughts, remote.thoughts, (t) => t.id)
        .sort((a, b) => b.at - a.at)
        .slice(0, 200),
      conclusion: (mine?.at ?? 0) > (theirs?.at ?? 0) ? mine : theirs,
    };
  },
  subscribe,
  clear: () => write(EMPTY),
};
