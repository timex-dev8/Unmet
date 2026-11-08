import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getAllSlugs, getCard } from "@/lib/cards";
import { readFeed } from "@/lib/feed";
import { ideaHref } from "@/lib/links";

const SITE = "https://unmet-ten.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // feed changes daily, build per request
  const live = await readFeed();
  const urls: MetadataRoute.Sitemap = [{ url: SITE, changeFrequency: "weekly", priority: 1 }];
  const seen = new Set<string>();
  for (const card of live) {
    if (card.sample || seen.has(card.slug)) continue;
    seen.add(card.slug);
    urls.push({
      url: `${SITE}${ideaHref(card.slug)}`,
      lastModified: card.evidence.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  // prerendered slugs missing from the live feed, real cards only
  for (const slug of await getAllSlugs()) {
    if (seen.has(slug)) continue;
    const card = await getCard(slug);
    if (!card || card.sample) continue;
    seen.add(slug);
    urls.push({ url: `${SITE}${ideaHref(slug)}`, lastModified: card.evidence.updatedAt, changeFrequency: "weekly", priority: 0.7 });
  }
  return urls;
}
