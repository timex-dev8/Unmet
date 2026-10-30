"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import { SignInForm } from "@/components/shell/AccountButton";
import AccountSync from "@/components/shell/AccountSync";
import { continueAsGuest, useGuest, useUser } from "@/lib/auth";
import { useInterests } from "@/lib/interests";
import { useSyncStatus } from "@/lib/sync";
import s from "./welcome.module.css";

// The way into Unmet: sign in (password or email link), or continue as a guest. Guests can use
// everything except deeper research. Once someone is in, they go to onboarding the first time and
// straight to where they were heading after that.
export default function Welcome({ next, failed, quotes }: { next: string; failed: boolean; quotes: string[] }) {
  const router = useRouter();
  const user = useUser();
  const guest = useGuest();
  const sync = useSyncStatus();
  const { interests } = useInterests();
  // A signed-in account's interests arrive with the first sync; decide once that's done.
  const ready = guest === true || (user && (sync === "synced" || sync === "error"));

  useEffect(() => {
    if (!ready) return;
    router.replace(interests.onboarded ? next : `/welcome/start?next=${encodeURIComponent(next)}`);
  }, [ready, interests.onboarded, next, router]);

  return (
    <div className={s.page}>
      <AccountSync />
      <aside className={s.story}>
        <Link href="/" className={s.brand} aria-label="Unmet home page">
          <Logo tone="light" />
        </Link>
        <div>
          <h1 className={s.storyTitle}>Find problems worth solving, and ideas to build from them.</h1>
          {quotes.length > 0 && (
            <ul className={s.quotes} aria-label="Real complaints Unmet found">
              {quotes.map((q) => (
                <li key={q}>“{q}”</li>
              ))}
            </ul>
          )}
        </div>
        <p className={s.storyNote}>Every problem links to the real posts behind it.</p>
      </aside>

      <main className={s.panel}>
        <div className={s.card}>
          <SignInForm id="welcome" failed={failed} />
        </div>
        <div className={s.guest}>
          <button
            type="button"
            className={s.guestBtn}
            onClick={() => {
              continueAsGuest();
            }}
          >
            Continue as guest
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          <p>Everything works; research runs on Low (quick) only. Saved on this device.</p>
        </div>
      </main>
    </div>
  );
}
