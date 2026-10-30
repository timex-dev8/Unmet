"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Check, CircleUserRound, LoaderCircle, LogOut, Mail, X } from "lucide-react";
import Highlight from "@/components/motion/Highlight";
import {
  sendEmailLink,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
  useUser,
} from "@/lib/auth";
import { authConfigured } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync";
import s from "./account.module.css";

// Google sign-in is built but hidden until it's switched on in Supabase (Authentication → Providers → Google).
// Flip to true then.
const GOOGLE_ENABLED = false;

const STATUS_LABEL = { off: "", syncing: "Syncing…", synced: "Synced", error: "Sync paused, will retry" } as const;

// Did this page load come back from a failed Google or email-link sign-in (?signin=failed)?
// Read once, so removing the parameter from the address bar doesn't hide the message.
let failedAtLoad: boolean | undefined;
const signinFailed = () => (failedAtLoad ??= new URL(window.location.href).searchParams.get("signin") === "failed");
// Same for arriving from a "reset your password" email (?reset=1).
let resetAtLoad: boolean | undefined;
const resetLink = () => (resetAtLoad ??= new URL(window.location.href).searchParams.get("reset") === "1");
const noop = () => () => {};

// Sign in / account. `variant="side"` is the sidebar row; "icon" is the phone top bar button.
export default function AccountButton({ variant }: { variant: "side" | "icon" }) {
  const user = useUser();
  const status = useSyncStatus();
  const ref = useRef<HTMLDialogElement>(null);
  const failed = useSyncExternalStore(noop, signinFailed, () => false);
  const reset = useSyncExternalStore(noop, resetLink, () => false);
  const [resetDone, setResetDone] = useState(false);

  // Coming back from a failed sign-in or a password-reset email: open the sheet, tidy the address bar.
  useEffect(() => {
    if (variant !== "side" || !(failed || reset)) return; // one sheet is enough
    const url = new URL(window.location.href);
    url.searchParams.delete("signin");
    url.searchParams.delete("reset");
    window.history.replaceState(null, "", url);
    ref.current?.showModal();
  }, [variant, failed, reset]);

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
        {user && reset && !resetDone && variant === "side" ? (
          <NewPassword
            id={`acct-${variant}`}
            onDone={() => {
              setResetDone(true);
              ref.current?.close();
            }}
          />
        ) : user ? (
          <SignedIn id={`acct-${variant}`} email={name} initial={initial} status={STATUS_LABEL[status]} />
        ) : (
          <SignInForm id={`acct-${variant}`} failed={failed} />
        )}
      </dialog>
    </>
  );
}

type Mode = "password" | "link";
type Sent = { title: string; text: string } | null;

