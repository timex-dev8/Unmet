"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useSaved } from "@/lib/saved";
import s from "./app.module.css";

export default function SavedLink() {
  const { saved } = useSaved();
  return (
    <Link href="/saved" className={s.savedLink} aria-label={`Saved ideas: ${saved.length}`}>
      <Bookmark size={16} fill="currentColor" aria-hidden="true" />
      {/* key changes with the count, replaying the bump animation */}
      <span key={saved.length} className={saved.length ? s.bump : undefined}>
        Saved {saved.length}
      </span>
    </Link>
  );
}
