import "server-only";
import type { ProductProof } from "@/lib/types";
import { headers } from "./types";

// Traffic, from Cloudflare Radar's domain ranking (free token). Google Analytics only covers your
// own site, so this is the stand-in. Only runs with CLOUDFLARE_RADAR_TOKEN.
const BUCKETS = [200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];

export function radarConfigured() {
  return Boolean(process.env.CLOUDFLARE_RADAR_TOKEN);
}

export async function trafficRank(siteUrl: string): Promise<ProductProof | null> {
  const token = process.env.CLOUDFLARE_RADAR_TOKEN;
  let domain: string;
  try {
    domain = new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (!token || /apps\.apple\.com|github\.com/.test(domain)) return null;
  const res = await fetch(`https://api.cloudflare.com/client/v4/radar/ranking/domain/${domain}`, {
    headers: { ...headers, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json()) as { result?: { details_0?: { top_locations?: unknown; bucket?: string | number; rank?: number } } };
  const d = body.result?.details_0;
  const rank = Number(d?.rank ?? d?.bucket);
  if (!rank) return null;
  const top = BUCKETS.find((b) => rank <= b);
  if (!top || top > 200000) return null; // too small to say anything
  return {
    kind: "traffic",
    label: `Top ${top >= 1000 ? `${top / 1000}k` : top} website worldwide`,
    url: `https://radar.cloudflare.com/domains/domain/${domain}`,
    site: "Cloudflare Radar",
  };
}
