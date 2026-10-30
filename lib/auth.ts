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

export async function signOut() {
  await supabase().auth.signOut();
}
