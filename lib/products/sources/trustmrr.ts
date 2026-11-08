import "server-only";
import { formatMrr } from "@/lib/text";
import { listStartups } from "@/lib/trustmrr";
import type { RawProduct } from "./types";

// revenue first, the dedupe keeps the first entry
// growth over 1000% is a tiny base or a glitch, not shown or counted
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
          { kind: "mrr" as const, label: `${formatMrr(s.mrr, "short")} MRR, verified`, url: s.url, site: "TrustMRR" },
          ...(growth ? [{ kind: "growth" as const, label: `↑ ${growth}% in 30 days`, url: s.url, site: "TrustMRR" }] : []),
        ],
        rising: growth >= 10,
        source: "TrustMRR" as const,
        // $5k MRR ~ 83, $100k ~ 95, believable growth adds up to 10
        weight: 50 + Math.min(45, Math.log10(Math.max(1, s.mrr / 100)) * 9) + Math.min(10, growth / 10),
      };
    });
}
