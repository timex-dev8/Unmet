"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSaved } from "@/lib/saved";
import type { Card } from "@/lib/types";
import s from "./card.module.css";

export default function SaveButton({ card, label = "Save" }: { card: Card; label?: string }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(card.slug);
  return (
    <button
      type="button"
      onClick={() => toggle(card)}
      aria-pressed={saved}
      className={`${s.act} ${saved ? s.actSaved : s.actPrimary}`}
    >
      {saved ? <BookmarkCheck size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}
      {saved ? "Saved" : label}
    </button>
  );
}
