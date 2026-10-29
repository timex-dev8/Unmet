import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import { Closing, Features, Footer, HowItWorks, Pricing, SourceStrip } from "@/components/landing/Sections";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <SourceStrip />
        <HowItWorks />
        <Features />
        <Pricing />
        <Closing />
      </main>
      <Footer />
    </>
  );
}
