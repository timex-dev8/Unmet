import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod/v4";
import { generateJson } from "@/lib/llm";
import { PRODUCT_SYSTEM } from "@/lib/research/prompts";
import { db, supabaseConfigured } from "@/lib/supabase/server";
import { CATEGORIES, type Product, type ProductSource } from "@/lib/types";
import { appStoreGrossing } from "./sources/appstore";
import { githubRising } from "./sources/github";
import { productHunt } from "./sources/producthunt";
import { radarConfigured, trafficRank } from "./sources/radar";
import { showHn } from "./sources/showhn";
import { trustMrr } from "./sources/trustmrr";
import type { RawProduct } from "./sources/types";

// "What's working": real products with proof (verified revenue, top-grossing charts, upvotes,
// stars, traffic), mixed into the feed for inspiration. A daily job collects them from official
// APIs and feeds, merges repeats, has the AI write each card in its own words, and stores them.

const STALE_DAYS = 21;
const MAX_NEW = 60; // new cards written per run (one AI call per 20)
const CardsSchema = z.object({
  products: z.array(
    z.object({
      index: z.number().int(),
      keep: z.boolean(),
      name: z.string(),
      oneLine: z.string(),
      forWho: z.string(),
      category: z.enum(CATEGORIES),
      why: z.string(),
    }),
  ),
});

const warn = (what: string, err: unknown) => console.warn(`[products] ${what}:`, err instanceof Error ? err.message : err);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

// The same product from two sources: same web page, or same name. The path counts too, since one
// company can host several products (example.com/apps/a, example.com/apps/b).
function keyOf(p: RawProduct) {
  try {
    const u = new URL(p.url);
    if (!/apps\.apple\.com|github\.com|producthunt\.com/.test(u.hostname))
      return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {}
  return slugify(p.name);
}

function merge(all: RawProduct[]) {
  const byKey = new Map<string, RawProduct>();
  const byName = new Map<string, string>();
  for (const p of all) {
    const k = byName.get(slugify(p.name)) ?? keyOf(p);
    const old = byKey.get(k);
    if (!old) {
      byKey.set(k, { ...p, proof: [...p.proof] });
      byName.set(slugify(p.name), k);
      continue;
    }
    // Prefer the product's own website over a store page, and pool the proof
    if (/apps\.apple\.com|github\.com|producthunt\.com/.test(old.url) && !/apps\.apple\.com|github\.com|producthunt\.com/.test(p.url))
      old.url = p.url;
    // One piece of proof per kind and site: keep the first (strongest) one
    old.proof.push(...p.proof.filter((x) => !old.proof.some((y) => y.kind === x.kind && y.site === x.site)));
    old.weight += p.weight;
    old.rising ||= p.rising;
    old.hint ??= p.hint;
    old.image ??= p.image;
  }
  return [...byKey.values()].sort((a, b) => b.weight - a.weight);
}

/** Takes new products from each source in turn, so one big source (the App Store) can't crowd out the rest. */
export function roundRobin(list: RawProduct[], n: number) {
  const bySource = new Map<ProductSource, RawProduct[]>();
  for (const p of list) bySource.set(p.source, [...(bySource.get(p.source) ?? []), p]);
  const queues = [...bySource.values()];
  const out: RawProduct[] = [];
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift()!);
  return out;
}

/** Collects from every source; a source that fails or has no key just adds nothing. */
export async function collectProducts() {
  const names = ["TrustMRR", "App Store", "Show HN", "GitHub", "Product Hunt"];
  const results = await Promise.allSettled([trustMrr(), appStoreGrossing(), showHn(), githubRising(), productHunt()]);
  const counts: Record<string, number> = {};
  const all = results.flatMap((r, i) => {
    if (r.status === "rejected") warn(names[i], r.reason);
    const list = r.status === "fulfilled" ? r.value : [];
    counts[names[i]] = list.length;
    return list;
  });
  return { products: merge(all), counts };
}

