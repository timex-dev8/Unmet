export type SyncKind = "threads" | "saved" | "board" | "mind" | "interests";

export type Syncable<T> = {
  kind: SyncKind;
  get: () => T;
  replace: (value: T) => void;
  merge: (local: T, remote: T) => T;
  subscribe: (listener: () => void) => () => void;
  clear: () => void;
};

export function unionBy<T>(a: T[], b: T[], key: (x: T) => string, pick: (x: T, y: T) => T = (x) => x): T[] {
  const map = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const k = key(x);
    const had = map.get(k);
    map.set(k, had ? pick(had, x) : x);
  }
  return [...map.values()];
}
