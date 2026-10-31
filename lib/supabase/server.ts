import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase with the service-role key: bypasses row-level security, so it must never
// reach the browser. The Vercel ↔ Supabase integration sets these variables (newer projects
// may name the key SUPABASE_SECRET_KEY). Without them the app falls back to in-memory storage.

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

export function supabaseConfigured() {
  return Boolean(url() && key());
}

let client: SupabaseClient | null = null;

export function db() {
  return (client ??= createClient(url()!, key()!, { auth: { persistSession: false, autoRefreshToken: false } }));
}

/** Accounts exist (the browser has Supabase auth), so deeper features must check who's asking. */
export function accountsConfigured() {
  return Boolean(url() && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
}

/** The account behind "Authorization: Bearer <access token>", verified with Supabase; null otherwise. */
export async function requestUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !supabaseConfigured()) return null;
  try {
    const { data, error } = await db().auth.getUser(token);
    return error ? null : data.user;
  } catch {
    return null; // auth unreachable: treat as signed out, so nothing opens by accident
  }
}
