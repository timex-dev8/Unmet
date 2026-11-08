"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Syncable } from "./sync-types";
import type { Category } from "./types";

// picked = interest chips, skipped = swiped past in the feed

export type Profile = { text: string; audiences: string[]; keywords: string[]; niches: string[]; category?: Category };

export type Interests = { picked: Category[]; skipped: string[]; onboarded: boolean; profile?: Profile; watched?: string[] };

const KEY = "unmet:interests:v1";
const EMPTY: Interests = { picked: [], skipped: [], onboarded: false };
const listeners = new Set<() => void>();
let cache: Interests | null = null;

function read(): Interests {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return parsed && Array.isArray(parsed.picked) ? { ...EMPTY, ...parsed } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(next: Interests) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

const getSnapshot = () => (cache ??= read());

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

// frozen at page load so the order doesn't shift mid-swipe
let seenAtLoad: string[] | null = null;
const NOTHING_SEEN: string[] = [];

export function useSeenAtLoad() {
  return useSyncExternalStore(
    () => () => {},
    () => (seenAtLoad ??= getSnapshot().skipped),
    () => NOTHING_SEEN,
  );
}

export function useInterests() {
  const interests = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const toggle = useCallback((c: Category) => {
    const cur = getSnapshot();
    const picked = cur.picked.includes(c) ? cur.picked.filter((p) => p !== c) : [...cur.picked, c];
    write({ ...cur, picked });
  }, []);

  const finishOnboarding = useCallback(() => write({ ...getSnapshot(), onboarded: true }), []);

  return { interests, toggle, finishOnboarding };
}

export function setProfile(profile: Profile) {
  const cur = getSnapshot();
  const picked = profile.category && !cur.picked.includes(profile.category) ? [...cur.picked, profile.category] : cur.picked;
  write({ ...cur, profile, picked, onboarded: true });
}

export function toggleWatch(niche: string) {
  const cur = getSnapshot();
  const watched = cur.watched ?? [];
  write({ ...cur, watched: watched.includes(niche) ? watched.filter((n) => n !== niche) : [...watched, niche].slice(-10) });
}

export function completeOnboarding(profile: Profile | null, watched: string[]) {
  const cur = getSnapshot();
  const picked = profile?.category && !cur.picked.includes(profile.category) ? [...cur.picked, profile.category] : cur.picked;
  write({ ...cur, profile: profile ?? cur.profile, watched: [...new Set(watched)].slice(-10), picked, onboarded: true });
}

export function markSkipped(slug: string) {
  const cur = getSnapshot();
  if (cur.skipped.includes(slug)) return;
  write({ ...cur, skipped: [...cur.skipped, slug].slice(-200) });
}

export const interestsSync: Syncable<Interests> = {
  kind: "interests",
  get: getSnapshot,
  replace: (state) => write(state),
  // account's picks win once it has any, skips combine
  merge: (local, remote) => ({
    picked: remote.onboarded ? remote.picked : local.picked,
    skipped: [...new Set([...remote.skipped, ...local.skipped])].slice(-200),
    onboarded: local.onboarded || remote.onboarded,
    profile: remote.profile ?? local.profile,
    watched: [...new Set([...(remote.watched ?? []), ...(local.watched ?? [])])].slice(-10),
  }),
  subscribe,
  clear: () => write(EMPTY),
};
