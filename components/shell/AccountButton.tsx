"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { CircleUserRound, LoaderCircle, LogOut, Mail, X } from "lucide-react";
import { sendEmailLink, signInWithGoogle, signOut, useUser } from "@/lib/auth";
import { authConfigured } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync";
import s from "./account.module.css";

const STATUS_LABEL = { off: "", syncing: "Syncing…", synced: "Synced", error: "Sync paused, will retry" } as const;

// Did this page load come back from a failed Google or email-link sign-in (?signin=failed)?
// Read once, so removing the parameter from the address bar doesn't hide the message.
let failedAtLoad: boolean | undefined;
const signinFailed = () => (failedAtLoad ??= new URL(window.location.href).searchParams.get("signin") === "failed");
const noop = () => () => {};

// Sign in / account. `variant="side"` is the sidebar row; "icon" is the phone top bar button.
export default function AccountButton({ variant }: { variant: "side" | "icon" }) {
  const user = useUser();
  const status = useSyncStatus();
  const ref = useRef<HTMLDialogElement>(null);
  const failed = useSyncExternalStore(noop, signinFailed, () => false);

  // Coming back from a failed sign-in: reopen the sheet with a note, and tidy the address bar.
  useEffect(() => {
    if (variant !== "side" || !failed) return; // one sheet is enough
    const url = new URL(window.location.href);
    url.searchParams.delete("signin");
    window.history.replaceState(null, "", url);
    ref.current?.showModal();
  }, [variant, failed]);

  if (!authConfigured) return null;

  const name = user?.email ?? "";
  const initial = name ? name[0].toUpperCase() : "";
  const open = () => ref.current?.showModal();

  return (
    <>
      {variant === "side" ? (
        <button type="button" className={s.side} onClick={open}>
          {user ? <span className={s.avatar}>{initial}</span> : <CircleUserRound size={20} aria-hidden="true" />}
          <span className={s.sideText}>
            <span className={s.sideName}>{user ? name : "Sign in"}</span>
            <span className={s.sideSub}>{user ? STATUS_LABEL[status] : "Sync across your devices"}</span>
          </span>
        </button>
      ) : (
        <button type="button" className={s.icon} onClick={open} aria-label={user ? `Account: ${name}` : "Sign in"}>
          {user ? <span className={s.avatar}>{initial}</span> : <CircleUserRound size={22} aria-hidden="true" />}
        </button>
      )}

      <dialog
        ref={ref}
        className={s.dialog}
        aria-labelledby={`acct-${variant}`}
        onClick={(e) => {
          if (e.target === ref.current) ref.current.close(); // tap outside closes
        }}
      >
        <button type="button" className={s.close} onClick={() => ref.current?.close()} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        {user ? (
          <SignedIn id={`acct-${variant}`} email={name} initial={initial} status={STATUS_LABEL[status]} />
        ) : (
          <SignInForm id={`acct-${variant}`} failed={failed} />
        )}
      </dialog>
    </>
  );
}

function SignInForm({ id, failed }: { id: string; failed: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "google" | "sending" | "sent">("idle");
  const [error, setError] = useState(failed ? "That sign-in link didn't work. Links expire, and must be opened on this device. Try again." : "");

  async function google() {
    setError("");
    setState("google");
    try {
      await signInWithGoogle(); // leaves the page on success
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Google sign-in isn't available right now.");
    }
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    try {
      await sendEmailLink(email.trim());
      setState("sent");
    } catch (err) {
      setState("idle");
      const msg = err instanceof Error ? err.message : "";
      setError(
        /rate|security purposes/i.test(msg) ? "Too many emails just now. Wait a minute and try again." : msg || "Couldn't send the link. Try again.",
      );
    }
  }

  if (state === "sent") {
    return (
      <div className={s.body}>
        <span className={s.badge}>
          <Mail size={22} aria-hidden="true" />
        </span>
        <h2 id={id} className={s.title}>
          Check your inbox
        </h2>
        <p className={s.sub}>
          We sent a sign-in link to <strong>{email}</strong>. Open it on this device to finish signing in.
        </p>
        <button type="button" className={s.textBtn} onClick={() => setState("idle")}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className={s.body}>
      <h2 id={id} className={s.title}>
        Sign in to Unmet
      </h2>
      <p className={s.sub}>Keep your research, board and saved ideas on every device. Everything here comes with you.</p>

      <button type="button" className={s.google} onClick={google} disabled={state !== "idle"}>
        {state === "google" ? <LoaderCircle size={18} className={s.spin} aria-hidden="true" /> : <GoogleLogo />}
        Continue with Google
      </button>

      <div className={s.or}>
        <span>or</span>
      </div>

      <form className={s.form} onSubmit={sendLink}>
        <label htmlFor={`${id}-email`} className="sr-only">
          Email
        </label>
        <input
          id={`${id}-email`}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          className={s.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="pill pill-dark" disabled={state !== "idle" || !email.trim()}>
          {state === "sending" && <LoaderCircle size={17} className={s.spin} aria-hidden="true" />}
          Email me a link
        </button>
      </form>

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <p className={s.fine}>No password. Without an account, Unmet keeps everything in this browser only.</p>
    </div>
  );
}

function SignedIn({ id, email, initial, status }: { id: string; email: string; initial: string; status: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={s.body}>
      <span className={`${s.avatar} ${s.avatarBig}`}>{initial}</span>
      <h2 id={id} className={s.title}>
        {email}
      </h2>
      <p className={s.sub}>{status || "Signed in"} · your research, board, saved ideas and Mind follow you to every device.</p>
      <button
        type="button"
        className={s.signOut}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await signOut();
          setBusy(false);
        }}
      >
        <LogOut size={17} aria-hidden="true" />
        Sign out
      </button>
      <p className={s.fine}>Signing out clears this browser. Everything stays safe in your account.</p>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
