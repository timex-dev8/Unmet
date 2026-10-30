import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import WorthBuilding from "@/components/idea/WorthBuilding";
import { LogoMark } from "@/components/Logo";
import { LENS_LABEL } from "@/lib/lenses";
import type { Card } from "@/lib/types";
import s from "./landing.module.css";

const SOURCES = ["Hacker News", "Stack Exchange", "App Store reviews", "GitHub issues", "Bluesky", "Community forums", "The open web"];

export function SourceStrip() {
  return (
    <section className={s.sources} aria-label="Where Unmet looks">
      <p>Reads what people write in public</p>
      <ul>
        {SOURCES.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  {
    title: "Name a market or a product",
    text: "“Wedding photographers.” “Dental clinics.” “What people hate about Calendly.” Plain words are enough.",
  },
  {
    title: "Unmet reads and checks",
    text: "It searches forums, reviews, Q&A and posts from the last year, keeps first-hand complaints, and checks every quote against its source.",
  },
  {
    title: "Get a verdict and ideas",
    text: "Each problem gets a “worth building?” verdict from the evidence, and product ideas that cite the complaints they solve.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className={s.section}>
      <p className={s.kicker}>How it works</p>
      <h2 className={s.h2}>From a hunch to a problem with proof, in about a minute.</h2>
      <ol className={s.steps}>
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <span className={s.stepNum}>{i + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// A real report from the live feed, not a mock-up.
export function Example({ card }: { card: Card }) {
  const ideas = (card.ideas ?? []).slice(0, 2);
  return (
    <section id="example" className={`${s.section} ${s.exampleSection}`}>
      <p className={s.kicker}>A real example, from this week’s feed</p>
      <h2 className={s.h2}>{card.headline}</h2>
      <p className={s.exampleWho}>
        {card.evidence.threads} sources · {card.who}
      </p>

      <div className={s.exampleGrid}>
        <div className={s.examplePanel}>{card.report && <WorthBuilding report={card.report} />}</div>
        <div className={s.exampleIdeas}>
          {ideas.map((idea) => (
            <article key={idea.title} className={s.miniIdea}>
              <span className={s.miniLens}>{LENS_LABEL[idea.lens]}</span>
              <h3>{idea.title}</h3>
              <p>{idea.pitch}</p>
              <dl>
                <div>
                  <dt>Who pays</dt>
                  <dd>{idea.whoPays}</dd>
                </div>
                <div>
                  <dt>First version</dt>
                  <dd>{idea.mvp}</dd>
                </div>
              </dl>
              {idea.evidence[0] && <q>{idea.evidence[0]}</q>}
            </article>
          ))}
          <Link href={`/app/idea/${card.slug}`} className={s.exampleLink}>
            Open the full report, with every source
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

const DIFFERENT = [
  {
    title: "Every claim links to a real post",
    text: "Quotes are checked word for word against the page they came from. If it can’t be traced, it isn’t shown.",
  },
  {
    title: "Ideas cite the complaints they solve",
    text: "No idea from thin air: each one points to the people it would help, and where to find the first ten.",
  },
  {
    title: "Checked against what already exists",
    text: "Before an idea reaches you, Unmet looks for products that already do it, and tells you the gap.",
  },
];

export function Different() {
  return (
    <section className={s.section}>
      <p className={s.kicker}>Why trust it</p>
      <h2 className={s.h2}>Evidence first. Opinions clearly labeled.</h2>
      <div className={s.trio}>
        {DIFFERENT.map((d) => (
          <div key={d.title}>
            <h3>{d.title}</h3>
            <p>{d.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const PLANS = [
  {
    name: "Guest",
    price: "Free",
    note: "No account",
    items: ["The live feed of problems", "“Worth building?” reports and ideas", "Quick research (Low depth)", "Saved on this device"],
    cta: "Try it now",
  },
  {
    name: "Account",
    price: "Free",
    note: "Email and password, or a link",
    items: ["Everything in Guest", "Deeper research: Medium and High", "Competitor check with verified revenue", "Synced on every device"],
    cta: "Create a free account",
    featured: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className={s.section}>
      <p className={s.kicker}>Pricing</p>
      <h2 className={s.h2}>Free while we build it with you.</h2>
      <div className={s.plans}>
        {PLANS.map((p) => (
          <div key={p.name} className={`${s.plan} ${p.featured ? s.planFeatured : ""}`}>
            <p className={s.planName}>{p.name}</p>
            <p className={s.planPrice}>{p.price}</p>
            <p className={s.planNote}>{p.note}</p>
            <ul>
              {p.items.map((i) => (
                <li key={i}>
                  <Check size={16} aria-hidden="true" />
                  {i}
                </li>
              ))}
            </ul>
            <Link href="/welcome" className={p.featured ? s.planCtaPrimary : s.planCta}>
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "Where does the data come from?",
    a: "Public posts: Hacker News, Stack Exchange, App Store reviews, GitHub issues, Bluesky, community forums and the open web, from the last 12 months. Every card links back to the original posts.",
  },
  {
    q: "Do you use Reddit?",
    a: "Not directly. Unmet doesn’t scrape Reddit or use resellers of its data. If a Reddit thread shows up in normal web results, it can be read like any other page.",
  },
  {
    q: "Is it really free?",
    a: "Yes, for now. Guests get quick research; a free account adds deeper research and sync. If paid plans come later, what’s free today stays free.",
  },
  {
    q: "What’s an “early signal”?",
    a: "A problem backed by only two sources. It might be real, but it isn’t proven yet, so it’s labeled and never reaches the public feed.",
  },
  {
    q: "Are the ideas AI-generated?",
    a: "The ideas are, and they’re labeled. The evidence isn’t: complaints are real posts with checked quotes, and the “worth building?” verdict is computed from them.",
  },
];

export function Faq() {
  return (
    <section id="faq" className={s.section}>
      <p className={s.kicker}>Questions</p>
      <h2 className={s.h2}>Good questions to ask a tool like this.</h2>
      <div className={s.faq}>
        {FAQ.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section className={s.closing}>
      <h2 className={s.closingTitle}>Your next idea is already out there. Someone just complained about it.</h2>
      <Link href="/welcome" className={s.ctaPrimary}>
        Find it, free
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={s.footer}>
      <span className={s.footerBrand}>
        <LogoMark tone="light" size={22} /> Unmet
      </span>
      <span>Ideas from real complaints, with the proof.</span>
      <nav aria-label="Footer">
        <a href="#how">How it works</a>
        <a href="#pricing">Pricing</a>
        <Link href="/welcome">Sign in</Link>
      </nav>
    </footer>
  );
}
