import Hero from "@/components/landing/Hero";
import Nav from "@/components/landing/Nav";
import { Closing, Faq, HowItWorks, Pricing, SourceStrip, Trust } from "@/components/landing/Sections";
import { readFeed } from "@/lib/feed";

// The hero preview is a real answer from the live feed when there is one.
export default async function Landing() {
  const live = await readFeed();
  const example = live.find((c) => c.report && (c.ideas?.length ?? 0) >= 2) ?? live.find((c) => c.report) ?? null;

  return (
    <div data-landing>
      <Nav />
      <main>
        <Hero example={example} />
        <SourceStrip />
        <HowItWorks />
        <Trust />
        <Pricing />
        <Faq />
      </main>
      <Closing />
    </div>
  );
}
