"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { SignInForm } from "@/components/shell/AccountButton";
import AccountSync from "@/components/shell/AccountSync";
import { continueAsGuest, useGuest, useUser } from "@/lib/auth";
import { useInterests } from "@/lib/interests";
import { safeNext } from "@/lib/links";
import { useSyncStatus } from "@/lib/sync";
import s from "./welcome.module.css";

// The way into Unmet: sign in (password or email link), or continue as a guest. Guests can use
// everything except deeper research. Once someone is in, they go to onboarding the first time and
// straight to where they were heading after that.
export default function Welcome({ next, failed }: { next: string; failed: boolean }) {
  const router = useRouter();
  const user = useUser();
  const guest = useGuest();
  const sync = useSyncStatus();
  const { interests } = useInterests();
  // A signed-in account's interests arrive with the first sync; decide once that's done.
  const ready = guest === true || (user && (sync === "synced" || sync === "error"));

  useEffect(() => {
    if (!ready) return;
    // Guests from before the guest cookie have only the localStorage flag; set the cookie too, or
    // proxy.ts would send them straight back here.
    if (guest === true) continueAsGuest();
    const to = safeNext(next); // checked again here: router.replace("/\\evil.com") would leave the site
    router.replace(interests.onboarded ? to : `/welcome/start?next=${encodeURIComponent(to)}`);
  }, [ready, guest, interests.onboarded, next, router]);

  return (
    <div className={s.page}>
      <AccountSync />
      <div className={s.clouds} aria-hidden="true" />
      <header className={s.top}>
        <Link href="/" className={s.brand} aria-label="Unmet home page">
          <Logo tone="light" />
        </Link>
        <Link href="/" className={s.home}>
          ← Back to home
        </Link>
      </header>

      <main className={s.center}>
        <h1 className={s.title}>Find out what people actually want</h1>
        <div className={s.card}>
          <button type="button" className={`pill pill-dark ${s.guestBtn}`} onClick={() => continueAsGuest()}>
            Continue as guest
          </button>
          <p className={s.guestNote}>No account needed.</p>
          <div className={s.or}>or</div>
          <SignInForm id="welcome" failed={failed} bare />
        </div>
      </main>
    </div>
  );
}
