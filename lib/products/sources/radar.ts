import "server-only";
import type { ProductProof } from "@/lib/types";
import { hostOf } from "@/lib/url";
import { headers } from "./types";

// stand-in for traffic, GA only covers your own site. needs CLOUDFLARE_RADAR_TOKEN
const BUCKETS = [200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];

export function radarConfigured() {
  return Boolean(process.env.CLOUDFLARE_RADAR_TOKEN);
}

export async function trafficRank(siteUrl: string): Promise<ProductProof | null> {
  const token = process.env.CLOUDFLARE_RADAR_TOKEN;
  if (!URL.canParse(siteUrl)) return null;
  const domain = hostOf(siteUrl);
  if (!token || /apps\.apple\.com|github\.com/.test(domain)) return null;
  const response = await fetch(`https://api.cloudflare.com/client/v4/radar/ranking/domain/${domain}`, {
    headers: { ...headers, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json()) as { result?: { details_0?: { top_locations?: unknown; bucket?: string | number; rank?: number } } };
  const details = body.result?.details_0;
  const rank = Number(details?.rank ?? details?.bucket);
  if (!rank) return null;
  const top = BUCKETS.find((bucket) => rank <= bucket);
  if (!top || top > 200000) return null; // too small to say anything
  return {
    kind: "traffic",
    label: `Top ${top >= 1000 ? `${top / 1000}k` : top} website worldwide`,
    url: `https://radar.cloudflare.com/domains/domain/${domain}`,
    site: "Cloudflare Radar",
  };
}
