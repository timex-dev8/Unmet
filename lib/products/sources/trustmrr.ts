import "server-only";
import { listStartups } from "@/lib/trustmrr";
import type { RawProduct } from "./types";

// TrustMRR: startups whose revenue is verified (Stripe, App Store…). The strongest proof we have.
const money = (cents: number) => {
  const d = cents / 100;
  return d >= 1_000_000 ? `$${(d / 1_000_000).toFixed(1)}M` : d >= 1000 ? `$${Math.round(d / 1000)}k` : `$${Math.round(d)}`;
};

// Revenue first: the dedupe keeps the first entry, so a startup on both lists stays revenue-ranked.
// Growth over 1000% is usually a tiny base or a data glitch, so it's neither shown nor counted.
const believable = (g: number | null): g is number => g !== null && g > 0 && g < 1000;

export async function trustMrr(): Promise<RawProduct[]> {
  const [earning, growing] = await Promise.all([listStartups({ sort: "revenue-desc", pages: 3 }), listStartups({ sort: "growth-desc", pages: 2 })]);
  const seen = new Set<string>();
  return [...earning, ...growing]
    .filter((s) => s.mrr >= 500_000 && !/^stealth/i.test(s.name) && !seen.has(s.slug) && seen.add(s.slug))
    .map((s) => {
      const growth = believable(s.growth) ? s.growth : 0;
      return {
        name: s.name,
        url: s.website,
        description: s.description.slice(0, 600),
        hint: s.category,
        proof: [
          { kind: "mrr" as const, label: `${money(s.mrr)} MRR, verified`, url: s.url, site: "TrustMRR" },
          ...(growth ? [{ kind: "growth" as const, label: `↑ ${growth}% in 30 days`, url: s.url, site: "TrustMRR" }] : []),
        ],
        rising: growth >= 10,
        source: "TrustMRR" as const,
        // $5k MRR ≈ 83, $100k ≈ 95; believable growth adds up to 10
        weight: 50 + Math.min(45, Math.log10(Math.max(1, s.mrr / 100)) * 9) + Math.min(10, growth / 10),
      };
    });
}
