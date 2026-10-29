import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { CATEGORIES } from "@/lib/types";
import type { FeedFilter } from "@/lib/cards";
import s from "./app.module.css";

export default function FilterChips({ active }: { active: FeedFilter }) {
  const chips: { label: string; value: FeedFilter }[] = [
    { label: "All", value: undefined },
    { label: "Trending", value: "Trending" },
    ...CATEGORIES.map((c) => ({ label: c, value: c })),
  ];
  return (
    <nav className={s.chips} aria-label="Filter ideas">
      {chips.map((c) => {
        const on = c.value === active;
        const href = c.value ? `/app/feed?topic=${encodeURIComponent(c.value)}` : "/app/feed";
        return (
          <Link key={c.label} href={href} className={`${s.chip} ${on ? s.chipOn : ""}`} aria-current={on ? "page" : undefined}>
            {c.value === "Trending" && <TrendingUp size={15} strokeWidth={2.5} aria-hidden="true" />}
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}
