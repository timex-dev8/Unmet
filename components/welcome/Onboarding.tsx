"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle, Plus } from "lucide-react";
import Logo from "@/components/Logo";
import { authHeaders } from "@/lib/auth";
import { completeOnboarding, useInterests, type Profile } from "@/lib/interests";
import { researchHref, safeNext } from "@/lib/links";
import styles from "./welcome.module.css";

const EXAMPLES = ["I'm a nurse", "small coffee shops", "indie game devs", "freelance designers"];

function afterOnboarding(next: string, niche?: string) {
  const destination = safeNext(next);
  if (destination !== "/app") return destination;
  return niche ? researchHref(niche, "low") : "/app/research";
}

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
      const response = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Couldn't read that. Try again.");
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
    setError("");
    try {
      completeOnboarding(profile, picked);
      // best effort, app works either way
      const auth = await authHeaders();
      const headers = { "Content-Type": "application/json", ...auth };
      if (auth.Authorization)
        await Promise.all(picked.map((niche) => fetch("/api/watch", { method: "POST", headers, body: JSON.stringify({ niche }) }).catch(() => null)));
      router.replace(afterOnboarding(next, picked[0])); // never off site
    } catch {
      setError("Couldn't finish setting up. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    completeOnboarding(null, []);
    router.replace(afterOnboarding(next));
  }

  const finishLabel = safeNext(next) === "/app" && picked[0] ? `Research ${picked[0]}` : "Start exploring";
  const niches = [...new Set([...(profile?.niches ?? []), ...picked])];

  return (
    <div className={styles.onboarding}>
      <header className={styles.obTop}>
        <Logo />
        <button type="button" className={styles.skip} onClick={skip}>
          Skip
        </button>
      </header>

      <main key={profile ? "niches" : "who"} className={`${styles.obMain} rise`}>
        <p className={styles.step}>Step {profile ? 2 : 1} of 2</p>

        {!profile ? (
          <>
            <h1 className={styles.obTitle}>Who do you want to build for?</h1>
            <p className={styles.obSub}>Something you know well works best. Unmet turns it into niches to watch.</p>
            <form className={styles.obForm} onSubmit={suggest}>
              <label htmlFor="ob-text" className="sr-only">
                Who you want to build for
              </label>
              <input
                id="ob-text"
                className={styles.obInput}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. “I'm a nurse”"
                maxLength={300}
                autoFocus
              />
              <button type="submit" className="pill pill-dark" disabled={busy || text.trim().length < 2}>
                {busy ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : null}
                Continue
                {!busy && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </form>
            <div className={styles.examples}>
              {EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => setText(example)}>
                  {example}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.obTitle}>Pick the niches to follow.</h1>
            <p className={styles.obSub}>They rank first in your feed, and Unmet researches them every few days.</p>
            <div className={styles.nicheGrid}>
              {niches.map((nicheName) => {
                const isPicked = picked.includes(nicheName);
                return (
                  <button
                    key={nicheName}
                    type="button"
                    aria-pressed={isPicked}
                    className={`${styles.nicheChip} ${isPicked ? `glossy ${styles.nicheOn}` : styles.nicheOff}`}
                    onClick={() => setPicked((current) => (isPicked ? current.filter((name) => name !== nicheName) : [...current, nicheName]))}
                  >
                    {isPicked && <Check size={15} aria-hidden="true" />}
                    {nicheName}
                  </button>
                );
              })}
            </div>
            <form
              className={styles.ownForm}
              onSubmit={(e) => {
                e.preventDefault();
                const ownNiche = own.trim().toLowerCase();
                if (ownNiche.length >= 3 && !picked.includes(ownNiche)) setPicked((current) => [...current, ownNiche]);
                setOwn("");
              }}
            >
              <input
                className={styles.obInput}
                value={own}
                onChange={(e) => setOwn(e.target.value)}
                placeholder="Add your own niche"
                maxLength={60}
              />
              <button type="submit" className={styles.addBtn} aria-label="Add niche" disabled={own.trim().length < 3}>
                <Plus size={18} aria-hidden="true" />
              </button>
            </form>
            <div className={styles.obActions}>
              <button type="button" className={styles.back} onClick={() => setProfile(null)}>
                Back
              </button>
              <button type="button" className={`pill pill-dark ${styles.finishBtn}`} onClick={finish} disabled={busy}>
                {busy && <LoaderCircle size={17} className="spin" aria-hidden="true" />}
                <span className={styles.finishText}>{finishLabel}</span>
              </button>
            </div>
          </>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
