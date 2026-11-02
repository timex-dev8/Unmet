import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import FilterChips from "@/components/app/FilterChips";
import AiPick from "@/components/feed/AiPick";
import SwipeFeed from "@/components/feed/SwipeFeed";
import { getAllCards, getCards, isCategory, type FeedFilter } from "@/lib/cards";
import { readProducts } from "@/lib/products";
import { SOURCE_KINDS } from "@/lib/types";
import s from "@/components/feed/feed.module.css";

export const metadata: Metadata = { title: "Feed" };

// The filter comes from the URL; render the whole page on the server before sending it.
export const instant = false;

export default async function FeedPage({ searchParams }: PageProps<"/app/feed">) {
  const { topic, source: sourceParam } = await searchParams;
  const filter: FeedFilter = topic === "Trending" ? "Trending" : isCategory(topic) ? topic : undefined;
  const source = SOURCE_KINDS.find((k) => k === sourceParam);
  const [{ cards: page }, all, products] = await Promise.all([
    getCards({ filter }),
    getAllCards(),
    readProducts(filter === "Trending" ? { rising: true } : filter ? { category: filter } : {}),
  ]);
  const kinds = SOURCE_KINDS.filter((k) => all.some((c) => c.sources.some((x) => x.kind === k)));
  const cards = source ? page.filter((c) => c.sources.some((x) => x.kind === source)) : page;
  const showPick = !filter && !source;
  // The pick leads the feed, so it isn't repeated in the list.
  const top20 = all.slice(0, 20);

  return (
    <main className={s.screen}>
      <h1 className="sr-only">Idea feed{filter ? `: ${filter}` : ""}</h1>
      <FilterChips active={filter} source={source} kinds={kinds} />
      {showPick && (
        <Suspense fallback={null}>
          <AiPick cards={top20} />
        </Suspense>
      )}
      {source && !cards.length ? (
        <div className={s.end} style={{ position: "static", flex: 1, margin: "0 12px 12px" }}>
          <h2 className={s.endTitle}>Nothing from this source yet.</h2>
          <p className={s.endText}>No ideas here have evidence from it. Try another source.</p>
          <Link href={filter ? `/app/feed?topic=${encodeURIComponent(filter)}` : "/app/feed"} className="pill pill-dark">
            Clear source filter
          </Link>
        </div>
      ) : (
        /* key resets the feed position when a filter changes */
        <SwipeFeed key={`${filter ?? "all"}|${source ?? ""}`} cards={cards} products={source ? [] : products.slice(0, 15)} />
      )}
    </main>
  );
}
