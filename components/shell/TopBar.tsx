"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import Logo from "@/components/Logo";
import AccountButton from "./AccountButton";
import FeedSearch from "./FeedSearch";
import styles from "./shell.module.css";

// palette loads as its own chunk on first open
const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // stays mounted after first open so closing keeps its state
  const [scrolled, setScrolled] = useState(false);
  const [feedSearchOpen, setFeedSearchOpen] = useState(false);
  const pathname = usePathname();
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
        setOpen((wasOpen) => !wasOpen);
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
    <header className={`${styles.top} ${scrolled ? styles.topScrolled : ""}`}>
      <Link href="/app" className={styles.topBrand} aria-label="Unmet home">
        <Logo size={24} />
      </Link>
      {onFeed ? (
        <Suspense>
          <FeedSearch open={feedSearchOpen} />
        </Suspense>
      ) : (
        <button type="button" className={styles.searchField} onClick={openPalette}>
          <Search size={16} aria-hidden="true" />
          <span>Search ideas, research and actions</span>
        </button>
      )}
      <div className={styles.topActions}>
        {onFeed ? (
          <button
            type="button"
            className={styles.searchIcon}
            onClick={() => setFeedSearchOpen((wasOpen) => !wasOpen)}
            aria-label="Search the feed"
            aria-expanded={feedSearchOpen}
          >
            <Search size={21} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className={styles.searchIcon} onClick={openPalette} aria-label="Search">
            <Search size={21} aria-hidden="true" />
          </button>
        )}
        <AccountButton variant="icon" />
      </div>
      {mounted && <CommandPalette open={open} onClose={() => setOpen(false)} />}
    </header>
  );
}
