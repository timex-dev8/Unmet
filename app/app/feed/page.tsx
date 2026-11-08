import type { Metadata } from "next";
import Link from "next/link";
import FilterChips from "@/components/app/FilterChips";
import SwipeFeed from "@/components/feed/SwipeFeed";
import { getAllCards, getCards, isCategory, searchCards, type FeedFilter } from "@/lib/cards";
import { researchHref } from "@/lib/links";
import { readProducts } from "@/lib/products";
import { SOURCE_KINDS, type Product, type ProductSource } from "@/lib/types";
import s from "@/components/feed/feed.module.css";

export const metadata: Metadata = { title: "Feed" };

// must stay dynamic, reads the url
export const instant = false;

const PRODUCT_SOURCES: readonly ProductSource[] = ["TrustMRR", "Product Hunt", "App Store", "GitHub"];

// round robin over sources so one high scoring source doesnt fill the feed
function mixSources(products: Product[]) {
  // each source starts further down daily so top products arent always the same
  const day = Math.floor(Date.now() / 86400_000);
  const sizes = new Map<string, number>();
  for (const p of products) sizes.set(p.source, (sizes.get(p.source) ?? 0) + 1);
  const turn = new Map<string, number>();
  const ranked = products.map((p) => {
    const i = turn.get(p.source) ?? 0;
    turn.set(p.source, i + 1);
    const size = sizes.get(p.source)!;
    return { p, n: (i - ((day * 3) % size) + size) % size };
  });
  const rotated = ranked.sort((a, b) => a.n - b.n).map((x) => x.p);
  // last few days lead (max 8) so each run changes the feed
  const isNew = (p: Product) => p.addedAt && Date.now() - Date.parse(p.addedAt) < 3 * 86400_000;
  const fresh = rotated.filter(isNew).slice(0, 8);
  return [...fresh, ...rotated.filter((p) => !fresh.includes(p))];
}

function matchesProduct(p: Product, words: string[]) {
  const text = `${p.name} ${p.oneLine} ${p.forWho} ${p.category} ${p.why}`.toLowerCase();
  return words.every((w) => text.includes(w));
}

export default async function FeedPage({ searchParams }: PageProps<"/app/feed">) {
  const { topic, source: sourceParam, q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 120) : "";
  const filter: FeedFilter = topic === "Trending" ? "Trending" : isCategory(topic) ? topic : undefined;
  const [{ cards: listed }, all, listedProducts, found] = await Promise.all([
    getCards({ filter }),
    getAllCards(),
    readProducts(filter === "Trending" ? { rising: true } : filter ? { category: filter } : {}),
    query ? searchCards(query) : Promise.resolve([]),
  ]);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const page = query ? found : listed;
  const products = query ? listedProducts.filter((p) => matchesProduct(p, words)) : listedProducts;
  const kinds = SOURCE_KINDS.filter((k) => k !== "hn" && all.some((c) => c.sources.some((x) => x.kind === k)));
  const productSources = PRODUCT_SOURCES.filter((k) => products.some((p) => p.source === k));
  const source = [...kinds, ...productSources].find((k) => k === sourceParam);
  const fromProducts = productSources.find((k) => k === source);
  const cards = fromProducts ? [] : source ? page.filter((c) => c.sources.some((x) => x.kind === source)) : page;
  const shownProducts = fromProducts ? products.filter((p) => p.source === fromProducts) : source ? [] : products;

  return (
    <main className={s.screen}>
      <h1 className="sr-only">Idea feed{filter ? `: ${filter}` : ""}</h1>
      <FilterChips active={filter} source={source} kinds={[...kinds, ...productSources]} />
      {query && !cards.length && !shownProducts.length ? (
        <div className={s.end} style={{ position: "static", flex: 1, margin: "0 12px 12px" }}>
          <h2 className={s.endTitle}>Nothing in the feed for “{query}”.</h2>
          <p className={s.endText}>Try another word, or research it to look for real complaints.</p>
          <Link href="/app/feed" className="pill pill-dark">
            Clear search
          </Link>
          <Link href={researchHref(query)} className={s.endLink}>
            Research it
          </Link>
        </div>
      ) : source && !cards.length && !shownProducts.length ? (
        <div className={s.end} style={{ position: "static", flex: 1, margin: "0 12px 12px" }}>
          <h2 className={s.endTitle}>Nothing from this source yet.</h2>
          <p className={s.endText}>No ideas here have evidence from it. Try another source.</p>
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
