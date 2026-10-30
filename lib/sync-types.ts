// What each browser store hands to the sync engine (lib/sync.ts). The screens never see this.

export type SyncKind = "threads" | "saved" | "board" | "mind" | "interests";

export type Syncable<T> = {
  kind: SyncKind;
  /** The data to upload (what this browser would store). */
  get: () => T;
  /** Swap in the account's version (after a download). */
  replace: (value: T) => void;
  /** Combine this browser's data with the account's on first sign-in, so nothing is lost. */
  merge: (local: T, remote: T) => T;
  /** Called after every local change. */
  subscribe: (listener: () => void) => () => void;
  /** Empty the store (sign-out on a shared computer). */
  clear: () => void;
};

/** Union of two lists by key; on a clash the item `pick` prefers wins. */
export function unionBy<T>(a: T[], b: T[], key: (x: T) => string, pick: (x: T, y: T) => T = (x) => x): T[] {
  const map = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const k = key(x);
    const had = map.get(k);
    map.set(k, had ? pick(had, x) : x);
  }
  return [...map.values()];
}
