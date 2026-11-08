"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { toggleWatch, useInterests } from "@/lib/interests";
import { researchHref } from "@/lib/links";
import styles from "./home.module.css";

function useWatch() {
  return async (niche: string, watching: boolean) => {
    toggleWatch(niche);
    // guests only rank locally
    const auth = await authHeaders();
    if (!auth.Authorization) return;
    const headers = { "Content-Type": "application/json", ...auth };
    await fetch("/api/watch", { method: watching ? "DELETE" : "POST", headers, body: JSON.stringify({ niche }) }).catch(() => {});
  };
}

export function Niches() {
  const { interests } = useInterests();
  const watch = useWatch();
  const watched = interests.watched ?? [];
  const niches = [...new Set([...(interests.profile?.niches ?? []), ...watched])];

  if (!niches.length) {
    return (
      <Link href="/welcome/start?next=/app" className={styles.setup}>
        <span>
          <strong>Tell Unmet who you build for</strong>
          <span>Get problems from your niches first, and have them researched every few days.</span>
        </span>
        <span className={`glossy ${styles.setupGo}`}>Set up</span>
      </Link>
    );
  }

  return (
    <div className={styles.niches}>
      {niches.map((niche) => {
        const isWatched = watched.includes(niche);
        return (
          <div key={niche} className={styles.niche}>
            <Link href={researchHref(`What problems do ${niche} complain about?`, "low")} className={styles.nicheName}>
              {niche}
            </Link>
            <button
              type="button"
              className={`${styles.watch} ${isWatched ? styles.watchOn : ""}`}
              aria-pressed={isWatched}
              onClick={() => watch(niche, isWatched)}
            >
              {isWatched ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
              {isWatched ? "Watching" : "Watch"}
            </button>
          </div>
        );
      })}
      <Link href="/welcome/start?next=/app" className={styles.nicheEdit}>
        Edit
      </Link>
    </div>
  );
}
