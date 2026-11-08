import "server-only";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { db, supabaseConfigured } from "@/lib/supabase/server";

// counted in postgres by take_rate_slot (supabase/schema.sql) so parallel requests can't slip through. falls back to memory per server

// vercel sets x-forwarded-for, first entry is the client
export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "local";
}

// ipv6 shares one bucket per /64, ipv4-mapped uses the ipv4
function ipBucket(ip: string) {
  const raw = ip
    .trim()
    .replace(/^\[|\]$/g, "")
    .split("%")[0]
    .toLowerCase();
  if (isIP(raw) === 4) return raw;
  if (isIP(raw) !== 6) return raw;
  let text = raw;
  const dotted = text.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(2).map(Number);
    text = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = text.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  const g = groups.map((x) => parseInt(x || "0", 16));
  if (g.length !== 8 || g.some((n) => Number.isNaN(n))) return raw;
  if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  return `${g
    .slice(0, 4)
    .map((n) => n.toString(16))
    .join(":")}::/64`;
}

export const visitorId = (ip: string) =>
  createHash("sha256")
    .update(`unmet:${ipBucket(ip)}`)
    .digest("hex")
    .slice(0, 32);

export function missingFunction(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

const HOUR = 3600_000;
const memHits = new Map<string, number[]>();
let rpcMissingUntil = 0; // retried every 10 minutes so running the sql works without a deploy

function takeInMemory(bucket: string, perHour: number) {
  const now = Date.now();
  const recent = (memHits.get(bucket) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= perHour) return false;
  memHits.set(bucket, [...recent, now]);
  return true;
}

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

const dayMem = new Map<string, { day: number; n: number }>();
let dailyMissingUntil = 0;

export async function takeDailyPool(route: string, perDay: number): Promise<boolean> {
  const bucket = `pool:${route}`;
  if (supabaseConfigured() && Date.now() > dailyMissingUntil) {
    const { data, error } = await db().rpc("take_daily_slot", { bucket, day_limit: perDay });
    if (!error) return data === true;
    if (missingFunction(error)) {
      dailyMissingUntil = Date.now() + 10 * 60_000;
      console.warn("[rate-limit] take_daily_slot isn't in the database yet (run supabase/schema.sql); counting in memory");
    } else console.warn("[rate-limit] daily check failed, counting in memory:", error.message);
  }
  const day = Math.floor(Date.now() / 86400_000);
  const cur = dayMem.get(bucket);
  const n = cur && cur.day === day ? cur.n : 0;
  if (n >= perDay) return false;
  dayMem.set(bucket, { day, n: n + 1 });
  return true;
}