/** Writes cards for new products (in the AI's own words) and drops the ones it flags. */
export async function writeCards(raw: RawProduct[]): Promise<Product[]> {
  const now = new Date().toISOString();
  const out: Product[] = [];
  for (let start = 0; start < raw.length; start += 20) {
    const batch = raw.slice(start, start + 20);
    const res = await generateJson(CardsSchema, {
      system: PRODUCT_SYSTEM,
      timeoutMs: 60_000,
      prompt: batch
        .map(
          (p, i) =>
            `${i} | ${p.name}${p.hint ? ` (${p.hint})` : ""}\nDescription: ${p.description.replace(/\s+/g, " ").slice(0, 500)}\nProof: ${p.proof.map((x) => x.label).join("; ")}`,
        )
        .join("\n\n"),
    }).catch((err) => {
      warn("write cards", err);
      return { products: [] };
    });
    for (const c of res.products) {
      const p = batch[c.index];
      if (!p || !c.keep) continue;
      out.push({
        kind: "product",
        slug: slugify(c.name || p.name),
        name: c.name || p.name,
        url: p.url,
        oneLine: c.oneLine,
        forWho: c.forWho,
        category: c.category,
        why: c.why,
        proof: p.proof.slice(0, 4),
        rising: p.rising,
        image: p.image,
        source: p.source,
        updatedAt: now,
      });
    }
  }
  return out;
}

/**
 * The daily product run: collect, merge, refresh proof on products we already have, write cards
 * for new ones, add traffic rank when a Radar token is set, then drop products not seen in 3 weeks.
 */
export async function runProducts() {
  if (!supabaseConfigured()) throw new Error("Supabase isn't connected.");
  const { products: raw, counts } = await collectProducts();
  const scoreOf = new Map(raw.map((p) => [slugify(p.name), p.weight]));

  const { data: known, error } = await db().from("feed_products").select("slug, product");
  if (error) throw error;
  const byName = new Map(known.map((r) => [slugify((r.product as Product).name), r.product as Product]));

  const now = new Date().toISOString();
  const refreshed: Product[] = [];
  const fresh: RawProduct[] = [];
  for (const p of raw) {
    const old = byName.get(slugify(p.name));
    if (old)
      refreshed.push({
        ...old,
        proof: p.proof.slice(0, 4),
        rising: p.rising,
        image: p.image ?? old.image,
        // Keep the source a card was first found on; older rows saved before `source` existed take the fresh one
        source: old.source ?? p.source,
        updatedAt: now,
      });
    else fresh.push(p);
  }
  const written = await writeCards(roundRobin(fresh, MAX_NEW));

  const all = [...refreshed, ...written];
  if (radarConfigured()) {
    await Promise.allSettled(
      all.map(async (p) => {
        if (p.proof.some((x) => x.kind === "traffic")) return;
        const t = await trafficRank(p.url);
        if (t) p.proof = [...p.proof.slice(0, 3), t];
      }),
    );
  }

  const rows = [...new Map(all.map((p) => [p.slug, p])).values()].map((p) => ({
    slug: p.slug,
    product: p,
    category: p.category,
    score: Math.round(scoreOf.get(slugify(p.name)) ?? 0),
    updated_at: now,
  }));
  if (rows.length) {
    const { error: upsertError } = await db().from("feed_products").upsert(rows);
    if (upsertError) throw upsertError;
  }
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
  await db().from("feed_products").delete().lt("updated_at", cutoff);
  return {
    counts,
    merged: raw.length,
    refreshed: refreshed.length,
    added: written.length,
    dropped: Math.min(fresh.length, MAX_NEW) - written.length,
  };
}

const SOURCES: ProductSource[] = ["TrustMRR", "Product Hunt", "App Store", "Hacker News", "GitHub"];

/** The source for a stored product that has none, from the site of its first proof. */
function sourceFromSite(site?: string): ProductSource {
  if (site === "Show HN") return "Hacker News";
  return SOURCES.find((s) => s === site) ?? "Hacker News";
}

/** Products for the feed, strongest proof first. Cached like the feed (tag "feed"). */
export async function readProducts(opts: { category?: string; rising?: boolean } = {}): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("feed");
  if (!supabaseConfigured()) return [];
  let q = db().from("feed_products").select("product").order("score", { ascending: false });
  if (opts.category) q = q.eq("category", opts.category);
  const { data, error } = await q.limit(80);
  if (error) {
    warn("read", error);
    return [];
  }
  // Rows saved before `source` existed get it from their first piece of proof
  const list = data.map((r) => {
    const p = r.product as Product;
    return { ...p, source: p.source ?? sourceFromSite(p.proof[0]?.site) };
  });
  return opts.rising ? list.filter((p) => p.rising) : list;
}
