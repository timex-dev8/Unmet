"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase with the public anon key. Row-level security (supabase/schema.sql) is what
// keeps each person to their own rows. The session lives in cookies so /auth/callback can finish logins.
// @supabase/ssr is ~260KB, so it loads on first use instead of with every page.

// Written out in full so Next.js inlines them into the browser bundle.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const authConfigured = Boolean(URL && KEY);

let client: Promise<SupabaseClient> | null = null;

export function supabase() {
  return (client ??= import("@supabase/ssr").then(
    ({ createBrowserClient }) => createBrowserClient(URL!, KEY!),
    (err) => {
      client = null; // a failed download (offline, new deploy) can be retried
      throw err;
    },
  ));
}
