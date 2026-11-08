"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { authConfigured, supabase } from "./supabase/client";
import { flushSync } from "./sync";

let current: User | null | undefined = undefined;
const listeners = new Set<() => void>();
let started = false;

function start() {
  if (started || !authConfigured) return;
  started = true;
  supabase().then(
    (client) =>
      client.auth.onAuthStateChange((_event, session) => {
        current = session?.user ?? null;
        if (current) setGuest(false); // guest data merges into the account
        listeners.forEach((l) => l());
      }),
    (err) => {
      started = false; // retry on the next subscriber
      console.warn("[auth] couldn't load sign-in:", err instanceof Error ? err.message : err);
    },
  );
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

// guest flag lives in localStorage, mirrored to the unmet_guest cookie so proxy.ts lets guests into /app

const GUEST_KEY = "unmet:guest";
const GUEST_COOKIE = "unmet_guest"; // read by proxy.ts
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
    // storage blocked, guest mode lasts this visit
  }
  // signing in clears it too, the session cookie takes over
  document.cookie = on
    ? `${GUEST_COOKIE}=1; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`
    : `${GUEST_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  guestListeners.forEach((l) => l());
}

export const continueAsGuest = () => setGuest(true);

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

export function useLowOnly() {
  const user = useUser();
  const guest = useGuest();
  return authConfigured && !user && guest !== false;
}

export async function authHeaders(): Promise<Record<string, string>> {
  if (!authConfigured) return {};
  const token = await accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function callbackUrl() {
  const next = window.location.pathname + window.location.search;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithGoogle() {
  const { error } = await (await supabase()).auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
  if (error) throw error;
}

export async function sendEmailLink(email: string) {
  const { error } = await (await supabase()).auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl() } });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await (await supabase()).auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error.message));
}

// true when supabase wants the email confirmed first
export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await (await supabase()).auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl() } });
  if (error) throw new Error(friendly(error.message));
  // an existing confirmed email comes back without identities
  if (data.user && data.user.identities?.length === 0) throw new Error("That email already has an account. Sign in instead.");
  return !data.session;
}

export async function sendPasswordReset(email: string) {
  const back = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/app?reset=1")}`;
  const { error } = await (await supabase()).auth.resetPasswordForEmail(email, { redirectTo: back });
  if (error) throw new Error(friendly(error.message));
}

export async function updatePassword(password: string) {
  const { error } = await (await supabase()).auth.updateUser({ password });
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

async function accessToken() {
  const { data } = await (await supabase()).auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOut() {
  // upload last changes while the session still works. local scope, global would sign out other devices before their changes upload
  await flushSync();
  await (await supabase()).auth.signOut({ scope: "local" });
}
