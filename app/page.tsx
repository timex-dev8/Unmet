import Hero from "@/components/landing/Hero";
import Nav from "@/components/landing/Nav";
import { Closing, Faq, HowItWorks, Pricing, RecentProblems, SourceStrip } from "@/components/landing/Sections";
import JsonLd from "@/components/seo/JsonLd";
import { getAllCards, getAllSlugs } from "@/lib/cards";
import { readFeed } from "@/lib/feed";

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

// The hero preview is a real answer from the live feed when there is one.
export default async function Landing() {
  const live = await readFeed();
  const example = live.find((c) => c.report && (c.ideas?.length ?? 0) >= 2) ?? live.find((c) => c.report) ?? null;
  // Without a live example, "See an example" opens a real sample idea page.
  const fallbackSlug = (await getAllSlugs())[0];
  // Live feed cards first, topped up with the samples.
  const recent = (await getAllCards()).slice(0, 6);

  return (
    <div data-landing>
      <JsonLd data={STRUCTURED_DATA} />
      <Nav />
      <main>
        <Hero example={example} fallbackSlug={fallbackSlug} />
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
