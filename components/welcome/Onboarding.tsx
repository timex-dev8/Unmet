"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle, Plus } from "lucide-react";
import Logo from "@/components/Logo";
import { authHeaders } from "@/lib/auth";
import { completeOnboarding, useInterests, type Profile } from "@/lib/interests";
import { safeNext } from "@/lib/links";
import s from "./welcome.module.css";

const EXAMPLES = ["I'm a nurse", "small coffee shops", "indie game devs", "freelance designers"];

// Two steps, once: who you build for → which niches to follow. Skip is always there.
export default function Onboarding({ next }: { next: string }) {
  const router = useRouter();
  const { interests } = useInterests();
  const [text, setText] = useState(interests.profile?.text ?? "");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [own, setOwn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function suggest(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/interests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that. Try again.");
      setProfile(data.profile as Profile);
      setPicked((data.profile as Profile).niches.slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    completeOnboarding(profile, picked);
    // Watched niches join Unmet's daily research for accounts (best effort; the app works either way).
    const auth = await authHeaders();
    const headers = { "Content-Type": "application/json", ...auth };
    if (auth.Authorization)
      await Promise.all(picked.map((niche) => fetch("/api/watch", { method: "POST", headers, body: JSON.stringify({ niche }) }).catch(() => null)));
    router.replace(safeNext(next)); // never off-site, whatever the page was given
  }

  function skip() {
    completeOnboarding(null, []);
    router.replace(safeNext(next));
  }

  const niches = [...new Set([...(profile?.niches ?? []), ...picked])];

  return (
    <div className={s.onboarding}>
      <header className={s.obTop}>
        <Logo />
        <button type="button" className={s.skip} onClick={skip}>
          Skip
        </button>
      </header>

      <main key={profile ? "niches" : "who"} className={`${s.obMain} rise`}>
        <p className={s.step}>Step {profile ? 2 : 1} of 2</p>

        {!profile ? (
          <>
            <h1 className={s.obTitle}>Who do you want to build for?</h1>
            <p className={s.obSub}>Something you know well works best. Unmet turns it into niches to watch.</p>
            <form className={s.obForm} onSubmit={suggest}>
              <label htmlFor="ob-text" className="sr-only">
                Who you want to build for
              </label>
              <input
                id="ob-text"
                className={s.obInput}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. “I'm a nurse”"
                maxLength={300}
                autoFocus
              />
              <button type="submit" className="pill pill-dark" disabled={busy || text.trim().length < 2}>
                {busy ? <LoaderCircle size={17} className={s.spin} aria-hidden="true" /> : null}
                Continue
                {!busy && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </form>
            <div className={s.examples}>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => setText(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className={s.obTitle}>Pick the niches to follow.</h1>
            <p className={s.obSub}>They rank first in your feed, and Unmet researches them every few days.</p>
            <div className={s.nicheGrid}>
              {niches.map((n) => {
                const on = picked.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    className={`${s.nicheChip} ${on ? s.nicheOn : ""}`}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== n) : [...p, n]))}
                  >
                    {on && <Check size={15} aria-hidden="true" />}
                    {n}
                  </button>
                );
              })}
            </div>
            <form
              className={s.ownForm}
              onSubmit={(e) => {
                e.preventDefault();
                const n = own.trim().toLowerCase();
                if (n.length >= 3 && !picked.includes(n)) setPicked((p) => [...p, n]);
                setOwn("");
              }}
            >
              <input className={s.obInput} value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Add your own niche" maxLength={60} />
              <button type="submit" className={s.addBtn} aria-label="Add niche" disabled={own.trim().length < 3}>
                <Plus size={18} aria-hidden="true" />
              </button>
            </form>
            <div className={s.obActions}>
              <button type="button" className={s.back} onClick={() => setProfile(null)}>
                Back
              </button>
              <button type="button" className="pill pill-dark" onClick={finish} disabled={busy}>
                {busy && <LoaderCircle size={17} className={s.spin} aria-hidden="true" />}
                Start exploring
              </button>
            </div>
          </>
        )}
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
