"use client";

import Link from "next/link";
import { Bookmark, X } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useSaved } from "@/lib/saved";
import s from "./saved.module.css";

export default function SavedList() {
  const { saved, remove } = useSaved();

  return (
    <>
      <div className={s.head}>
        <h1 className={s.h1}>Saved</h1>
        <p className={s.sub}>
          {saved.length} {saved.length === 1 ? "idea" : "ideas"} · on this device
        </p>
      </div>

      {saved.length === 0 ? (
        <div className={s.empty}>
          <Bookmark size={28} aria-hidden="true" />
          <p className={s.emptyTitle}>Nothing saved yet.</p>
          <p className={s.emptyText}>Swipe right on an idea to keep it here.</p>
          <Link href="/feed" className="pill pill-dark">
            Open the feed
          </Link>
        </div>
      ) : (
        <ul className={s.list}>
          {saved.map((card) => (
            <li key={card.slug} className={s.item}>
              <Link href={`/idea/${card.slug}`} className={s.itemLink}>
                <span className={s.itemTitle}>{card.headline}</span>
                <span className={s.meta}>
                  <span className={card.trend === "rising" ? s.dot : `${s.dot} ${s.dotGray}`} aria-hidden="true" />
                  {card.category} · {card.evidence.posts} mentions · {card.trend === "rising" ? "Rising" : card.trend === "falling" ? "Falling" : "Steady"}
                </span>
              </Link>
              <button
                type="button"
                className={s.remove}
                onClick={() => remove(card.slug)}
                aria-label={`Remove ${card.headline}`}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={s.promo}>
        <LogoMark size={28} />
        <p>
          <strong>Keep saves on every device.</strong> Accounts are coming soon.
        </p>
      </div>

      {saved.length > 0 && (
        <div className={s.bottom}>
          <Link href="/feed" className="pill pill-dark" style={{ width: "100%" }}>
            Keep swiping
          </Link>
        </div>
      )}
    </>
  );
}
