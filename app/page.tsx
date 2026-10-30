import Hero from "@/components/landing/Hero";
import Nav from "@/components/landing/Nav";
import { Closing, Different, Example, Faq, Footer, HowItWorks, Pricing, SourceStrip } from "@/components/landing/Sections";
import { getAllCards } from "@/lib/cards";
import { readFeed } from "@/lib/feed";

// The landing page shows the product's own evidence: real complaint quotes behind the hero,
// a real "worth building?" report as the example, and a live count only when it's real.
export default async function Landing() {
  const [cards, live] = await Promise.all([getAllCards(), readFeed()]);
  const quotes = [...new Set(cards.flatMap((c) => [c.quote, ...(c.ideas ?? []).flatMap((i) => i.evidence)]).filter((q) => q && q.length > 18))].slice(
    0,
    28,
  );
  const example = live.find((c) => c.report && (c.ideas?.length ?? 0) >= 2) ?? live.find((c) => c.report);

  return (
    <div data-landing>
      <Nav />
      <main>
        <Hero quotes={quotes} liveCount={live.length >= 10 ? live.length : null} />
        <SourceStrip />
        <HowItWorks />
        {example && <Example card={example} />}
        <Different />
        <Pricing />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
