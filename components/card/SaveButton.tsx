"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSaved } from "@/lib/saved";
import type { Card } from "@/lib/types";
import s from "./card.module.css";

export default function SaveButton({ card, label = "Save" }: { card: Card; label?: string }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(card.slug);
  return (
    <button type="button" onClick={() => toggle(card)} aria-pressed={saved} className={`${s.act} ${saved ? s.actSaved : s.actPrimary}`}>
      {/* keyed so the icon and label re-enter (pop / fade) each time the state flips */}
      {saved ? <BookmarkCheck key="on" size={17} className={s.iconPop} aria-hidden="true" /> : <Bookmark key="off" size={17} aria-hidden="true" />}
      <span key={saved ? "saved" : "save"} className={s.labelFade}>
        {saved ? "Saved" : label}
      </span>
    </button>
  );
}
