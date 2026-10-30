"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    router.replace(interests.onboarded ? next : `/welcome/start?next=${encodeURIComponent(next)}`);
  }, [ready, interests.onboarded, next, router]);

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
        <h1 className={s.title}>Find problems worth solving</h1>
        <div className={s.card}>
          <SignInForm id="welcome" failed={failed} bare />
          <div className={s.or}>or</div>
          <button type="button" className={s.guestBtn} onClick={() => continueAsGuest()}>
            Continue as guest
          </button>
          <p className={s.guestNote}>Everything works; research runs on Low (quick) only.</p>
        </div>
      </main>
    </div>
  );
}
