"use client";

import Link from "next/link";
import IdeaDetail from "./IdeaDetail";
import { findResearchCard, useThreads } from "@/lib/research-store";
import { useSaved } from "@/lib/saved";
import s from "./idea.module.css";

// research chat ideas arent in the db yet, look in this browser
export default function LocalIdea({ slug }: { slug: string }) {
  const { saved } = useSaved();
  const threads = useThreads();
  const card = saved.find((c) => c.slug === slug) ?? (threads.length ? findResearchCard(slug) : undefined);

  if (card) return <IdeaDetail card={card} backHref={card.fresh ? "/app/research" : "/app/feed"} backLabel={card.fresh ? "Research" : "Feed"} />;

  return (
    <div className={s.page}>
      <div className={s.missing}>
        <h1 className={s.h2}>This idea isn’t on this device.</h1>
        <p className={s.note}>Ideas from research are kept in the browser where you found them, until accounts arrive.</p>
        <Link href="/app/research" className="pill pill-dark">
          Start a research
        </Link>
      </div>
    </div>
  );
}
