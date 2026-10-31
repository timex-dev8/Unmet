/** Lowercase ASCII words joined by "-", cut to `max` characters (names in other scripts can end up empty). */
export function slugify(text: string, max = 60) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

/**
 * Monthly revenue in USD cents as text, without the "/mo". "exact" is "$1,234"; "short" is "$900", "$12k" or "$1.2M".
 */
export function formatMrr(cents: number, style: "exact" | "short" = "exact") {
  const d = cents / 100;
  if (style === "exact") return `$${Math.round(d).toLocaleString("en-US")}`;
  return d >= 1_000_000 ? `$${(d / 1_000_000).toFixed(1)}M` : d >= 1000 ? `$${Math.round(d / 1000)}k` : `$${Math.round(d)}`;
}
