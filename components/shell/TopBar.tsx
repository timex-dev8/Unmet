"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import Logo from "@/components/Logo";
import CommandPalette from "./CommandPalette";
import s from "./shell.module.css";

// The search bar opens the command palette; ⌘K / Ctrl+K opens it from anywhere in the studio.
export default function TopBar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className={s.top}>
      <Link href="/app" className={s.topBrand} aria-label="Unmet home">
        <Logo size={24} />
      </Link>
      <button type="button" className={s.searchField} onClick={() => setOpen(true)}>
        <Search size={16} aria-hidden="true" />
        <span>Search ideas, research and actions</span>
        <kbd className={s.kbd}>⌘K</kbd>
      </button>
      <button type="button" className={s.searchIcon} onClick={() => setOpen(true)} aria-label="Search">
        <Search size={21} aria-hidden="true" />
      </button>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
