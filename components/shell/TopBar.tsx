"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import Logo from "@/components/Logo";
import s from "./shell.module.css";

// Search lives here for now; ⌘K / Ctrl+K jumps to it from anywhere in the studio.
export default function TopBar() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/app/search");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <header className={s.top}>
      <Link href="/app" className={s.topBrand} aria-label="Unmet home">
        <Logo size={24} />
      </Link>
      <Link href="/app/search" className={s.searchField}>
        <Search size={16} aria-hidden="true" />
        <span>Search ideas</span>
        <kbd className={s.kbd}>⌘K</kbd>
      </Link>
      <Link href="/app/search" className={s.searchIcon} aria-label="Search ideas">
        <Search size={21} aria-hidden="true" />
      </Link>
    </header>
  );
}
