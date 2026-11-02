import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { ideaHref } from "@/lib/links";
import type { Card } from "@/lib/types";
import s from "./landing.module.css";

const SOURCES = ["Hacker News", "Stack Exchange", "App Store reviews", "GitHub issues", "Bluesky", "Community forums"];

export function SourceStrip() {
  return (
    <section className={s.sources} aria-label="Where Unmet looks">
      <p className={s.label}>Reads what people write in public</p>
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
    title: "Name a market",
    text: "“Wedding photographers” or “Calendly”.",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
  },
  {
    title: "We read real posts",
    text: "Complaints from public posts, reviews and issues.",
    icon: (
      <>
        <path d="M4 6h16M4 12h10M4 18h7" />
        <path d="m15 17 2 2 4-4" />
      </>
    ),
  },
  {
    title: "Get ideas worth building",
    text: "A clear verdict, and products to make.",
    icon: (
      <>
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2.2h5c.1-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z" />
      </>
    ),
  },
];

const NOTES = [
  { lead: "Ideas cite their complaints.", text: "Each one points to the people it helps and where to find the first ten." },
  { lead: "Checked against what exists.", text: "Unmet looks for products that already do it, and names the gap." },
];

export function HowItWorks() {
  return (
    <section id="how" className={s.section}>
      <h2 className={`fade-text ${s.h2}`}>From a hunch to a problem with proof</h2>
      <p className={s.sub}>About a minute, and every claim links to a real post.</p>
      <ol className={s.steps}>
        {STEPS.map((step) => (
          <li key={step.title} className={s.step}>
            <span className={s.icon} aria-hidden="true">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {step.icon}
              </svg>
            </span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
      <div className={s.notes}>
        {NOTES.map((n) => (
          <p key={n.lead} className={s.cap}>
            <b>{n.lead}</b> {n.text}
          </p>
        ))}
      </div>
    </section>
  );
}

// A quiet list of real problems: gives visitors (and search engines) a way into the idea pages.
export function RecentProblems({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null;
  return (
    <section id="problems" className={s.section}>
      <h2 className={`fade-text ${s.h2}`}>Recent problems</h2>
      <p className={s.sub}>A few of the complaints Unmet has read lately, each with its sources.</p>
      <ul className={s.problems}>
        {cards.map((c) => (
          <li key={c.slug}>
            <Link href={ideaHref(c.slug)}>{c.headline}</Link>
            <span>{c.category}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PLANS = [
  {
    name: "Guest",
    note: "No account",
    items: ["The live feed and every report", "Quick research", "Saved on this device"],
    cta: "Try it now",
  },
  {
    name: "Account",
    note: "Email and password",
    items: ["Everything in Guest", "Deeper research: Deep and Deepest", "Synced on every device"],
    cta: "Create a free account",
    featured: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className={s.section}>
      <h2 className={`fade-text ${s.h2}`}>Free while we build it with you</h2>
      <div className={s.plans}>
        {PLANS.map((p) => (
          <div key={p.name} className={`${s.plan} ${p.featured ? s.planBlue : s.planMist}`}>
            <p className={s.planName}>{p.name}</p>
            <p className={s.planPrice}>Free</p>
            <p className={s.planNote}>{p.note}</p>
            <ul>
              {p.items.map((i) => (
                <li key={i}>
                  <Check size={17} aria-hidden="true" />
                  {i}
                </li>
              ))}
            </ul>
            <Link href="/welcome" className={s.planCta}>
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
      <h2 className={`fade-text ${s.h2}`}>Questions</h2>
      <div className={s.faq}>
        {FAQ.map((f) => (
          <details key={f.q}>
            <summary>
              {f.q}
              <Plus size={22} aria-hidden="true" />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// The sky comes back at the end, fading up from white.
export function Closing() {
  return (
    <footer className={s.closing}>
      <h2 className={s.closingTitle}>Don’t spend months on the wrong idea.</h2>
      <p className={s.closingSub}>Start with what people already complain about.</p>
      <Link href="/welcome" className={`glossy ${s.btn}`}>
        Find my idea, free
      </Link>
      <nav aria-label="Footer" className={s.footer}>
        <span>Unmet · Ideas from real complaints, with the proof</span>
        <span className={s.footerLinks}>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link href="/welcome">Sign in</Link>
        </span>
      </nav>
    </footer>
  );
}
