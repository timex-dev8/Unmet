"use client";

import { useSyncExternalStore } from "react";
import type { MindBrief } from "./mind-types";
import { type Syncable, unionBy } from "./sync-types";

type Thought = { id: string; text: string; at: number };
type MindState = { thoughts: Thought[]; conclusion: (MindBrief & { at: number; count: number }) | null };

// conclusions from before Shape (no idea) count as none
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
  } catch {}
  listeners.forEach((listener) => listener());
}

const getSnapshot = () => (cache ??= read());

function subscribe(listener: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMind() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

// a long description with line breaks stays one note
export function addThought(text: string) {
  const note = text.trim().slice(0, 2000);
  if (!note) return;
  const current = getSnapshot();
  write({ ...current, thoughts: [{ id: Math.random().toString(36).slice(2, 10), text: note, at: Date.now() }, ...current.thoughts].slice(0, 200) });
}

export function removeThought(id: string) {
  const current = getSnapshot();
  write({ ...current, thoughts: current.thoughts.filter((thought) => thought.id !== id) });
}

export const mindMark = () => ({ at: Date.now(), count: getSnapshot().thoughts.length });

// at and count are from when the brief was requested, so notes added while it loaded still show as changed
export function saveConclusion(conclusion: MindBrief, at: number = Date.now(), count?: number) {
  const current = getSnapshot();
  write({ ...current, conclusion: { ...conclusion, at, count: count ?? current.thoughts.length } });
}

export const mindSync: Syncable<MindState> = {
  kind: "mind",
  get: getSnapshot,
  replace: (state) => write(clean(state)),
  merge: (local, remote) => {
    const [mine, theirs] = [clean(local).conclusion, clean(remote).conclusion];
    return {
      thoughts: unionBy(local.thoughts, remote.thoughts, (thought) => thought.id)
        .sort((a, b) => b.at - a.at)
        .slice(0, 200),
      conclusion: (mine?.at ?? 0) > (theirs?.at ?? 0) ? mine : theirs,
    };
  },
  subscribe,
  clear: () => write(EMPTY),
};
