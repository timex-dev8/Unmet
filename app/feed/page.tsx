import type { Metadata } from "next";
import AppBar from "@/components/app/AppBar";
import FilterChips from "@/components/app/FilterChips";
import SwipeFeed from "@/components/feed/SwipeFeed";
import { getCards, isCategory, type FeedFilter } from "@/lib/cards";
import s from "@/components/feed/feed.module.css";

export const metadata: Metadata = { title: "Feed · Unmet" };

// The filter comes from the URL; render the whole page on the server before sending it.
export const instant = false;

export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const { topic } = await searchParams;
  const filter: FeedFilter = topic === "Trending" ? "Trending" : isCategory(topic) ? topic : undefined;
  const { cards } = await getCards({ filter });

  return (
    <div className={s.page}>
      <main className={s.screen}>
        <h1 className="sr-only">Idea feed{filter ? `: ${filter}` : ""}</h1>
        <AppBar />
        <FilterChips active={filter} />
        {/* key resets the feed position when the filter changes */}
        <SwipeFeed key={filter ?? "all"} cards={cards} />
      </main>
    </div>
  );
}
