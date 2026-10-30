import "server-only";
import { listStartups } from "@/lib/trustmrr";
import type { RawProduct } from "./types";

// TrustMRR: startups whose revenue is verified (Stripe, App Store…). The strongest proof we have.
const money = (cents: number) => {
  const d = cents / 100;
  return d >= 1_000_000 ? `$${(d / 1_000_000).toFixed(1)}M` : d >= 1000 ? `$${Math.round(d / 1000)}k` : `$${Math.round(d)}`;
};

export async function trustMrr(): Promise<RawProduct[]> {
  const [growing, earning] = await Promise.all([listStartups({ sort: "growth-desc", pages: 3 }), listStartups({ sort: "revenue-desc", pages: 2 })]);
  const seen = new Set<string>();
  return [...growing, ...earning]
    .filter((s) => s.mrr >= 50_000 && !/^stealth/i.test(s.name) && !seen.has(s.slug) && seen.add(s.slug))
    .map((s) => ({
      name: s.name,
      url: s.website,
      description: s.description.slice(0, 600),
      hint: s.category,
      proof: [
        { kind: "mrr" as const, label: `${money(s.mrr)} MRR, verified`, url: s.url, site: "TrustMRR" },
        ...(s.growth && s.growth > 0 ? [{ kind: "growth" as const, label: `↑ ${s.growth}% in 30 days`, url: s.url, site: "TrustMRR" }] : []),
      ],
      rising: (s.growth ?? 0) >= 10,
      weight: 50 + Math.min(40, Math.log10(Math.max(1, s.mrr / 100)) * 8) + Math.min(20, Math.max(0, s.growth ?? 0) / 5),
    }));
}
