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
import styles from "./welcome.module.css";

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
    const destination = safeNext(next); // recheck, router.replace("/\\evil.com") would leave the site
    router.replace(interests.onboarded || !user ? destination : `/welcome/start?next=${encodeURIComponent(destination)}`);
  }, [ready, guest, user, interests.onboarded, next, router]);

  return (
    <div className={styles.page}>
      <AccountSync />
      <div className={styles.clouds} aria-hidden="true" />
      <header className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="Unmet home page">
          <Logo tone="light" />
        </Link>
        <Link href="/" className={styles.home}>
          ← Back to home
        </Link>
      </header>

      <main className={styles.center}>
        <h1 className={styles.title}>Find out what people actually want</h1>
        <div className={styles.card}>
          <button type="button" className={`pill pill-dark ${styles.guestBtn}`} onClick={() => continueAsGuest()}>
            Continue as guest
          </button>
          <p className={styles.guestNote}>No account needed.</p>
          <div className={styles.or}>or</div>
          <SignInForm id="welcome" failed={failed} bare />
        </div>
      </main>
    </div>
  );
}
