"use client";

import { useSyncExternalStore } from "react";
import { boardSync } from "./board";
import { interestsSync } from "./interests";
import { mindSync } from "./mind";
import { threadsSync } from "./research-store";
import { savedSync } from "./saved";
import { supabase } from "./supabase/client";
import type { SyncKind, Syncable } from "./sync-types";

// first sign-in merges local and account data. after that changes upload ~1.5s later and the account copy is pulled on load and tab focus
// sign-out uploads first, then empties the stores for the next person on a shared computer. data that failed to upload stays for that account, another account starts clean

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STORES: Syncable<any>[] = [threadsSync, savedSync, boardSync, mindSync, interestsSync];
const SYNCED_USER = "unmet:sync:user"; // account this browser's data belongs to
const UNSAVED = "unmet:sync:unsaved"; // "1" = sign-out could not upload everything
const DELAY = 1500;

type SyncStatus = "off" | "syncing" | "synced" | "error";
let status: SyncStatus = "off";
const statusListeners = new Set<() => void>();
function setStatus(next: SyncStatus) {
  status = next;
  statusListeners.forEach((listener) => listener());
}
export function useSyncStatus() {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener);
      return () => void statusListeners.delete(listener);
    },
    () => status,
    () => "off" as const,
  );
}

let userId: string | null = null;
let applying = false; // true while writing downloaded data so it isn't uploaded back
let needsMerge = false; // local data not merged into the account yet
let generation = 0; // bumped on every start/end so a slow endSync can't undo a newer sign-in
const dirty = new Set<SyncKind>();
const revisions = new Map<SyncKind, number>(); // bumped per change so a slow upload can't mark a newer one saved
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
  } catch {}
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

async function save(store: Syncable<unknown>, id: string) {
  const revision = revisions.get(store.kind);
  await upload(store, id);
  if (revisions.get(store.kind) === revision) dirty.delete(store.kind);
}

function schedule(store: Syncable<unknown>, delay = DELAY) {
  dirty.add(store.kind);
  revisions.set(store.kind, (revisions.get(store.kind) ?? 0) + 1);
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
        setStatus("error"); // stays dirty, next change or focus retries
      }
    }, delay),
  );
}

export async function flushSync(ms = 4000): Promise<boolean> {
  const id = userId;
  if (!id || !dirty.size) return !dirty.size;
  timers.forEach((timer) => clearTimeout(timer));
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
  const startRevisions = new Map(revisions);
  const { data, error } = await (await supabase()).from("user_data").select("kind, data").eq("user_id", id);
  if (error) throw error;
  if (userId !== id) return; // signed out or switched meanwhile, never restore that account's data
  const remote = new Map(data.map((row) => [row.kind as SyncKind, row.data]));
  for (const store of STORES) {
    // local change on its way up, don't overwrite (a merge keeps it anyway)
    if (!merge && dirty.has(store.kind)) continue;
    // changed here during the download so this copy is stale, next pull catches up
    if (!merge && revisions.get(store.kind) !== startRevisions.get(store.kind)) continue;
    const theirs = remote.get(store.kind);
    if (theirs === undefined) {
      if (merge) schedule(store, 0); // account is empty, upload this browser's data
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
      // first merge counts once local data is in the account too, until then every pull merges
      // so a plain download can't replace guest data
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
  // upload then pull so the download can't race the upload
  await flushSync(4000).catch(() => false);
  await refresh();
};

export async function startSync(id: string) {
  generation++;
  if (userId === id) return;
  stopSync();
  const owner = readFlag();
  if (owner && owner !== id) {
    // another account's data here, start clean instead of merging
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
  unsubscribe.forEach((stopListening) => stopListening());
  unsubscribe = [];
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  dirty.clear();
  revisions.clear();
  document.removeEventListener("visibilitychange", onVisible);
  userId = null;
  needsMerge = false;
  setStatus("off");
}

export async function endSync() {
  const myGeneration = ++generation;
  const id = userId;
  // last chance for recent changes (signOut normally uploaded already)
  const saved = id ? await flushSync(3000) : true;
  if (myGeneration !== generation) return; // signed in again meanwhile
  const unmerged = Boolean(id) && needsMerge;
  stopSync();
  if (id && (!saved || unmerged)) {
    // some changes never reached the account, keep them and merge on next sign-in
    writeFlag(id);
    writeKey(UNSAVED, "1");
    return;
  }
  if (!readFlag() || readKey(UNSAVED) === "1") return; // guest's local notes or kept unsaved work, leave them
  writeFlag(null);
  clearStores();
}
