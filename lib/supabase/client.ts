"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// anon key, row-level security keeps people to their own rows. session is in cookies so /auth/callback can finish logins. @supabase/ssr is ~260KB so it loads on first use

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const authConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: Promise<SupabaseClient> | null = null;

export function supabase() {
  return (client ??= import("@supabase/ssr").then(
    ({ createBrowserClient }) => createBrowserClient(SUPABASE_URL!, SUPABASE_KEY!),
    (err) => {
      client = null; // a failed download (offline, new deploy) can retry
      throw err;
    },
  ));
}
