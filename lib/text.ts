export function slugify(text: string, max = 60) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

// the sheet only lists the top few sources, so take whichever number is bigger
export function sourceCount(card: { evidence: { threads: number }; sources: unknown[] }) {
  return Math.max(card.evidence.threads, card.sources.length);
}

// "exact" is $1,234, "short" is $900, $12k or $1.2M
export function formatMrr(cents: number, style: "exact" | "short" = "exact") {
  const dollars = cents / 100;
  if (style === "exact") return `$${Math.round(dollars).toLocaleString("en-US")}`;
  return dollars >= 1_000_000
    ? `$${(dollars / 1_000_000).toFixed(1)}M`
    : dollars >= 1000
      ? `$${Math.round(dollars / 1000)}k`
      : `$${Math.round(dollars)}`;
}
