import type { Metadata } from "next";
import FilterChips from "@/components/app/FilterChips";
import SwipeFeed from "@/components/feed/SwipeFeed";
import { getCards, isCategory, type FeedFilter } from "@/lib/cards";
import { readProducts } from "@/lib/products";
import s from "@/components/feed/feed.module.css";

export const metadata: Metadata = { title: "Feed" };

// The filter comes from the URL; render the whole page on the server before sending it.
export const instant = false;

export default async function FeedPage({ searchParams }: PageProps<"/app/feed">) {
  const { topic } = await searchParams;
  const filter: FeedFilter = topic === "Trending" ? "Trending" : isCategory(topic) ? topic : undefined;
  const [{ cards }, products] = await Promise.all([
    getCards({ filter }),
    readProducts(filter === "Trending" ? { rising: true } : filter ? { category: filter } : {}),
  ]);

  return (
    <main className={s.screen}>
      <h1 className="sr-only">Idea feed{filter ? `: ${filter}` : ""}</h1>
      <FilterChips active={filter} />
      {/* key resets the feed position when the filter changes */}
      <SwipeFeed key={filter ?? "all"} cards={cards} products={products.slice(0, 15)} />
    </main>
  );
}
