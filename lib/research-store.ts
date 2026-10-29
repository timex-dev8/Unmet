"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Card } from "./types";

// The research conversation, kept in this browser so a reload doesn't lose it.
// (Moves to Supabase in the next stage.)

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  cards?: Card[];
  sourceCount?: number;
  error?: boolean;
  pending?: boolean;
};

const KEY = "unmet:research:v1";
const EMPTY: ChatMessage[] = [];
const listeners = new Set<() => void>();
let cache: ChatMessage[] | null = null;

function read(): ChatMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // A reload mid-answer leaves a pending message behind; drop it.
    return Array.isArray(parsed) ? parsed.filter((m: ChatMessage) => !m.pending) : [];
  } catch {
    return [];
  }
}

function write(list: ChatMessage[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.filter((m) => !m.pending).slice(-30)));
  } catch {
    // storage full or blocked: keep it in memory for this visit
  }
  listeners.forEach((l) => l());
}

const getSnapshot = () => (cache ??= read());

export function useResearchChat() {
  const messages = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot,
    () => EMPTY,
  );

  const set = useCallback((update: (list: ChatMessage[]) => ChatMessage[]) => write(update(getSnapshot())), []);
  const clear = useCallback(() => write([]), []);
  return { messages, set, clear };
}

/** Finds an idea card from past research in this browser (for /idea/[slug]). */
export function findResearchCard(slug: string): Card | undefined {
  for (const m of getSnapshot()) {
    const card = m.cards?.find((c) => c.slug === slug);
    if (card) return card;
  }
  return undefined;
}
