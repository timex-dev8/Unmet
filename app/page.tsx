import Hero, { type HeroExample } from "@/components/landing/Hero";
import Nav from "@/components/landing/Nav";
import { Closing, Faq, HowItWorks, Pricing, RecentProblems, SourceStrip } from "@/components/landing/Sections";
import JsonLd from "@/components/seo/JsonLd";
import { getAllCards, getCard } from "@/lib/cards";
import { readFeed } from "@/lib/feed";
import { slugify } from "@/lib/text";
import type { Card } from "@/lib/types";

const SITE = "https://unmet-ten.vercel.app";

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE}/#organization`,
    name: "Unmet",
    url: SITE,
    logo: `${SITE}/icon.svg`,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    name: "Unmet",
    url: SITE,
    description: "Unmet reads real complaints across the web and tells you which ones are worth building, with the proof.",
    publisher: { "@id": `${SITE}/#organization` },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Unmet",
    url: SITE,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Startup ideas from real complaints, with proof: every claim links to a real post.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  },
];

// The hero shows one real card. The card holds neither the search that found it nor a one-line idea, so
// those two are written by hand and used only for this card. The slug is derived from the headline with
// slugify; live cards add a random suffix, so the card is also found by its exact headline.
const PINNED_HEADLINE = "ADHD users face task paralysis from complex app setup";
const PINNED_SLUG = slugify(PINNED_HEADLINE);
const PINNED_TOPIC = "Apps for people who struggle with management";
const PINNED_IDEA = "A simple task timer with no setup";

// Without a real card, the sample question and idea, and no quote or count.
const SAMPLE: HeroExample = { query: "What do people hate about Calendly?", quote: null, idea: "A flat-price scheduler", proof: null };

const proofOf = (card: Card) => (card.sources.length > 0 ? { slug: card.slug, count: card.sources.length } : null);

async function heroExample(live: Card[]): Promise<HeroExample> {
  const pinned = (await getCard(PINNED_SLUG)) ?? live.find((c) => c.headline === PINNED_HEADLINE);
  if (pinned?.quote) return { query: PINNED_TOPIC, quote: pinned.quote, idea: PINNED_IDEA, proof: proofOf(pinned) };

  const card = live.find((c) => c.report && (c.ideas?.length ?? 0) >= 2) ?? live.find((c) => c.report);
  if (card?.query && card.quote) return { query: card.query, quote: card.quote, idea: card.ideas?.[0]?.title ?? null, proof: proofOf(card) };
  return SAMPLE;
}

export default async function Landing() {
  const live = await readFeed();
  const example = await heroExample(live);
  const recent = (await getAllCards()).slice(0, 3);

  return (
    <div data-landing>
      <JsonLd data={STRUCTURED_DATA} />
      <Nav />
      <main>
        <Hero example={example} />
        <SourceStrip />
        <RecentProblems cards={recent} />
        <HowItWorks />
        <Pricing />
        <Faq />
      </main>
      <Closing />
    </div>
  );
}