function SignInForm({ id, failed }: { id: string; failed: boolean }) {
  const [mode, setMode] = useState<Mode>("password");
  const [creating, setCreating] = useState(false); // password mode: sign in vs create account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"" | "google" | "submit" | "reset">("");
  const [sent, setSent] = useState<Sent>(null);
  const [error, setError] = useState(failed ? "That link didn't work. Links expire, and must be opened on this device. Try again." : "");

  async function run(kind: "google" | "submit" | "reset", task: () => Promise<void>) {
    setError("");
    setBusy(kind);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy("");
    }
  }

  const address = email.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run("submit", async () => {
      if (mode === "link") {
        await sendEmailLink(address);
        setSent({ title: "Check your inbox", text: `We sent a sign-in link to ${address}. Open it on this device to finish signing in.` });
      } else if (creating) {
        const mustConfirm = await signUpWithPassword(address, password);
        if (mustConfirm)
          setSent({ title: "Confirm your email", text: `We sent a link to ${address}. Open it on this device, and your account is ready.` });
      } else {
        await signInWithPassword(address, password); // the sheet switches to "signed in" by itself
      }
    });
  };
  const forgot = () => {
    if (!address) return setError("Type your email above first, then tap “Forgot password?” again.");
    void run("reset", async () => {
      await sendPasswordReset(address);
      setSent({ title: "Check your inbox", text: `We sent a link to ${address}. Open it on this device to choose a new password.` });
    });
  };

  if (sent) {
    return (
      <div className={s.body}>
        <span className={s.badge}>
          <Mail size={22} aria-hidden="true" />
        </span>
        <h2 id={id} className={s.title}>
          {sent.title}
        </h2>
        <p className={s.sub}>{sent.text}</p>
        <button type="button" className={s.textBtn} onClick={() => setSent(null)}>
          Back
        </button>
      </div>
    );
  }

  const title = mode === "password" && creating ? "Create your account" : "Sign in to Unmet";
  const action = mode === "link" ? "Email me a link" : creating ? "Create account" : "Sign in";

  return (
    <div className={s.body}>
      <h2 id={id} className={s.title}>
        {title}
      </h2>
      <p className={s.sub}>Your research, board and saved ideas follow you to every device.</p>

      {GOOGLE_ENABLED && (
        <>
          <button type="button" className={s.google} onClick={() => void run("google", signInWithGoogle)} disabled={!!busy}>
            {busy === "google" ? <LoaderCircle size={18} className={s.spin} aria-hidden="true" /> : <GoogleLogo />}
            Continue with Google
          </button>
          <div className={s.or}>
            <span>or</span>
          </div>
        </>
      )}

      <div className={s.modes} role="tablist" aria-label="How to sign in">
        {(["password", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`${s.mode} ${mode === m ? s.modeOn : ""}`}
            onClick={() => {
              setMode(m);
              setError("");
            }}
          >
            {mode === m && <Highlight id={`auth-mode-${id}`} className={s.modePill} />}
            {m === "password" ? "Password" : "Email link"}
          </button>
        ))}
      </div>

      <form className={s.form} onSubmit={submit}>
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
        {mode === "password" && (
          <>
            <label htmlFor={`${id}-password`} className="sr-only">
              Password
            </label>
            <input
              id={`${id}-password`}
              type="password"
              required
              minLength={creating ? 8 : undefined}
              autoComplete={creating ? "new-password" : "current-password"}
              placeholder={creating ? "Password (8+ characters)" : "Password"}
              className={s.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}
        <button type="submit" className="pill pill-dark" disabled={!!busy || !address || (mode === "password" && !password)}>
          {busy === "submit" && <LoaderCircle size={17} className={s.spin} aria-hidden="true" />}
          {action}
        </button>
      </form>

      {mode === "password" && (
        <div className={s.links}>
          {!creating && (
            <button type="button" className={s.textBtn} onClick={forgot} disabled={!!busy}>
              {busy === "reset" ? "Sending…" : "Forgot password?"}
            </button>
          )}
          <button
            type="button"
            className={s.textBtn}
            onClick={() => {
              setCreating((c) => !c);
              setError("");
            }}
          >
            {creating ? "Have an account? Sign in" : "New here? Create an account"}
          </button>
        </div>
      )}

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <p className={s.fine}>Without an account, Unmet keeps everything in this browser only.</p>
    </div>
  );
}

/** Opened from the "reset your password" email (lands on /app?reset=1, already signed in). */
function NewPassword({ id, onDone }: { id: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className={s.body}>
        <span className={s.badge}>
          <Check size={22} aria-hidden="true" />
        </span>
        <h2 id={id} className={s.title}>
          Password updated
        </h2>
        <p className={s.sub}>Use it next time you sign in, on any device.</p>
        <button type="button" className="pill pill-dark" onClick={onDone}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className={s.body}>
      <h2 id={id} className={s.title}>
        Set a new password
      </h2>
      <p className={s.sub}>At least 8 characters.</p>
      <form
        className={s.form}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            await updatePassword(password);
            setDone(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save it. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor={`${id}-new`} className="sr-only">
          New password
        </label>
        <input
          id={`${id}-new`}
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="New password"
          className={s.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="pill pill-dark" disabled={busy || password.length < 8}>
          {busy && <LoaderCircle size={17} className={s.spin} aria-hidden="true" />}
          Save password
        </button>
      </form>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
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
