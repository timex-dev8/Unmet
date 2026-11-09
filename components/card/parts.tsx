import { ArrowDown, ArrowRight, ArrowUp, Sparkles } from "lucide-react";
import { categoryLabel, type Card, type SourceKind, type Trend } from "@/lib/types";
import styles from "./card.module.css";

export function windowLabel(days: number) {
  if (days >= 700) return "last 2 years";
  return days >= 365 ? "last 12 months" : `last ${days} days`;
}

export function shortDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

export function kindBadge(src: Card["sources"][number]) {
  return src.kind ? KIND_BADGE[src.kind] : null;
}

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
    <div className={styles.tagRow}>
      <div className={styles.tags}>
        <span className={styles.tag}>{categoryLabel(card.category)}</span>
        {card.sample && <span className={`${styles.tag} ${styles.tagSample}`}>Sample</span>}
        {card.fresh && <span className={`${styles.tag} ${styles.tagFresh}`}>Fresh</span>}
        {card.signal === "niche" && <span className={`${styles.tag} ${styles.tagSample}`}>Niche</span>}
        {card.signal === "early" && <span className={`${styles.tag} ${styles.tagSample}`}>Early signal</span>}
      </div>
      <TrendBadge trend={card.trend} />
    </div>
  );
}

export function TrendBadge({ trend }: { trend: Trend }) {
  const Icon = trend === "rising" ? ArrowUp : trend === "falling" ? ArrowDown : ArrowRight;
  const label = trend === "rising" ? "Rising" : trend === "falling" ? "Falling" : "Steady";
  return (
    <span className={`${styles.trend} ${trend === "rising" ? styles.trendRising : ""}`}>
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}

export function Quote({ text, highlight, className }: { text: string; highlight: string; className?: string }) {
  const matchStart = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
  return (
    <p className={className ?? styles.quote}>
      “
      {matchStart < 0 ? (
        text
      ) : (
        <>
          {text.slice(0, matchStart)}
          <span className="hl">{text.slice(matchStart, matchStart + highlight.length)}</span>
          {text.slice(matchStart + highlight.length)}
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
  const points = values.map((value, i) => [i * step, height - 3 - (value / max) * (height - 6)] as const);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
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
    <div className={styles.ai}>
      <div className={styles.aiHead}>
        <span className={styles.aiTitle}>
          <Sparkles size={14} aria-hidden="true" />
          AI suggestions
        </span>
        <span className={styles.aiNote}>Not from sources</span>
      </div>
      <ul className={styles.aiList}>
        {items.map((suggestion) => (
          <li key={suggestion.title}>
            <strong>{suggestion.title}.</strong> {suggestion.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
