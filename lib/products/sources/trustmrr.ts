import "server-only";
import { formatMrr } from "@/lib/text";
import { listStartups } from "@/lib/trustmrr";
import type { RawProduct } from "./types";

// revenue first, the dedupe keeps the first entry
// growth over 1000% is a tiny base or a glitch, not shown or counted
const believable = (growth: number | null): growth is number => growth !== null && growth > 0 && growth < 1000;

export async function trustMrr(): Promise<RawProduct[]> {
  const [earning, growing] = await Promise.all([listStartups({ sort: "revenue-desc", pages: 3 }), listStartups({ sort: "growth-desc", pages: 2 })]);
  const seen = new Set<string>();
  return [...earning, ...growing]
    .filter((startup) => startup.mrr >= 500_000 && !/^stealth/i.test(startup.name) && !seen.has(startup.slug) && seen.add(startup.slug))
    .map((startup) => {
      const growth = believable(startup.growth) ? startup.growth : 0;
      return {
        name: startup.name,
        url: startup.website,
        description: startup.description.slice(0, 600),
        hint: startup.category,
        proof: [
          { kind: "mrr" as const, label: `${formatMrr(startup.mrr, "short")} MRR, verified`, url: startup.url, site: "TrustMRR" },
          ...(growth ? [{ kind: "growth" as const, label: `↑ ${growth}% in 30 days`, url: startup.url, site: "TrustMRR" }] : []),
        ],
        rising: growth >= 10,
        source: "TrustMRR" as const,
        // $5k MRR ~ 83, $100k ~ 95, believable growth adds up to 10
        weight: 50 + Math.min(45, Math.log10(Math.max(1, startup.mrr / 100)) * 9) + Math.min(10, growth / 10),
      };
    });
}
