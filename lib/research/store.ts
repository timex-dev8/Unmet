import "server-only";
import { createHash } from "node:crypto";
import type { ResearchEvent } from "@/lib/research-types";
import { db, supabaseConfigured } from "@/lib/supabase/server";
import type { Card } from "@/lib/types";

// What research keeps between requests: the result cache, rate-limit hits and shared ideas.
// Supabase when it's connected (survives restarts, shared by every server); in memory otherwise.
// A database error never breaks a research: it logs and falls back to "no cache / not limited".

type Result = Extract<ResearchEvent, { type: "result" }>;
const CACHE_MS = 6 * 3600 * 1000;
const HOUR = 3600 * 1000;

const memCache = new Map<string, { at: number; value: Result }>();
const memHits: { visitor: string; cost: number; at: number }[] = [];

const warn = (what: string, err: unknown) => console.warn(`[store] ${what}:`, err instanceof Error ? err.message : err);

export async function getCached(key: string): Promise<Result | null> {
  if (!supabaseConfigured()) {
    const hit = memCache.get(key);
    return hit && Date.now() - hit.at < CACHE_MS ? hit.value : null;
  }
  const { data, error } = await db()
    .from("research_cache")
    .select("result")
    .eq("key", key)
    .gte("created_at", new Date(Date.now() - CACHE_MS).toISOString())
    .maybeSingle();
  if (error) warn("cache read", error);
  return (data?.result as Result | undefined) ?? null;
}

export async function setCached(key: string, value: Result) {
  if (!supabaseConfigured()) return void memCache.set(key, { at: Date.now(), value });
  const { error } = await db().from("research_cache").upsert({ key, result: value, created_at: new Date().toISOString() });
  if (error) warn("cache write", error);
}

/** Visitors are stored as a hash of their IP, never the IP itself. */
export const visitorId = (ip: string) => createHash("sha256").update(`unmet:${ip}`).digest("hex").slice(0, 32);

/** Research cost used by this visitor in the last hour, and by everyone today (UTC). */
export async function usage(visitor: string): Promise<{ hour: number; today: number }> {
  const hourAgo = Date.now() - HOUR;
  const dayStart = new Date().setUTCHours(0, 0, 0, 0);
  if (!supabaseConfigured()) {
    const sum = (f: (h: (typeof memHits)[number]) => boolean) => memHits.filter(f).reduce((a, h) => a + h.cost, 0);
    return { hour: sum((h) => h.visitor === visitor && h.at > hourAgo), today: sum((h) => h.at >= dayStart) };
  }
  const { data, error } = await db().from("research_hits").select("visitor, cost, at").gte("at", new Date(Math.min(hourAgo, dayStart)).toISOString());
  if (error) {
    warn("usage read", error);
    return { hour: 0, today: 0 };
  }
  let hour = 0;
  let today = 0;
  for (const h of data) {
    const at = Date.parse(h.at);
    if (h.visitor === visitor && at > hourAgo) hour += h.cost;
    if (at >= dayStart) today += h.cost;
  }
  return { hour, today };
}

export async function recordHit(visitor: string, cost: number) {
  if (!supabaseConfigured()) return void memHits.push({ visitor, cost, at: Date.now() });
  const { error } = await db().from("research_hits").insert({ visitor, cost });
  if (error) warn("usage write", error);
}

/** Saves research ideas so their share links open for anyone. */
export async function saveIdeas(cards: Card[]) {
  if (!supabaseConfigured() || !cards.length) return;
  const { error } = await db()
    .from("ideas")
    .upsert(cards.map((card) => ({ slug: card.slug, card })));
  if (error) warn("ideas write", error);
}

export async function getIdea(slug: string): Promise<Card | null> {
  if (!supabaseConfigured()) return null;
  const { data, error } = await db().from("ideas").select("card").eq("slug", slug).maybeSingle();
  if (error) warn("idea read", error);
  return (data?.card as Card | undefined) ?? null;
}
