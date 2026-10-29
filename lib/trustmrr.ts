import "server-only";
import { cacheLife } from "next/cache";

// TrustMRR: startups with revenue verified through Stripe, App Store and others
// (trustmrr.com/docs/api). Used as market proof and competitor evidence, never as complaints.

export type Startup = {
  name: string;
  slug: string;
  description: string;
  website: string;
  category: string;
  mrr: number; // USD cents
  growth: number | null; // percent, 30 days
  url: string; // trustmrr.com page
};

type Raw = {
  name: string;
  slug: string;
  description?: string;
  website?: string;
  category?: string;
  revenue?: { mrr?: number; last30Days?: number };
  growth30d?: number | null;
};

export function trustmrrConfigured() {
  return Boolean(process.env.TRUSTMRR_API_KEY);
}

// The docs show growth both as a decimal (0.12) and as a percent (24); normalize to percent.
const toPercent = (g: number | null | undefined) => (g == null ? null : Math.abs(g) <= 3 ? Math.round(g * 100) : Math.round(g));

export async function listStartups(params: { category?: string; sort: "growth-desc" | "revenue-desc"; pages?: number }) {
  if (!trustmrrConfigured()) return [];
  const out: Startup[] = [];
  for (let page = 1; page <= (params.pages ?? 1); page++) {
    const qs = new URLSearchParams({ sort: params.sort, limit: "10", page: String(page) });
    if (params.category) qs.set("category", params.category);
    const res = await fetch(`https://trustmrr.com/api/v1/startups?${qs}`, {
      headers: { Authorization: `Bearer ${process.env.TRUSTMRR_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!res?.ok) break;
    const body = (await res.json()) as { data?: Raw[]; meta?: { hasMore?: boolean } };
    for (const s of body.data ?? []) {
      out.push({
        name: s.name,
        slug: s.slug,
        description: s.description ?? "",
        website: s.website ?? `https://trustmrr.com/startup/${s.slug}`,
        category: s.category ?? params.category ?? "",
        mrr: s.revenue?.mrr ?? 0,
        growth: toPercent(s.growth30d),
        url: `https://trustmrr.com/startup/${s.slug}`,
      });
    }
    if (!body.meta?.hasMore) break;
  }
  return out;
}

/** "Startups growing now" on Home, refreshed hourly. */
export async function growingStartups() {
  "use cache";
  cacheLife("hours");
  const list = await listStartups({ sort: "growth-desc", pages: 1 });
  // Skip anonymous "Stealth company" listings: nothing to learn from them.
  return list.filter((s) => s.mrr > 0 && !/^stealth/i.test(s.name)).slice(0, 6);
}
