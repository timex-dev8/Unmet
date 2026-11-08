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

export default function Welcome({ next, failed }: { next: string; failed: boolean }) {
  const router = useRouter();
  const user = useUser();
  const guest = useGuest();
  const sync = useSyncStatus();
  const { interests } = useInterests();
  const ready = guest === true || (user && (sync === "synced" || sync === "error"));

  useEffect(() => {
    if (!ready) return;
    // guests from before the guest cookie only have the localStorage flag, set the cookie or proxy.ts bounces them back
    if (guest === true) continueAsGuest();
    const to = safeNext(next); // recheck, router.replace("/\\evil.com") would leave the site
    router.replace(interests.onboarded || !user ? to : `/welcome/start?next=${encodeURIComponent(to)}`);
  }, [ready, guest, user, interests.onboarded, next, router]);

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
