"use client";

import Link from "next/link";
import IdeaDetail from "./IdeaDetail";
import { useResearchChat, findResearchCard } from "@/lib/research-store";
import { useSaved } from "@/lib/saved";
import s from "./idea.module.css";

// Ideas found in research chat aren't in the database yet, so we look for them in this browser.
export default function LocalIdea({ slug }: { slug: string }) {
  const { saved } = useSaved();
  const { messages } = useResearchChat(); // re-render once the stored chat loads
  const card = saved.find((c) => c.slug === slug) ?? (messages.length ? findResearchCard(slug) : undefined);

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
