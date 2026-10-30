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

export async function signOut() {
  await supabase().auth.signOut();
}
