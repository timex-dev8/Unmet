import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// service-role key bypasses row-level security, never send to the browser. vercel integration sets the vars (newer projects may name the key SUPABASE_SECRET_KEY). without them falls back to memory

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

export function supabaseConfigured() {
  return Boolean(supabaseUrl() && serviceKey());
}

let client: SupabaseClient | null = null;

export function db() {
  return (client ??= createClient(supabaseUrl()!, serviceKey()!, { auth: { persistSession: false, autoRefreshToken: false } }));
}

export function accountsConfigured() {
  return Boolean(supabaseUrl() && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
}

export async function requestUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !supabaseConfigured()) return null;
  try {
    const { data, error } = await db().auth.getUser(token);
    return error ? null : data.user;
  } catch {
    return null; // auth unreachable counts as signed out so nothing opens by accident
  }
}
