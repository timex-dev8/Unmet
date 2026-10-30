"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Syncable } from "./sync-types";
import type { Category } from "./types";

// What this visitor cares about, kept in the browser and synced to the account when signed in.
// `picked` comes from the interest chips; `skipped` from swiping past cards in the feed.

/** What someone told Unmet in their own words, expanded by Gemini (app/api/interests). */
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
  } catch {
    // storage blocked: keep it for this visit
  }
  listeners.forEach((l) => l());
}

const getSnapshot = () => (cache ??= read());

export function useInterests() {
  const interests = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot,
    () => EMPTY,
  );

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

/** Niches this person follows: they rank first, and (signed in) join the daily feed research. */
export function toggleWatch(niche: string) {
  const cur = getSnapshot();
  const watched = cur.watched ?? [];
  write({ ...cur, watched: watched.includes(niche) ? watched.filter((n) => n !== niche) : [...watched, niche].slice(-10) });
}

/** Onboarding: save the profile, the niches picked to follow, and mark onboarding done. */
export function completeOnboarding(profile: Profile | null, watched: string[]) {
  const cur = getSnapshot();
  const picked = profile?.category && !cur.picked.includes(profile.category) ? [...cur.picked, profile.category] : cur.picked;
  write({ ...cur, profile: profile ?? cur.profile, watched: [...new Set(watched)].slice(-10), picked, onboarded: true });
}

/** Called by the feed when someone swipes past a card without saving it. */
export function markSkipped(slug: string) {
  const cur = getSnapshot();
  if (cur.skipped.includes(slug)) return;
  write({ ...cur, skipped: [...cur.skipped, slug].slice(-200) });
}

export const interestsSync: Syncable<Interests> = {
  kind: "interests",
  get: getSnapshot,
  replace: (state) => write(state),
  // The account's picks win once it has made any; skips are combined.
  merge: (local, remote) => ({
    picked: remote.onboarded ? remote.picked : local.picked,
    skipped: [...new Set([...remote.skipped, ...local.skipped])].slice(-200),
    onboarded: local.onboarded || remote.onboarded,
    profile: remote.profile ?? local.profile,
    watched: [...new Set([...(remote.watched ?? []), ...(local.watched ?? [])])].slice(-10),
  }),
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  clear: () => write(EMPTY),
};
