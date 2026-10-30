"use client";

import { useSyncExternalStore } from "react";
import type { Syncable } from "./sync-types";

// Where each saved idea sits on the board, plus your notes. Saved ideas start as "Spotted".
// Kept in this browser, and in the account when signed in (lib/sync.ts).

export const STAGES = [
  { id: "spotted", label: "Spotted", hint: "Saved from the feed or research" },
  { id: "researching", label: "Researching", hint: "Digging into the evidence" },
  { id: "validating", label: "Validating", hint: "Talking to people who have it" },
  { id: "building", label: "Building", hint: "You’re making it" },
] as const;

export type Stage = (typeof STAGES)[number]["id"];
export type BoardEntry = { stage: Stage; note: string; movedAt: number };
type BoardState = Record<string, BoardEntry>;

const KEY = "unmet:board:v1";
const EMPTY: BoardState = {};
const listeners = new Set<() => void>();
let cache: BoardState | null = null;

function read(): BoardState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(next: BoardState) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: keep it for this visit
  }
  listeners.forEach((l) => l());
}

const getSnapshot = () => (cache ??= read());

export function useBoard() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot,
    () => EMPTY,
  );
}

export function entryFor(board: BoardState, slug: string): BoardEntry {
  return board[slug] ?? { stage: "spotted", note: "", movedAt: 0 };
}

export function moveTo(slug: string, stage: Stage) {
  const cur = getSnapshot();
  write({ ...cur, [slug]: { ...entryFor(cur, slug), stage, movedAt: Date.now() } });
}

export function setNote(slug: string, note: string) {
  const cur = getSnapshot();
  write({ ...cur, [slug]: { ...entryFor(cur, slug), note: note.slice(0, 1000) } });
}

export function nextStage(stage: Stage): Stage | null {
  const i = STAGES.findIndex((s) => s.id === stage);
  return i < STAGES.length - 1 ? STAGES[i + 1].id : null;
}

export function prevStage(stage: Stage): Stage | null {
  const i = STAGES.findIndex((s) => s.id === stage);
  return i > 0 ? STAGES[i - 1].id : null;
}

export const stageLabel = (stage: Stage) => STAGES.find((s) => s.id === stage)!.label;

export const boardSync: Syncable<BoardState> = {
  kind: "board",
  get: getSnapshot,
  replace: (state) => write(state),
  // Per idea, keep whichever side moved it last.
  merge: (local, remote) => {
    const out = { ...remote };
    for (const [slug, e] of Object.entries(local)) if (!out[slug] || e.movedAt > out[slug].movedAt) out[slug] = e;
    return out;
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  clear: () => write({}),
};
