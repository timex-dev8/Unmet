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

const shortHash = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 8);

const STORE_PAGE = /(^|\.)(apps\.apple\.com|github\.com|producthunt\.com)$/i;
function isStorePage(url: string) {
  try {
    return STORE_PAGE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// identity is the page; path counts since one company can host several products
export function keyOf(product: { url: string; name: string }) {
  try {
    const parsedUrl = new URL(product.url);
    return `${hostOf(product.url)}${parsedUrl.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return `name:${slugify(product.name) || shortHash(product.name)}`;
  }
}

type Merged = RawProduct & { keys: string[] }; // every page it was found under

// same web page, or same name when one side is a store page. two sites with one name are two companies
function merge(all: RawProduct[]) {
  const byKey = new Map<string, Merged>();
  const byName = new Map<string, Merged>();
  const merged: Merged[] = [];
  for (const product of all) {
    const key = keyOf(product);
    const name = slugify(product.name);
    let existing = byKey.get(key);
    const sameName = name ? byName.get(name) : undefined;
    if (!existing && sameName && (isStorePage(product.url) || isStorePage(sameName.url))) existing = sameName;
    if (!existing) {
      const fresh: Merged = { ...product, proof: [...product.proof], keys: [key] };
      merged.push(fresh);
      byKey.set(key, fresh);
      if (name && !sameName) byName.set(name, fresh);
      continue;
    }
    if (!existing.keys.includes(key)) existing.keys.push(key);
    byKey.set(key, existing);
    // prefer the product's own site over a store page, pool the proof
    if (isStorePage(existing.url) && !isStorePage(product.url)) existing.url = product.url;
    // one proof per kind and site, keep the first (strongest)
    existing.proof.push(...product.proof.filter((proof) => !existing.proof.some((known) => known.kind === proof.kind && known.site === proof.site)));
    existing.weight += product.weight;
    existing.rising ||= product.rising;
    existing.hint ??= product.hint;
    existing.image ??= product.image;
  }
  return merged.sort((a, b) => b.weight - a.weight);
}

// round-robin so one big source (app store) can't crowd out the rest
function roundRobin(list: RawProduct[], limit: number) {
  const bySource = new Map<ProductSource, RawProduct[]>();
  for (const product of list) bySource.set(product.source, [...(bySource.get(product.source) ?? []), product]);
  const queues = [...bySource.values()];
  const picked: RawProduct[] = [];
  while (picked.length < limit && queues.some((queue) => queue.length))
    for (const queue of queues) if (queue.length && picked.length < limit) picked.push(queue.shift()!);
  return picked;
}

async function collectProducts() {
  const names = ["TrustMRR", "App Store", "GitHub", "Product Hunt"];
  const results = await Promise.allSettled([trustMrr(), appStoreGrossing(), githubRising(), productHunt()]);
  const counts: Record<string, number> = {};
  const all = results.flatMap((result, i) => {
    if (result.status === "rejected") warn(names[i], result.reason);
    const list = result.status === "fulfilled" ? result.value : [];
    counts[names[i]] = list.length;
    return list;
  });
  return { products: merge(all), counts };
}

async function writeCards(raw: RawProduct[], deadline = Infinity, signal?: AbortSignal): Promise<Product[]> {
  const now = new Date().toISOString();
  const written: Product[] = [];
  for (let start = 0; start < raw.length; start += 20) {
    if (Date.now() > deadline || signal?.aborted) {
      warn("write cards", `stopped at ${start} of ${raw.length}: out of time`);
      break;
    }
    const batch = raw.slice(start, start + 20);
    const response = await generateJson(CardsSchema, {
      system: PRODUCT_SYSTEM,
      timeoutMs: 60_000,
      light: true,
      signal,
      prompt: batch
        .map(
          (product, i) =>
            `<product index="${i}">${fence(`${product.name}${product.hint ? ` (${product.hint})` : ""}\nDescription: ${product.description.replace(/\s+/g, " ").slice(0, 500)}\nProof: ${product.proof.map((proof) => proof.label).join("; ")}`)}</product>`,
        )
        .join("\n\n"),
    }).catch((err) => {
      warn("write cards", err);
      return { products: [] };
    });
    for (const card of response.products) {
      const product = batch[card.index];
      if (!product || !card.keep) continue;
      const key = keyOf(product);
      written.push({
        kind: "product",
        // names in other scripts slugify to nothing, a hash of the key keeps the slug unique
        slug: slugify(card.name || product.name) || `product-${shortHash(key)}`,
        key,
        name: card.name || product.name,
        url: product.url,
        oneLine: card.oneLine,
        forWho: card.forWho,
        category: card.category,
        why: card.why,
        proof: product.proof.slice(0, 4),
        rising: product.rising,
        image: product.image,
        source: product.source,
        updatedAt: now,
        addedAt: now,
      });
    }
  }
  return written;
}

export async function runProducts({ deadline = Infinity, signal }: { deadline?: number; signal?: AbortSignal } = {}) {
  if (!supabaseConfigured()) throw new Error("Supabase isn't connected.");
  const { products: raw, counts } = await collectProducts();
  const scoreOf = new Map(raw.map((product) => [keyOf(product), product.weight]));

  // stored products by key (old rows: from stored url) and which key owns each slug, so a new one never overwrites another
  const { data: known, error } = await db().from("feed_products").select("slug, product");
  if (error) throw error;
  const byKey = new Map<string, Product>();
  const slugOwner = new Map<string, string>();
  for (const row of known) {
    const product = row.product as Product;
    const key = product.key ?? keyOf(product);
    byKey.set(key, product);
    slugOwner.set(row.slug as string, key);
  }

  const now = new Date().toISOString();
  const refreshed: Product[] = [];
  const fresh: RawProduct[] = [];
  for (const product of raw) {
    const stored = product.keys.map((productKey) => byKey.get(productKey)).find(Boolean);
    if (stored) {
      const key = keyOf(product);
      slugOwner.set(stored.slug, key);
      refreshed.push({
        ...stored,
        key,
        url: product.url,
        proof: product.proof.slice(0, 4),
        rising: product.rising,
        image: product.image ?? stored.image,
        // keep the first source, old rows without one take the fresh one
        source: stored.source ?? product.source,
        updatedAt: now,
      });
    } else fresh.push(product);
  }
  const written = await writeCards(roundRobin(fresh, MAX_NEW), deadline, signal);
  for (const product of written) {
    const owner = slugOwner.get(product.slug);
    if (owner && owner !== product.key) product.slug = `${product.slug.slice(0, 50)}-${shortHash(product.key!)}`;
    slugOwner.set(product.slug, product.key!);
  }

  const all = [...refreshed, ...written];
  if (radarConfigured()) {
    const todo = all.filter((product) => !product.proof.some((proof) => proof.kind === "traffic"));
    await Promise.all(
      Array.from({ length: Math.min(RADAR_AT_ONCE, todo.length) }, async () => {
        while (todo.length && !signal?.aborted) {
          const product = todo.shift()!;
          const traffic = await trafficRank(product.url).catch(() => null);
          if (traffic) product.proof = [...product.proof.slice(0, 3), traffic];
        }
      }),
    );
  }

  const rows = [...new Map(all.map((product) => [product.slug, product])).values()].map((product) => ({
    slug: product.slug,
    product,
    category: product.category,
    score: Math.round(scoreOf.get(product.key ?? keyOf(product)) ?? 0),
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
  return SOURCES.find((source) => source === site) ?? "Hacker News";
}

export async function readProducts(options: { category?: string; rising?: boolean } = {}): Promise<Product[]> {
  "use cache";
  cacheLife("days");
  cacheTag("feed");
  if (!supabaseConfigured()) return [];
  let query = db().from("feed_products").select("product").order("score", { ascending: false });
  if (options.category) query = query.eq("category", options.category);
  const { data, error } = await query.limit(80);
  if (error) {
    warn("read", error);
    return [];
  }
  const list = data
    .map((row) => {
      const product = row.product as Product;
      return { ...product, source: product.source ?? sourceFromSite(product.proof[0]?.site) };
    })
    .filter((product) => product.source !== "Hacker News" && !/^anonymous/i.test(product.name));
  // proof like "upvotes this week" goes stale, show only what recent runs confirmed unless that is nothing
  const cutoff = Date.now() - 3 * 86400_000;
  const current = list.filter((product) => Date.parse(product.updatedAt) >= cutoff);
  const shown = current.length ? current : list;
  return options.rising ? shown.filter((product) => product.rising) : shown;
}
