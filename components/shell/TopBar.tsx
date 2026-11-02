"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import Logo from "@/components/Logo";
import AccountButton from "./AccountButton";
import s from "./shell.module.css";

// The palette is a separate chunk, fetched the first time it opens (this listener is all that loads up front).
const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });

// The search bar opens the command palette; ⌘K / Ctrl+K opens it from anywhere in the studio.
export default function TopBar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // stays mounted after the first open, so closing keeps its state
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const onFeed = pathname === "/app/feed";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMounted(true);
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = () => {
    setMounted(true);
    setOpen(true);
  };

  return (
    <header className={`${s.top} ${scrolled ? s.topScrolled : ""}`}>
      <Link href="/app" className={s.topBrand} aria-label="Unmet home">
        <Logo size={24} />
      </Link>
      {onFeed ? (
        <form
          className={s.searchField}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const text = q.trim();
            if (text) router.push(`/app/research?q=${encodeURIComponent(text)}`);
          }}
        >
          <Search size={16} aria-hidden="true" />
          <label htmlFor="ai-search" className={s.srOnly}>
            Ask AI about any problem or market
          </label>
          <input
            id="ai-search"
            className={s.searchInput}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask AI about any problem or market"
            autoComplete="off"
          />
        </form>
      ) : (
        <button type="button" className={s.searchField} onClick={openPalette}>
          <Search size={16} aria-hidden="true" />
          <span>Search ideas, research and actions</span>
        </button>
      )}
      <div className={s.topActions}>
        {onFeed ? (
          <Link href="/app/research" className={s.searchIcon} aria-label="Ask AI">
            <Search size={21} aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" className={s.searchIcon} onClick={openPalette} aria-label="Search">
            <Search size={21} aria-hidden="true" />
          </button>
        )}
        <AccountButton variant="icon" />
      </div>
      {mounted && <CommandPalette open={open} onClose={() => setOpen(false)} />}
    </header>
  );
}
