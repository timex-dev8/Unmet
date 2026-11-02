import { ArrowDown, ArrowRight, ArrowUp, Sparkles } from "lucide-react";
import type { Card, SourceKind, Trend } from "@/lib/types";
import s from "./card.module.css";

export function windowLabel(days: number) {
  return days >= 365 ? "last 12 months" : `last ${days} days`;
}

export function shortDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const KIND_BADGE: Record<SourceKind, string> = {
  forum: "Forum",
  qa: "Q&A",
  review: "Review",
  "app-review": "App Store review",
  issue: "GitHub issue",
  social: "Bluesky",
  hn: "Hacker News",
  news: "News",
  blog: "Blog",
};

/** Short label for what kind of place a source is ("Forum", "Q&A", "Review"…). */
export function kindBadge(src: Card["sources"][number]) {
  return src.kind ? KIND_BADGE[src.kind] : null;
}

/** "indiehackers.com · Oct 22, 2026 · 3 votes · 417 views" */
export function sourceMeta(src: Card["sources"][number]) {
  return [
    src.kind === "hn" || src.kind === "app-review" ? "" : src.site,
    shortDate(src.postedAt),
    src.engagement ?? "",
    src.points != null ? `${src.points} ${src.points === 1 ? "point" : "points"}` : "",
    src.comments != null ? `${src.comments} ${src.comments === 1 ? "comment" : "comments"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function CardTags({ card }: { card: Card }) {
  return (
    <div className={s.tagRow}>
      <div className={s.tags}>
        <span className={s.tag}>{card.category}</span>
        {card.sample && <span className={`${s.tag} ${s.tagSample}`}>Sample</span>}
        {card.fresh && <span className={`${s.tag} ${s.tagFresh}`}>Fresh</span>}
        {card.signal === "niche" && <span className={`${s.tag} ${s.tagSample}`}>Niche</span>}
        {card.signal === "early" && <span className={`${s.tag} ${s.tagSample}`}>Early signal</span>}
      </div>
      <TrendBadge trend={card.trend} />
    </div>
  );
}

export function TrendBadge({ trend }: { trend: Trend }) {
  const Icon = trend === "rising" ? ArrowUp : trend === "falling" ? ArrowDown : ArrowRight;
  const label = trend === "rising" ? "Rising" : trend === "falling" ? "Falling" : "Steady";
  return (
    <span className={`${s.trend} ${trend === "rising" ? s.trendRising : ""}`}>
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}

// Highlights the repeated phrase inside a short quote.
export function Quote({ text, highlight, className }: { text: string; highlight: string; className?: string }) {
  const at = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
  return (
    <p className={className ?? s.quote}>
      “
      {at < 0 ? (
        text
      ) : (
        <>
          {text.slice(0, at)}
          <span className="hl">{text.slice(at, at + highlight.length)}</span>
          {text.slice(at + highlight.length)}
        </>
      )}
      ”
    </p>
  );
}

export function Sparkline({ values, width = 96, height = 30 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const first = values[0];
  const last = values[values.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Mentions over time, from ${first} to ${last}`}
      style={{ flex: "none" }}
    >
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill="var(--tint)" />
      <path d={line} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function AiSuggestions({ card, limit }: { card: Card; limit?: number }) {
  const items = limit ? card.aiSuggestions.slice(0, limit) : card.aiSuggestions;
  return (
    <div className={s.ai}>
      <div className={s.aiHead}>
        <span className={s.aiTitle}>
          <Sparkles size={14} aria-hidden="true" />
          AI suggestions
        </span>
        <span className={s.aiNote}>Not from sources</span>
      </div>
      <ul className={s.aiList}>
        {items.map((it) => (
          <li key={it.title}>
            <strong>{it.title}.</strong> {it.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Demand / competition / difficulty as three quiet chips: the name and its level. */
export function ScoreChips({ card }: { card: Card }) {
  const rows = [
    ["Demand", card.scores.demand],
    ["Competition", card.scores.competition],
    ["Difficulty", card.scores.difficulty],
  ] as const;
  return (
    <div className={s.scoreChips}>
      {rows.map(([name, sc]) => (
        <div key={name} className={s.scoreChip}>
          <span className={s.scoreChipLabel}>{name}</span>
          <span className={s.scoreChipValue}>{sc.label}</span>
        </div>
      ))}
    </div>
  );
}
