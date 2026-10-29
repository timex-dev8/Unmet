"use client";

import { useState } from "react";
import { Check, Share } from "lucide-react";
import type { Card } from "@/lib/types";
import s from "./card.module.css";

export default function ShareButton({ card, withLabel = false }: { card: Card; withLabel?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/idea/${card.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: card.headline, text: card.summary, url });
        return;
      } catch {
        return; // user closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`${s.act} ${withLabel ? "" : s.iconBtn}`}
      aria-label={withLabel ? undefined : copied ? "Link copied" : "Share"}
    >
      {copied ? <Check size={18} aria-hidden="true" /> : <Share size={18} aria-hidden="true" />}
      {withLabel && (copied ? "Copied" : "Share")}
    </button>
  );
}
