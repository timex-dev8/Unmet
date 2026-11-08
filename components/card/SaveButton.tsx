"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSaved } from "@/lib/saved";
import type { Card } from "@/lib/types";
import s from "./card.module.css";

type Props = { label?: string; small?: boolean; quiet?: boolean } & (
  | { card: Card; load?: undefined }
  // slim copy of the card, the full one is fetched on save
  | { card: Pick<Card, "slug">; load: (slug: string) => Promise<Card | null> }
);

export default function SaveButton({ card, load, label = "Save", small = false, quiet = false }: Props) {
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
      className={`${s.act} ${saved ? s.actSaved : quiet ? s.actQuiet : "glossy"} ${small ? s.actSmall : ""} ${quiet ? s.actCompact : ""}`}
    >
      {/* keyed so icon and label re-enter on each flip */}
      {saved ? (
        <BookmarkCheck key="on" size={small ? 15 : 17} className={s.iconPop} aria-hidden="true" />
      ) : (
        <Bookmark key="off" size={small ? 15 : 17} aria-hidden="true" />
      )}
      <span key={saved ? "saved" : "save"} className={`${s.labelFade} ${quiet ? s.labelHidden : ""}`}>
        {saved ? "Saved" : label}
      </span>
    </button>
  );
}
