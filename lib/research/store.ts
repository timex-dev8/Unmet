import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import type { ResearchEvent } from "@/lib/research-types";
import { missingFunction } from "@/lib/rate-limit";
import { db, supabaseConfigured } from "@/lib/supabase/server";
import type { Card } from "@/lib/types";

// result cache, rate-limit hits and shared ideas. supabase if connected, memory otherwise
// db errors log and fall back to no cache, except the limit check: unreadable means deeper research is refused (takeResearchSlot)

type Result = Extract<ResearchEvent, { type: "result" }>;
const CACHE_MS = 6 * 3600 * 1000;
const HOUR = 3600 * 1000;

const memCache = new Map<string, { at: number; value: Result }>();
const memHits: { visitor: string; isUser: boolean; cost: number; at: number }[] = [];

const warn = (what: string, err: unknown) => console.warn(`[store] ${what}:`, err instanceof Error ? err.message : err);

export async function getCached(key: string, maxAgeMs = CACHE_MS): Promise<Result | null> {
  if (!supabaseConfigured()) {
    const hit = memCache.get(key);
    return hit && Date.now() - hit.at < maxAgeMs ? hit.value : null;
  }
  const { data, error } = await db()
    .from("research_cache")
    .select("result")
    .eq("key", key)
    .gte("created_at", new Date(Date.now() - maxAgeMs).toISOString())
    .maybeSingle();
  if (error) warn("cache read", error);
  return (data?.result as Result | undefined) ?? null;
}

export async function setCached(key: string, value: Result) {
  if (!supabaseConfigured()) return void memCache.set(key, { at: Date.now(), value });
  const { error } = await db().from("research_cache").upsert({ key, result: value, created_at: new Date().toISOString() });
  if (error) warn("cache write", error);
}

export type SlotRequest = {
  visitor: string; // hashed ip for guests, "u:<id>" for accounts
  isUser: boolean;
  cost: number;
  hourLimit: number;
  dayLimit: number;
  globalDayLimit: number; // everyone of the same kind together, 0 = none
};

let rpcMissingUntil = 0; // retried every 10 minutes so running the sql works without a deploy

// true = go, false = over a limit, null = couldn't check (deeper research stays closed). take_research_slot checks and records in one locked step
export async function takeResearchSlot(r: SlotRequest): Promise<boolean | null> {
  if (!supabaseConfigured()) return takeMemorySlot(r);
  if (Date.now() > rpcMissingUntil) {
    const { data, error } = await db().rpc("take_research_slot", {
      visitor: r.visitor,
      is_user: r.isUser,
      hour_limit: r.hourLimit,
      day_limit: r.dayLimit,
      global_day_limit: r.globalDayLimit,
      cost: r.cost,
    });
    if (!error) return data === true;
    if (!missingFunction(error)) {
      warn("limit check", error);
      return null;
    }
    rpcMissingUntil = Date.now() + 10 * 60_000;
    console.warn("[store] take_research_slot isn't in the database yet (run supabase/schema.sql); using the old check");
  }
  return legacySlot(r);
}

async function legacySlot(r: SlotRequest): Promise<boolean | null> {
  const hourAgo = Date.now() - HOUR;
  const dayStart = new Date().setUTCHours(0, 0, 0, 0);
  const { data, error } = await db()
    .from("research_hits")
    .select("visitor, cost, at")
    .gte("at", new Date(Math.min(hourAgo, dayStart)).toISOString());
  if (error) {
    warn("usage read", error);
    return null;
  }
  let hour = 0;
  let day = 0;
  let everyone = 0;
  for (const h of data) {
    const at = Date.parse(h.at);
    if (h.visitor === r.visitor && at > hourAgo) hour += h.cost;
    if (h.visitor === r.visitor && at >= dayStart) day += h.cost;
    if (at >= dayStart) everyone += h.cost;
  }
  if (hour + r.cost > r.hourLimit || day + r.cost > r.dayLimit) return false;
  if (r.globalDayLimit && everyone + r.cost > r.globalDayLimit) return false;
  const { error: writeError } = await db().from("research_hits").insert({ visitor: r.visitor, cost: r.cost });
  if (writeError) warn("usage write", writeError);
  return true;
}

// this server's own count, used without supabase and for Low when the db can't be checked
export function takeMemorySlot(r: SlotRequest) {
  const now = Date.now();
  const hourAgo = now - HOUR;
  const dayStart = new Date().setUTCHours(0, 0, 0, 0);
  while (memHits.length && memHits[0].at < Math.min(hourAgo, dayStart)) memHits.shift();
  const sum = (f: (h: (typeof memHits)[number]) => boolean) => memHits.filter(f).reduce((a, h) => a + h.cost, 0);
  const hour = sum((h) => h.visitor === r.visitor && h.at > hourAgo);
  const day = sum((h) => h.visitor === r.visitor && h.at >= dayStart);
  const everyone = sum((h) => h.isUser === r.isUser && h.at >= dayStart);
  if (hour + r.cost > r.hourLimit || day + r.cost > r.dayLimit) return false;
  if (r.globalDayLimit && everyone + r.cost > r.globalDayLimit) return false;
  memHits.push({ visitor: r.visitor, isUser: r.isUser, cost: r.cost, at: now });
  return true;
}

export const publicCard = (card: Card): Card => ({ ...card, query: undefined });

export async function saveIdeas(cards: Card[]) {
  if (!supabaseConfigured() || !cards.length) return;
  const { error } = await db()
    .from("ideas")
    .upsert(cards.map((card) => ({ slug: card.slug, card: publicCard(card) })));
  if (error) warn("ideas write", error);
  else
    for (const card of cards) {
      try {
        revalidateTag(`idea:${card.slug}`, { expire: 0 }); // a cached "not found" must not outlive the save
      } catch {}
    }
}

// cached for days (tags "feed", "idea:<slug>")
export async function getIdea(slug: string): Promise<Card | null> {
  "use cache";
  cacheLife("days");
  cacheTag("feed", `idea:${slug}`);
  if (!supabaseConfigured()) return null;
  const { data, error } = await db().from("ideas").select("card").eq("slug", slug).maybeSingle();
  if (error) warn("idea read", error);
  return (data?.card as Card | undefined) ?? null;
}
