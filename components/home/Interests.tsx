"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { toggleWatch, useInterests } from "@/lib/interests";
import { researchHref } from "@/lib/links";
import s from "./home.module.css";

/** Watching a niche ranks it first here and adds it to Unmet's daily research (app/api/watch). */
export function useWatch() {
  return async (niche: string, watching: boolean) => {
    toggleWatch(niche);
    // Signed in only (guests just rank locally). Un-watching takes it off the research list again.
    const auth = await authHeaders();
    if (!auth.Authorization) return;
    const headers = { "Content-Type": "application/json", ...auth };
    await fetch("/api/watch", { method: watching ? "DELETE" : "POST", headers, body: JSON.stringify({ niche }) }).catch(() => {});
  };
}

/** The niches someone follows (from onboarding), each with Watch and a research link, plus Edit. */
export function Niches() {
  const { interests } = useInterests();
  const watch = useWatch();
  const watched = interests.watched ?? [];
  const niches = [...new Set([...(interests.profile?.niches ?? []), ...watched])];

  if (!niches.length) {
    return (
      <Link href="/welcome/start?next=/app" className={s.setup}>
        <span>
          <strong>Tell Unmet who you build for</strong>
          <span>Get problems from your niches first, and have them researched every few days.</span>
        </span>
        <span className={`glossy ${s.setupGo}`}>Set up</span>
      </Link>
    );
  }

  return (
    <div className={s.niches}>
      {niches.map((n) => {
        const on = watched.includes(n);
        return (
          <div key={n} className={s.niche}>
            <Link href={researchHref(`What problems do ${n} complain about?`, "low")} className={s.nicheName}>
              {n}
            </Link>
            <button type="button" className={`${s.watch} ${on ? s.watchOn : ""}`} aria-pressed={on} onClick={() => watch(n, on)}>
              {on ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
              {on ? "Watching" : "Watch"}
            </button>
          </div>
        );
      })}
      <Link href="/welcome/start?next=/app" className={s.nicheEdit}>
        Edit
      </Link>
    </div>
  );
}
