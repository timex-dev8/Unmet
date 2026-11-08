import "server-only";

// revenue verified startups (trustmrr.com/docs/api), market proof only, never complaints

export type Startup = {
  name: string;
  slug: string;
  description: string;
  website: string;
  category: string;
  mrr: number; // USD cents
  growth: number | null; // percent, 30 days
  url: string;
};

type RawStartup = {
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

// docs show growth as a decimal (0.12) and a percent (24), normalize to percent
const toPercent = (growth: number | null | undefined) =>
  growth == null ? null : Math.abs(growth) <= 3 ? Math.round(growth * 100) : Math.round(growth);

export async function listStartups(params: { category?: string; sort: "growth-desc" | "revenue-desc"; pages?: number }) {
  if (!trustmrrConfigured()) return [];
  const startups: Startup[] = [];
  for (let page = 1; page <= (params.pages ?? 1); page++) {
    const searchParams = new URLSearchParams({ sort: params.sort, limit: "10", page: String(page) });
    if (params.category) searchParams.set("category", params.category);
    const response = await fetch(`https://trustmrr.com/api/v1/startups?${searchParams}`, {
      headers: { Authorization: `Bearer ${process.env.TRUSTMRR_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!response?.ok) break;
    const body = (await response.json()) as { data?: RawStartup[]; meta?: { hasMore?: boolean } };
    for (const startup of body.data ?? []) {
      startups.push({
        name: startup.name,
        slug: startup.slug,
        description: startup.description ?? "",
        website: startup.website ?? `https://trustmrr.com/startup/${startup.slug}`,
        category: startup.category ?? params.category ?? "",
        mrr: startup.revenue?.mrr ?? 0,
        growth: toPercent(startup.growth30d),
        url: `https://trustmrr.com/startup/${startup.slug}`,
      });
    }
    if (!body.meta?.hasMore) break;
  }
  return startups;
}
