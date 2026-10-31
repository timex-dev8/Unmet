"use client";

import { useState } from "react";
import { Check, Share } from "lucide-react";
import { ideaHref } from "@/lib/links";
import type { Card } from "@/lib/types";
import s from "./card.module.css";

export default function ShareButton({ card }: { card: Card }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${ideaHref(card.slug)}`;
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
    <button type="button" onClick={share} className={`${s.act} ${s.actQuiet} ${s.iconBtn}`} aria-label={copied ? "Link copied" : "Share"}>
      {copied ? <Check size={18} aria-hidden="true" /> : <Share size={18} aria-hidden="true" />}
    </button>
  );
}
