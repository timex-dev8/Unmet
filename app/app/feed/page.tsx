import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import FilterChips from "@/components/app/FilterChips";
import SwipeFeed from "@/components/feed/SwipeFeed";
import { getAllCards, getCards, isCategory, searchCards, type FeedFilter } from "@/lib/cards";
import { researchHref } from "@/lib/links";
import { readProducts } from "@/lib/products";
import { SOURCE_KINDS, type Product, type ProductSource } from "@/lib/types";
import styles from "@/components/feed/feed.module.css";

export const metadata: Metadata = { title: "Feed" };

// must stay dynamic, reads the url
export const instant = false;

const PRODUCT_SOURCES: readonly ProductSource[] = ["TrustMRR", "Product Hunt", "App Store", "GitHub"];

// round robin over sources so one high scoring source doesnt fill the feed
function mixSources(products: Product[]) {
  // each source starts further down daily so top products arent always the same
  const day = Math.floor(Date.now() / 86400_000);
  const sizes = new Map<string, number>();
  for (const product of products) sizes.set(product.source, (sizes.get(product.source) ?? 0) + 1);
  const turn = new Map<string, number>();
  const ranked = products.map((product) => {
    const i = turn.get(product.source) ?? 0;
    turn.set(product.source, i + 1);
    const size = sizes.get(product.source)!;
    return { product, offset: (i - ((day * 3) % size) + size) % size };
  });
  const rotated = ranked.sort((a, b) => a.offset - b.offset).map((entry) => entry.product);
  // last few days lead (max 8) so each run changes the feed
  const isNew = (product: Product) => product.addedAt && Date.now() - Date.parse(product.addedAt) < 3 * 86400_000;
  const fresh = rotated.filter(isNew).slice(0, 8);
  return [...fresh, ...rotated.filter((product) => !fresh.includes(product))];
}

function matchesProduct(product: Product, words: string[]) {
  const text = `${product.name} ${product.oneLine} ${product.forWho} ${product.category} ${product.why}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

export default async function FeedPage({ searchParams }: PageProps<"/app/feed">) {
  const { topic, source: sourceParam, q: queryParam } = await searchParams;
  // mixSources reads the clock
  await connection();
  const query = typeof queryParam === "string" ? queryParam.trim().slice(0, 120) : "";
  const filter: FeedFilter = topic === "Trending" ? "Trending" : isCategory(topic) ? topic : undefined;
  const [{ cards: listed }, all, listedProducts, found] = await Promise.all([
    getCards({ filter }),
    getAllCards(),
    readProducts(filter === "Trending" ? { rising: true } : filter ? { category: filter } : {}),
    query ? searchCards(query) : Promise.resolve([]),
  ]);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const page = query ? found : listed;
  const products = query ? listedProducts.filter((product) => matchesProduct(product, words)) : listedProducts;
  const kinds = SOURCE_KINDS.filter((kind) => kind !== "hn" && all.some((card) => card.sources.some((x) => x.kind === kind)));
  const productSources = PRODUCT_SOURCES.filter((productSource) => products.some((product) => product.source === productSource));
  const source = [...kinds, ...productSources].find((candidate) => candidate === sourceParam);
  const fromProducts = productSources.find((productSource) => productSource === source);
  const cards = fromProducts ? [] : source ? page.filter((card) => card.sources.some((x) => x.kind === source)) : page;
  const shownProducts = fromProducts ? products.filter((product) => product.source === fromProducts) : source ? [] : products;

  return (
    <main className={styles.screen}>
      <h1 className="sr-only">Idea feed{filter ? `: ${filter}` : ""}</h1>
      <FilterChips active={filter} source={source} kinds={[...kinds, ...productSources]} />
      {query && !cards.length && !shownProducts.length ? (
        <div className={`${styles.end} ${styles.endInline}`}>
          <h2 className={styles.endTitle}>Nothing in the feed for “{query}”.</h2>
          <p className={styles.endText}>Try another word, or research it to look for real complaints.</p>
          <Link href="/app/feed" className="pill pill-dark">
            Clear search
          </Link>
          <Link href={researchHref(query)} className={styles.endLink}>
            Research it
          </Link>
        </div>
      ) : source && !cards.length && !shownProducts.length ? (
        <div className={`${styles.end} ${styles.endInline}`}>
          <h2 className={styles.endTitle}>Nothing from this source yet.</h2>
          <p className={styles.endText}>No ideas here have evidence from it. Try another source.</p>
          <Link href={filter ? `/app/feed?topic=${encodeURIComponent(filter)}` : "/app/feed"} className="pill pill-dark">
            Clear source filter
          </Link>
        </div>
      ) : (
        /* key resets the feed position when a filter changes */
        <SwipeFeed key={`${filter ?? "all"}|${source ?? ""}|${query}`} cards={cards} products={mixSources(shownProducts).slice(0, 15)} />
      )}
    </main>
  );
}
