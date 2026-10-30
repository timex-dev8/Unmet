"use client";

import { useSyncExternalStore } from "react";
import { boardSync } from "./board";
import { interestsSync } from "./interests";
import { mindSync } from "./mind";
import { threadsSync } from "./research-store";
import { savedSync } from "./saved";
import { supabase } from "./supabase/client";
import type { SyncKind, Syncable } from "./sync-types";

// Keeps the five browser stores in step with the signed-in account (table `user_data`).
// - First sign-in on a device: this browser's data and the account's are merged, so nothing is lost.
// - After that: each change uploads ~1.5s later; the account's copy is pulled on load and whenever
//   the tab comes back, replacing the local copy (unless a change here hasn't been uploaded yet).
// - Sign-out: the stores are emptied, so the next person on a shared computer starts clean.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STORES: Syncable<any>[] = [threadsSync, savedSync, boardSync, mindSync, interestsSync];
const SYNCED_USER = "unmet:sync:user"; // which account this browser's data belongs to
const DELAY = 1500;

export type SyncStatus = "off" | "syncing" | "synced" | "error";
let status: SyncStatus = "off";
const statusListeners = new Set<() => void>();
function setStatus(next: SyncStatus) {
  status = next;
  statusListeners.forEach((l) => l());
}
export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => void statusListeners.delete(l);
    },
    () => status,
    () => "off" as const,
  );
}

let userId: string | null = null;
let applying = false; // true while we write downloaded data, so it isn't uploaded straight back
const dirty = new Set<SyncKind>();
const timers = new Map<SyncKind, ReturnType<typeof setTimeout>>();
let unsubscribe: (() => void)[] = [];

const readFlag = () => {
  try {
    return localStorage.getItem(SYNCED_USER);
  } catch {
    return null;
  }
};
const writeFlag = (id: string | null) => {
  try {
    if (id) localStorage.setItem(SYNCED_USER, id);
    else localStorage.removeItem(SYNCED_USER);
  } catch {
    // storage blocked: sync still works for this visit
  }
};

function apply<T>(store: Syncable<T>, value: T) {
  applying = true;
  try {
    store.replace(value);
  } finally {
    applying = false;
  }
}

async function upload(store: Syncable<unknown>) {
  if (!userId) return;
  const { error } = await supabase()
    .from("user_data")
    .upsert({ user_id: userId, kind: store.kind, data: store.get(), updated_at: new Date().toISOString() });
  if (error) throw error;
}

function schedule(store: Syncable<unknown>, delay = DELAY) {
  dirty.add(store.kind);
  clearTimeout(timers.get(store.kind));
  setStatus("syncing");
  timers.set(
    store.kind,
    setTimeout(async () => {
      try {
        await upload(store);
        dirty.delete(store.kind);
        if (!dirty.size) setStatus("synced");
      } catch (err) {
        console.warn("[sync] upload failed:", err instanceof Error ? err.message : err);
        setStatus("error"); // stays dirty; the next change or focus tries again
      }
    }, delay),
  );
}

async function pull(merge: boolean) {
  if (!userId) return;
  const { data, error } = await supabase().from("user_data").select("kind, data").eq("user_id", userId);
  if (error) throw error;
  const remote = new Map(data.map((r) => [r.kind as SyncKind, r.data]));
  for (const store of STORES) {
    if (dirty.has(store.kind)) continue; // a local change is on its way up; don't overwrite it
    const theirs = remote.get(store.kind);
    if (theirs === undefined) {
      if (merge) schedule(store, 0); // account has nothing yet: upload this browser's data
      continue;
    }
    const next = merge ? store.merge(store.get(), theirs) : theirs;
    apply(store, next);
    if (merge && JSON.stringify(next) !== JSON.stringify(theirs)) schedule(store, 0);
  }
}

async function refresh(merge = false) {
  try {
    setStatus("syncing");
    await pull(merge);
    if (!dirty.size) setStatus("synced");
  } catch (err) {
    console.warn("[sync] download failed:", err instanceof Error ? err.message : err);
    setStatus("error");
  }
}

const onVisible = () => {
  if (document.visibilityState === "visible") {
    for (const store of STORES) if (dirty.has(store.kind)) schedule(store, 0); // retry failed uploads
    void refresh();
  }
};

/** Called when someone is signed in (on load or right after signing in). */
export async function startSync(id: string) {
  if (userId === id) return;
  stopSync();
  userId = id;
  const firstTimeHere = readFlag() !== id;
  writeFlag(id);
  unsubscribe = STORES.map((store) =>
    store.subscribe(() => {
      if (!applying && userId) schedule(store);
    }),
  );
  document.addEventListener("visibilitychange", onVisible);
  await refresh(firstTimeHere);
}

function stopSync() {
  unsubscribe.forEach((u) => u());
  unsubscribe = [];
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  dirty.clear();
  document.removeEventListener("visibilitychange", onVisible);
  userId = null;
  setStatus("off");
}

/** Called when nobody is signed in. Empties this browser only if its data belonged to an account. */
export function endSync() {
  stopSync();
  if (!readFlag()) return; // never synced: these are a guest's local notes, leave them
  writeFlag(null);
  applying = true;
  try {
    STORES.forEach((store) => store.clear());
  } finally {
    applying = false;
  }
}
