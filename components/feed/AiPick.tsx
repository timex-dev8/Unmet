import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getAiPick } from "@/lib/feed/pick";
import { ideaHref } from "@/lib/links";
import type { Card } from "@/lib/types";
import s from "./feed.module.css";

/** The model's pick of the week; renders nothing when there is none. */
export default async function AiPick({ cards }: { cards: Card[] }) {
  const pick = await getAiPick(cards);
  const card = pick && cards.find((c) => c.slug === pick.slug);
  if (!pick || !card) return null;
  return (
    <aside className={s.pick} aria-label="AI pick">
      <span className={s.pickLabel}>
        <Sparkles size={14} aria-hidden="true" />
        AI pick
      </span>
      <Link href={ideaHref(card.slug)} className={s.pickTitle}>
        {card.headline}
      </Link>
      <p className={s.pickWhy}>{pick.why}</p>
      <p className={s.pickNote}>Chosen by AI</p>
    </aside>
  );
}
