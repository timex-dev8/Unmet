"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { authConfigured, supabase } from "./supabase/client";

// Who is signed in, as a tiny external store fed by Supabase's auth events.
// undefined = still checking, null = signed out.

let current: User | null | undefined = undefined;
const listeners = new Set<() => void>();
let started = false;

function start() {
  if (started || !authConfigured) return;
  started = true;
  supabase().auth.onAuthStateChange((_event, session) => {
    current = session?.user ?? null;
    if (current) setGuest(false); // signing in ends guest mode (the guest's data merges into the account)
    listeners.forEach((l) => l());
  });
}

function subscribe(l: () => void) {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useUser() {
  return useSyncExternalStore(
    subscribe,
    () => (authConfigured ? current : null),
    () => undefined,
  );
}

// ---------------------------------------------------------------------------
// Guest mode: chosen on /welcome, remembered in this browser. Guests can use everything except
// deeper research (Medium and High), which app/api/research refuses without an account.

const GUEST_KEY = "unmet:guest";
const guestListeners = new Set<() => void>();
const readGuest = () => {
  try {
    return localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
};
function setGuest(on: boolean) {
  try {
    if (on) localStorage.setItem(GUEST_KEY, "1");
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    // storage blocked: guest mode lasts for this visit
  }
  guestListeners.forEach((l) => l());
}

export const continueAsGuest = () => setGuest(true);

/** undefined while the page is still hydrating. */
export function useGuest() {
  return useSyncExternalStore(
    (l) => {
      guestListeners.add(l);
      return () => void guestListeners.delete(l);
    },
    readGuest,
    () => undefined,
  );
}

/** Guests (no account) research on Low only; Medium and High need a free account. */
export function useLowOnly() {
  const user = useUser();
  const guest = useGuest();
  return authConfigured && !user && guest !== false;
}

/** Headers for our own API routes: the access token tells the server this is a full account. */
export async function authHeaders(): Promise<Record<string, string>> {
  if (!authConfigured) return {};
  const token = await accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Where to come back to after Google or the email link. */
function callbackUrl() {
  const next = window.location.pathname + window.location.search;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithGoogle() {
  const { error } = await supabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
  if (error) throw error;
}

export async function sendEmailLink(email: string) {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl() } });
  if (error) throw error;
}

/** Password sign-in. Friendly messages for the common failures. */
export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error.message));
}

/** New account with a password. Returns true when Supabase wants the email confirmed first. */
export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase().auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl() } });
  if (error) throw new Error(friendly(error.message));
  // An existing confirmed email comes back without identities (Supabase hides whether it exists).
  if (data.user && data.user.identities?.length === 0) throw new Error("That email already has an account. Sign in instead.");
  return !data.session;
}

/** Emails a link that opens Unmet with "set a new password". */
export async function sendPasswordReset(email: string) {
  const back = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/app?reset=1")}`;
  const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: back });
  if (error) throw new Error(friendly(error.message));
}

export async function updatePassword(password: string) {
  const { error } = await supabase().auth.updateUser({ password });
  if (error) throw new Error(friendly(error.message));
}

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link we sent you.";
  if (/already registered/i.test(message)) return "That email already has an account. Sign in instead.";
  if (/rate|security purposes/i.test(message)) return "Too many tries just now. Wait a minute and try again.";
  if (/same.*password|different from the old/i.test(message)) return "Choose a password you haven't used here before.";
  return message;
}

/** The signed-in person's access token, for our own API routes that act on their behalf. */
export async function accessToken() {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOut() {
  await supabase().auth.signOut();
}
