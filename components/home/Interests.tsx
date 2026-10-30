"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Eye, EyeOff, LoaderCircle, Sparkles } from "lucide-react";
import { accessToken, useUser } from "@/lib/auth";
import { setProfile, toggleWatch, useInterests, type Profile } from "@/lib/interests";
import { CATEGORIES } from "@/lib/types";
import s from "./home.module.css";

const researchHref = (niche: string) => `/app/research?q=${encodeURIComponent(`What problems do ${niche} complain about?`)}&depth=medium`;

/** Watching a niche ranks it first here; signed in, it also joins Unmet's daily research (app/api/watch). */
export function useWatch() {
  const user = useUser();
  return async (niche: string, watching: boolean) => {
    toggleWatch(niche);
    if (watching || !user) return;
    const token = await accessToken();
    if (token)
      await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ niche }),
      }).catch(() => {});
  };
}

// Onboarding / editing: one plain-language question, Gemini turns it into niches; chips as quick picks.
export function InterestsEditor({ onDone, style }: { onDone: () => void; style?: React.CSSProperties }) {
  const { interests, toggle, finishOnboarding } = useInterests();
  const [text, setText] = useState(interests.profile?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/interests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that. Try again.");
      setProfile(data.profile as Profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${s.interests} rise`} style={style} aria-labelledby="interests-title">
      <h2 id="interests-title" className={s.h2}>
        {interests.onboarded ? "Your interests" : "Who do you want to build for?"}
      </h2>
      <form className={s.profileForm} onSubmit={submit}>
        <label htmlFor="profile-text" className="sr-only">
          What you know well, or who you want to build for
        </label>
        <input
          id="profile-text"
          className={s.profileInput}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. “I'm a nurse”, “small coffee shops”, “indie game devs”"
          maxLength={300}
        />
        <button type="submit" className="pill pill-dark" disabled={busy || text.trim().length < 2}>
          {busy ? <LoaderCircle size={16} className={s.spin} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
          Personalize
        </button>
      </form>
      {error && <p className={s.formError}>{error}</p>}

      {interests.profile && <Niches />}

      <p className={s.orPick}>Or pick topics</p>
      <div className={s.chips}>
        {CATEGORIES.map((c) => {
          const on = interests.picked.includes(c);
          return (
            <button key={c} type="button" className={s.chip} aria-pressed={on} onClick={() => toggle(c)}>
              {c}
              {on && <Check size={14} strokeWidth={2.8} className={s.check} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="pill pill-dark"
        onClick={() => {
          finishOnboarding();
          onDone();
        }}
      >
        Done
      </button>
    </section>
  );
}

/** The niches from someone's profile, each with Watch and Research. */
export function Niches() {
  const { interests } = useInterests();
  const user = useUser();
  const watch = useWatch();
  const watched = interests.watched ?? [];
  const niches = [...new Set([...(interests.profile?.niches ?? []), ...watched])];
  if (!niches.length) return null;
  return (
    <div className={s.niches}>
      {niches.map((n) => {
        const on = watched.includes(n);
        return (
          <div key={n} className={s.niche}>
            <Link href={researchHref(n)} className={s.nicheName}>
              {n}
            </Link>
            <button type="button" className={`${s.watch} ${on ? s.watchOn : ""}`} aria-pressed={on} onClick={() => watch(n, on)}>
              {on ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
              {on ? "Watching" : "Watch"}
            </button>
          </div>
        );
      })}
      <p className={s.nicheNote}>
        {user
          ? "Watched niches rank first, and Unmet researches them every few days."
          : "Watched niches rank first. Sign in and Unmet also researches them every few days."}
      </p>
    </div>
  );
}
