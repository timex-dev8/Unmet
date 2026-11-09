"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSaved } from "@/lib/saved";
import type { Card } from "@/lib/types";
import styles from "./card.module.css";

// primary is the blue version, only when saving is the main action on the screen
type Props = {
  label?: string;
  small?: boolean;
  quiet?: boolean;
  primary?: boolean;
} & (
  | { card: Card; load?: undefined }
  // slim copy of the card, the full one is fetched on save
  | { card: Pick<Card, "slug">; load: (slug: string) => Promise<Card | null> }
);

export default function SaveButton({ card, load, label = "Save", small = false, quiet = false, primary = false }: Props) {
  const { isSaved, save, remove } = useSaved();
  const saved = isSaved(card.slug);
  const toggle = async () => {
    if (saved) return remove(card.slug);
    const full = load ? await load(card.slug).catch(() => null) : (card as Card);
    if (full) save(full);
  };
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={saved}
      className={`${styles.act} ${saved ? styles.actSaved : primary ? "glossy" : styles.actQuiet} ${small ? styles.actSmall : ""} ${quiet ? styles.actCompact : ""}`}
    >
      {/* keyed so icon and label re-enter on each flip */}
      {saved ? (
        <BookmarkCheck key="on" size={small ? 15 : 17} className={styles.iconPop} aria-hidden="true" />
      ) : (
        <Bookmark key="off" size={small ? 15 : 17} aria-hidden="true" />
      )}
      <span key={saved ? "saved" : "save"} className={`${styles.labelFade} ${quiet ? styles.labelHidden : ""}`}>
        {saved ? "Saved" : label}
      </span>
    </button>
  );
}
