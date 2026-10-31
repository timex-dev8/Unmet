import "server-only";
import { createHash } from "node:crypto";
import { db, supabaseConfigured } from "@/lib/supabase/server";

// Per-visitor limits for the AI routes. Counted in Postgres by take_rate_slot (supabase/schema.sql),
// which checks and records in one locked step, so parallel requests can't all slip through and
// the limit holds across servers. Before that SQL is run, or without Supabase, each server counts
// in memory as before.

/** The visitor's IP. Vercel sets x-forwarded-for itself (the first entry is the client). */
export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "local";
}

/** Visitors are stored as a hash of their IP, never the IP itself. */
export const visitorId = (ip: string) => createHash("sha256").update(`unmet:${ip}`).digest("hex").slice(0, 32);

/** The database doesn't have this function yet (the SQL in supabase/schema.sql hasn't been run). */
export function missingFunction(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

const HOUR = 3600_000;
const memHits = new Map<string, number[]>();
let rpcMissingUntil = 0; // checked again every 10 minutes, so running the SQL takes effect without a deploy

function takeInMemory(bucket: string, perHour: number) {
  const now = Date.now();
  const recent = (memHits.get(bucket) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= perHour) return false;
  memHits.set(bucket, [...recent, now]);
  return true;
}

/** True when this visitor may make another `route` call this hour (and counts it). */
export async function takeHourlySlot(request: Request, route: string, perHour: number): Promise<boolean> {
  const bucket = `${route}:${visitorId(clientIp(request))}`;
  if (supabaseConfigured() && Date.now() > rpcMissingUntil) {
    const { data, error } = await db().rpc("take_rate_slot", { bucket, hour_limit: perHour });
    if (!error) return data === true;
    if (missingFunction(error)) {
      rpcMissingUntil = Date.now() + 10 * 60_000;
      console.warn("[rate-limit] take_rate_slot isn't in the database yet (run supabase/schema.sql); counting in memory");
    } else console.warn("[rate-limit] check failed, counting in memory:", error.message);
  }
  return takeInMemory(bucket, perHour);
}
