import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getAllSlugs, getCard } from "@/lib/cards";
import { readFeed } from "@/lib/feed";
import { ideaHref } from "@/lib/links";

const SITE = "https://unmet-ten.vercel.app";

// The landing page plus every real idea page (sample cards are placeholders and stay out).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // the live feed changes daily: build the list per request, not at build time
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
  // Slugs that are prerendered but not in the live feed: only real (non-sample) cards belong here.
  for (const slug of await getAllSlugs()) {
    if (seen.has(slug)) continue;
    const card = await getCard(slug);
    if (!card || card.sample) continue;
    seen.add(slug);
    urls.push({ url: `${SITE}${ideaHref(slug)}`, lastModified: card.evidence.updatedAt, changeFrequency: "weekly", priority: 0.7 });
  }
  return urls;
}
