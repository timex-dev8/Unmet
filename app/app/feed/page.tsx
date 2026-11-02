import type { Metadata } from "next";
import Link from "next/link";
import FilterChips from "@/components/app/FilterChips";
import SwipeFeed from "@/components/feed/SwipeFeed";
import { getAllCards, getCards, isCategory, type FeedFilter } from "@/lib/cards";
import { readProducts } from "@/lib/products";
import { SOURCE_KINDS, type ProductSource } from "@/lib/types";
import s from "@/components/feed/feed.module.css";

export const metadata: Metadata = { title: "Feed" };

// The filter comes from the URL; render the whole page on the server before sending it.
export const instant = false;

const PRODUCT_SOURCES: readonly ProductSource[] = ["TrustMRR", "Product Hunt", "App Store", "GitHub"];

export default async function FeedPage({ searchParams }: PageProps<"/app/feed">) {
  const { topic, source: sourceParam } = await searchParams;
  const filter: FeedFilter = topic === "Trending" ? "Trending" : isCategory(topic) ? topic : undefined;
  const [{ cards: page }, all, products] = await Promise.all([
    getCards({ filter }),
    getAllCards(),
    readProducts(filter === "Trending" ? { rising: true } : filter ? { category: filter } : {}),
  ]);
  const kinds = SOURCE_KINDS.filter((k) => k !== "hn" && all.some((c) => c.sources.some((x) => x.kind === k)));
  const productSources = PRODUCT_SOURCES.filter((k) => products.some((p) => p.source === k));
  const source = [...kinds, ...productSources].find((k) => k === sourceParam);
  // A product source shows only its products; an evidence source shows only the problems backed by it.
  const fromProducts = productSources.find((k) => k === source);
  const cards = fromProducts ? [] : source ? page.filter((c) => c.sources.some((x) => x.kind === source)) : page;
  const shownProducts = fromProducts ? products.filter((p) => p.source === fromProducts) : source ? [] : products;

  return (
    <main className={s.screen}>
      <h1 className="sr-only">Idea feed{filter ? `: ${filter}` : ""}</h1>
      <FilterChips active={filter} source={source} kinds={[...kinds, ...productSources]} />
      {source && !cards.length && !shownProducts.length ? (
        <div className={s.end} style={{ position: "static", flex: 1, margin: "0 12px 12px" }}>
          <h2 className={s.endTitle}>Nothing from this source yet.</h2>
          <p className={s.endText}>No ideas here have evidence from it. Try another source.</p>
          <Link href={filter ? `/app/feed?topic=${encodeURIComponent(filter)}` : "/app/feed"} className="pill pill-dark">
            Clear source filter
          </Link>
        </div>
      ) : (
        /* key resets the feed position when a filter changes */
        <SwipeFeed key={`${filter ?? "all"}|${source ?? ""}`} cards={cards} products={shownProducts.slice(0, 15)} />
      )}
    </main>
  );
}
