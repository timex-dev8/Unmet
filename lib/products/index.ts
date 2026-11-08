import "server-only";
import { createHash } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod/v4";
import { generateJson } from "@/lib/llm";
import { fence } from "@/lib/research/extract";
import { PRODUCT_SYSTEM } from "@/lib/research/prompts";
import { db, supabaseConfigured } from "@/lib/supabase/server";
import { slugify } from "@/lib/text";
import { CATEGORIES, type Product, type ProductSource } from "@/lib/types";
import { hostOf } from "@/lib/url";
import { appStoreGrossing } from "./sources/appstore";
import { githubRising } from "./sources/github";
import { productHunt } from "./sources/producthunt";
import { radarConfigured, trafficRank } from "./sources/radar";
import { trustMrr } from "./sources/trustmrr";
import type { RawProduct } from "./sources/types";

const STALE_DAYS = 21;
const MAX_NEW = 60; // one ai call per 20
const RADAR_AT_ONCE = 5;
const CardsSchema = z.object({
  products: z.array(
    z.object({
      index: z.number().int().min(0).max(99),
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

const shortHash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 8);

const STORE_PAGE = /(^|\.)(apps\.apple\.com|github\.com|producthunt\.com)$/i;
function isStorePage(url: string) {
  try {
    return STORE_PAGE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// identity is the page; path counts since one company can host several products
export function keyOf(p: { url: string; name: string }) {
  try {
    const u = new URL(p.url);
    return `${hostOf(p.url)}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return `name:${slugify(p.name) || shortHash(p.name)}`;
  }
}

type Merged = RawProduct & { keys: string[] }; // every page it was found under

// same web page, or same name when one side is a store page. two sites with one name are two companies
function merge(all: RawProduct[]) {
  const byKey = new Map<string, Merged>();
  const byName = new Map<string, Merged>();
  const out: Merged[] = [];
  for (const p of all) {
    const k = keyOf(p);
    const name = slugify(p.name);
    let old = byKey.get(k);
    const sameName = name ? byName.get(name) : undefined;
    if (!old && sameName && (isStorePage(p.url) || isStorePage(sameName.url))) old = sameName;
    if (!old) {
      const fresh: Merged = { ...p, proof: [...p.proof], keys: [k] };
      out.push(fresh);
      byKey.set(k, fresh);
      if (name && !sameName) byName.set(name, fresh);
      continue;
    }
    if (!old.keys.includes(k)) old.keys.push(k);
    byKey.set(k, old);
    // prefer the product's own site over a store page, pool the proof
    if (isStorePage(old.url) && !isStorePage(p.url)) old.url = p.url;
    // one proof per kind and site, keep the first (strongest)
    old.proof.push(...p.proof.filter((x) => !old.proof.some((y) => y.kind === x.kind && y.site === x.site)));
    old.weight += p.weight;
    old.rising ||= p.rising;
    old.hint ??= p.hint;
    old.image ??= p.image;
  }
  return out.sort((a, b) => b.weight - a.weight);
}

// round-robin so one big source (app store) can't crowd out the rest
function roundRobin(list: RawProduct[], n: number) {
  const bySource = new Map<ProductSource, RawProduct[]>();
  for (const p of list) bySource.set(p.source, [...(bySource.get(p.source) ?? []), p]);
  const queues = [...bySource.values()];
  const out: RawProduct[] = [];
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift()!);
  return out;
}

async function collectProducts() {
  const names = ["TrustMRR", "App Store", "GitHub", "Product Hunt"];
  const results = await Promise.allSettled([trustMrr(), appStoreGrossing(), githubRising(), productHunt()]);
  const counts: Record<string, number> = {};
  const all = results.flatMap((r, i) => {
    if (r.status === "rejected") warn(names[i], r.reason);
    const list = r.status === "fulfilled" ? r.value : [];
    counts[names[i]] = list.length;
    return list;
  });
  return { products: merge(all), counts };
}

async function writeCards(raw: RawProduct[], deadline = Infinity, signal?: AbortSignal): Promise<Product[]> {
  const now = new Date().toISOString();
  const out: Product[] = [];
  for (let start = 0; start < raw.length; start += 20) {
    if (Date.now() > deadline || signal?.aborted) {
      warn("write cards", `stopped at ${start} of ${raw.length}: out of time`);
      break;
    }
    const batch = raw.slice(start, start + 20);
    const res = await generateJson(CardsSchema, {
      system: PRODUCT_SYSTEM,
      timeoutMs: 60_000,
      light: true,
      signal,
      prompt: batch
        .map(
          (p, i) =>
            `<product index="${i}">${fence(`${p.name}${p.hint ? ` (${p.hint})` : ""}\nDescription: ${p.description.replace(/\s+/g, " ").slice(0, 500)}\nProof: ${p.proof.map((x) => x.label).join("; ")}`)}</product>`,
        )
        .join("\n\n"),
    }).catch((err) => {
      warn("write cards", err);
      return { products: [] };
    });
    for (const c of res.products) {
      const p = batch[c.index];
      if (!p || !c.keep) continue;
      const key = keyOf(p);
      out.push({
        kind: "product",
        // names in other scripts slugify to nothing, a hash of the key keeps the slug unique
        slug: slugify(c.name || p.name) || `product-${shortHash(key)}`,
        key,
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
        addedAt: now,
      });
    }
  }
  return out;
}

export async function runProducts({ deadline = Infinity, signal }: { deadline?: number; signal?: AbortSignal } = {}) {
  if (!supabaseConfigured()) throw new Error("Supabase isn't connected.");
  const { products: raw, counts } = await collectProducts();
  const scoreOf = new Map(raw.map((p) => [keyOf(p), p.weight]));

  // stored products by key (old rows: from stored url) and which key owns each slug, so a new one never overwrites another
  const { data: known, error } = await db().from("feed_products").select("slug, product");
  if (error) throw error;
  const byKey = new Map<string, Product>();
  const slugOwner = new Map<string, string>();
  for (const r of known) {
    const p = r.product as Product;
    const key = p.key ?? keyOf(p);
    byKey.set(key, p);
    slugOwner.set(r.slug as string, key);
  }

  const now = new Date().toISOString();
  const refreshed: Product[] = [];
  const fresh: RawProduct[] = [];
  for (const p of raw) {
    const old = p.keys.map((k) => byKey.get(k)).find(Boolean);
    if (old) {
      const key = keyOf(p);
      slugOwner.set(old.slug, key);
      refreshed.push({
        ...old,
        key,
        url: p.url,
        proof: p.proof.slice(0, 4),
        rising: p.rising,
        image: p.image ?? old.image,
        // keep the first source, old rows without one take the fresh one
        source: old.source ?? p.source,
        updatedAt: now,
      });
    } else fresh.push(p);
  }
  const written = await writeCards(roundRobin(fresh, MAX_NEW), deadline, signal);
  for (const p of written) {
    const owner = slugOwner.get(p.slug);
    if (owner && owner !== p.key) p.slug = `${p.slug.slice(0, 50)}-${shortHash(p.key!)}`;
    slugOwner.set(p.slug, p.key!);
  }

  const all = [...refreshed, ...written];
  if (radarConfigured()) {
    const todo = all.filter((p) => !p.proof.some((x) => x.kind === "traffic"));
    await Promise.all(
      Array.from({ length: Math.min(RADAR_AT_ONCE, todo.length) }, async () => {
        while (todo.length && !signal?.aborted) {
          const p = todo.shift()!;
          const t = await trafficRank(p.url).catch(() => null);
          if (t) p.proof = [...p.proof.slice(0, 3), t];
        }
      }),
    );
  }

  const rows = [...new Map(all.map((p) => [p.slug, p])).values()].map((p) => ({
    slug: p.slug,
    product: p,
    category: p.category,
    score: Math.round(scoreOf.get(p.key ?? keyOf(p)) ?? 0),
    updated_at: now,
  }));
  if (rows.length) {
    const { error: upsertError } = await db().from("feed_products").upsert(rows);
    if (upsertError) throw upsertError;
    // only after a run that saved something, all sources failing means nothing is stale
    const cutoff = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
    await db().from("feed_products").delete().lt("updated_at", cutoff);
  }
  await db().from("feed_products").delete().eq("product->>source", "Hacker News");
  return {
    counts,
    merged: raw.length,
    refreshed: refreshed.length,
    added: written.length,
    dropped: Math.min(fresh.length, MAX_NEW) - written.length,
  };
}

const SOURCES: ProductSource[] = ["TrustMRR", "Product Hunt", "App Store", "Hacker News", "GitHub"];

function sourceFromSite(site?: string): ProductSource {
  if (site === "Show HN") return "Hacker News";
  return SOURCES.find((s) => s === site) ?? "Hacker News";
}

export async function readProducts(opts: { category?: string; rising?: boolean } = {}): Promise<Product[]> {
  "use cache";
  cacheLife("days");
  cacheTag("feed");
  if (!supabaseConfigured()) return [];
  let q = db().from("feed_products").select("product").order("score", { ascending: false });
  if (opts.category) q = q.eq("category", opts.category);
  const { data, error } = await q.limit(80);
  if (error) {
    warn("read", error);
    return [];
  }
  const list = data
    .map((r) => {
      const p = r.product as Product;
      return { ...p, source: p.source ?? sourceFromSite(p.proof[0]?.site) };
    })
    .filter((p) => p.source !== "Hacker News" && !/^anonymous/i.test(p.name));
  // proof like "upvotes this week" goes stale, show only what recent runs confirmed unless that is nothing
  const cutoff = Date.now() - 3 * 86400_000;
  const current = list.filter((p) => Date.parse(p.updatedAt) >= cutoff);
  const shown = current.length ? current : list;
  return opts.rising ? shown.filter((p) => p.rising) : shown;
}
