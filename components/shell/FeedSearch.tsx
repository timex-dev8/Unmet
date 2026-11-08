"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import s from "./shell.module.css";

export default function FeedSearch({ open }: { open: boolean }) {
  const router = useRouter();
  const current = useSearchParams().get("q") ?? "";
  return (
    <form
      className={`${s.searchField} ${open ? s.searchFieldOpen : ""}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const text = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        router.push(text ? `/app/feed?q=${encodeURIComponent(text)}` : "/app/feed");
      }}
    >
      <Search size={16} aria-hidden="true" />
      <label htmlFor="feed-search" className={s.srOnly}>
        Search the feed
      </label>
      {/* key so the box follows the url */}
      <input
        key={current}
        id="feed-search"
        name="q"
        className={s.searchInput}
        type="search"
        defaultValue={current}
        maxLength={120}
        placeholder="Search the feed"
        autoComplete="off"
        enterKeyHint="search"
      />
    </form>
  );
}
