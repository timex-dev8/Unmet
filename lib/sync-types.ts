export type SyncKind = "threads" | "saved" | "board" | "mind" | "interests";

export type Syncable<T> = {
  kind: SyncKind;
  get: () => T;
  replace: (value: T) => void;
  merge: (local: T, remote: T) => T;
  subscribe: (listener: () => void) => () => void;
  clear: () => void;
};

export function unionBy<T>(first: T[], second: T[], key: (item: T) => string, pick: (existing: T, incoming: T) => T = (existing) => existing): T[] {
  const map = new Map<string, T>();
  for (const item of [...first, ...second]) {
    const itemKey = key(item);
    const existing = map.get(itemKey);
    map.set(itemKey, existing ? pick(existing, item) : item);
  }
  return [...map.values()];
}
