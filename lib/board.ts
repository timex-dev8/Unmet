"use client";

import { useSyncExternalStore } from "react";
import type { Syncable } from "./sync-types";

export const STAGES = [
  { id: "spotted", label: "Spotted", hint: "Saved from the feed or research" },
  { id: "researching", label: "Researching", hint: "Digging into the evidence" },
  { id: "validating", label: "Validating", hint: "Talking to people who have it" },
  { id: "building", label: "Building", hint: "You’re making it" },
] as const;

export type Stage = (typeof STAGES)[number]["id"];
type BoardEntry = { stage: Stage; note: string; movedAt: number };
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

export function useBoard() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export function entryFor(board: BoardState, slug: string): BoardEntry {
  return board[slug] ?? { stage: "spotted", note: "", movedAt: 0 };
}

export function moveTo(slug: string, stage: Stage) {
  const board = getSnapshot();
  write({ ...board, [slug]: { ...entryFor(board, slug), stage, movedAt: Date.now() } });
}

export function setNote(slug: string, note: string) {
  const board = getSnapshot();
  write({ ...board, [slug]: { ...entryFor(board, slug), note: note.slice(0, 1000) } });
}

export function removeEntry(slug: string) {
  const board = getSnapshot();
  if (!(slug in board)) return;
  write(Object.fromEntries(Object.entries(board).filter(([entrySlug]) => entrySlug !== slug)));
}

export function nextStage(stage: Stage): Stage | null {
  const index = STAGES.findIndex((item) => item.id === stage);
  return index < STAGES.length - 1 ? STAGES[index + 1].id : null;
}

export function prevStage(stage: Stage): Stage | null {
  const index = STAGES.findIndex((item) => item.id === stage);
  return index > 0 ? STAGES[index - 1].id : null;
}

export const stageLabel = (stage: Stage) => STAGES.find((item) => item.id === stage)!.label;

export const boardSync: Syncable<BoardState> = {
  kind: "board",
  get: getSnapshot,
  replace: (state) => write(state),
  // per idea, whichever side moved it last wins
  merge: (local, remote) => {
    const merged = { ...remote };
    for (const [slug, entry] of Object.entries(local)) if (!merged[slug] || entry.movedAt > merged[slug].movedAt) merged[slug] = entry;
    return merged;
  },
  subscribe,
  clear: () => write({}),
};
