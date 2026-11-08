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
// - Sign-out: unsaved changes upload first, then the stores are emptied, so the next person on a
//   shared computer starts clean. Data that couldn't upload stays until that account signs in again;
//   a different account signing in here starts clean instead of inheriting it.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STORES: Syncable<any>[] = [threadsSync, savedSync, boardSync, mindSync, interestsSync];
const SYNCED_USER = "unmet:sync:user"; // which account this browser's data belongs to (set once merged)
const UNSAVED = "unmet:sync:unsaved"; // "1": sign-out couldn't upload everything, so the data was kept
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
let needsMerge = false; // this browser's data hasn't been merged into the account yet
let gen = 0; // bumped by every start and end, so a slow endSync can't undo a newer sign-in
const dirty = new Set<SyncKind>();
const revs = new Map<SyncKind, number>(); // bumped on every change, so a slow upload can't mark a newer one saved
const timers = new Map<SyncKind, ReturnType<typeof setTimeout>>();
let unsubscribe: (() => void)[] = [];

const readKey = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeKey = (key: string, value: string | null) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // storage blocked: sync still works for this visit
  }
};
const readFlag = () => readKey(SYNCED_USER);
const writeFlag = (id: string | null) => writeKey(SYNCED_USER, id);

function apply<T>(store: Syncable<T>, value: T) {
  applying = true;
  try {
    store.replace(value);
  } finally {
    applying = false;
  }
}

function clearStores() {
  applying = true;
  try {
    STORES.forEach((store) => store.clear());
  } finally {
    applying = false;
  }
}

async function upload(store: Syncable<unknown>, id: string) {
  const db = await supabase();
  const { error } = await db.from("user_data").upsert({ user_id: id, kind: store.kind, data: store.get(), updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Uploads one store; it stops being dirty only if nothing changed while the upload was on its way. */
async function save(store: Syncable<unknown>, id: string) {
  const rev = revs.get(store.kind);
  await upload(store, id);
  if (revs.get(store.kind) === rev) dirty.delete(store.kind);
}

function schedule(store: Syncable<unknown>, delay = DELAY) {
  dirty.add(store.kind);
  revs.set(store.kind, (revs.get(store.kind) ?? 0) + 1);
  clearTimeout(timers.get(store.kind));
  setStatus("syncing");
  const id = userId;
  timers.set(
    store.kind,
    setTimeout(async () => {
      timers.delete(store.kind);
      if (!id) return;
      try {
        await save(store, id);
        if (!dirty.size) setStatus("synced");
      } catch (err) {
        console.warn("[sync] upload failed:", err instanceof Error ? err.message : err);
        setStatus("error"); // stays dirty; the next change or focus tries again
      }
    }, delay),
  );
}

/** Uploads every unsaved change now, waiting at most `ms`. True when nothing is left unsaved. */
export async function flushSync(ms = 4000): Promise<boolean> {
  const id = userId;
  if (!id || !dirty.size) return !dirty.size;
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  const jobs = Promise.allSettled(STORES.filter((store) => dirty.has(store.kind)).map((store) => save(store, id)));
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([jobs, new Promise((resolve) => (timer = setTimeout(resolve, ms)))]);
  clearTimeout(timer);
  if (dirty.size) console.warn("[sync] couldn't upload:", [...dirty].join(", "));
  return !dirty.size;
}

async function pull(merge: boolean) {
  const id = userId;
  if (!id) return;
  const startRevs = new Map(revs);
  const { data, error } = await (await supabase()).from("user_data").select("kind, data").eq("user_id", id);
  if (error) throw error;
  if (userId !== id) return; // signed out (or switched) while downloading: never restore that account's data
  const remote = new Map(data.map((r) => [r.kind as SyncKind, r.data]));
  for (const store of STORES) {
    // A local change is on its way up; don't overwrite it. (A merge keeps it anyway.)
    if (!merge && dirty.has(store.kind)) continue;
    // Changed here while the download was on its way: this copy is stale, the change will upload and the next pull catches up.
    if (!merge && revs.get(store.kind) !== startRevs.get(store.kind)) continue;
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

async function refresh() {
  const id = userId;
  const merge = needsMerge;
  try {
    setStatus("syncing");
    await pull(merge);
    if (userId !== id || !id) return;
    if (merge) {
      // The first merge only counts once this browser's data is in the account too; until then
      // every pull merges, so a plain download can't replace the guest's data.
      if (!(await flushSync(10_000))) throw new Error("this browser's data didn't upload");
      if (userId !== id || !id) return;
      needsMerge = false;
      writeFlag(id);
      writeKey(UNSAVED, null);
    }
    if (!dirty.size) setStatus("synced");
  } catch (err) {
    console.warn("[sync] download failed:", err instanceof Error ? err.message : err);
    setStatus("error");
  }
}

const onVisible = async () => {
  if (document.visibilityState !== "visible") return;
  for (const store of STORES) if (dirty.has(store.kind)) schedule(store, 0); // retry failed uploads
  // Upload first, then pull, so the download can't race the upload of the same change.
  await flushSync(4000).catch(() => false);
  await refresh();
};

/** Called when someone is signed in (on load or right after signing in). */
export async function startSync(id: string) {
  gen++;
  if (userId === id) return;
  stopSync();
  const owner = readFlag();
  if (owner && owner !== id) {
    // This browser holds another account's data: start clean instead of merging it into this one.
    clearStores();
    writeFlag(null);
    writeKey(UNSAVED, null);
  }
  userId = id;
  needsMerge = readFlag() !== id || readKey(UNSAVED) === "1";
  unsubscribe = STORES.map((store) =>
    store.subscribe(() => {
      if (!applying && userId) schedule(store);
    }),
  );
  document.addEventListener("visibilitychange", onVisible);
  await refresh();
}

function stopSync() {
  unsubscribe.forEach((u) => u());
  unsubscribe = [];
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  dirty.clear();
  revs.clear();
  document.removeEventListener("visibilitychange", onVisible);
  userId = null;
  needsMerge = false;
  setStatus("off");
}

/** Called when nobody is signed in. Empties this browser only if its data belonged to an account. */
export async function endSync() {
  const my = ++gen;
  const id = userId;
  // Last chance for changes from the last moments (signOut() normally uploaded them already).
  const saved = id ? await flushSync(3000) : true;
  if (my !== gen) return; // signed in again meanwhile
  const unmerged = Boolean(id) && needsMerge;
  stopSync();
  if (id && (!saved || unmerged)) {
    // Some changes never reached the account: keep them here and merge them on this account's next sign-in.
    writeFlag(id);
    writeKey(UNSAVED, "1");
    return;
  }
  if (!readFlag() || readKey(UNSAVED) === "1") return; // a guest's local notes, or kept unsaved work: leave them
  writeFlag(null);
  clearStores();
}
