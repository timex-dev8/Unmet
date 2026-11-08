import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Bug,
  Check,
  CircleDollarSign,
  CircleQuestionMark,
  Code,
  HeartPulse,
  House,
  Lightbulb,
  ListTodo,
  MessageSquare,
  Search,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ideaHref } from "@/lib/links";
import type { Card } from "@/lib/types";
import FaqList from "./FaqList";
import GlassTile from "./GlassTile";
import s from "./landing.module.css";

function Tile({ children, className, pearl, fill }: { children: ReactNode; className?: string; pearl?: boolean; fill?: boolean }) {
  return (
    <span className={`${s.tile} ${pearl ? s.pearl : ""} ${fill ? s.tileFill : ""} ${className ?? ""}`} aria-hidden="true">
      {children}
    </span>
  );
}

const SOURCES: { name: string; icon: LucideIcon; fill?: boolean }[] = [
  { name: "Hacker News", icon: MessageSquare, fill: true },
  { name: "App Store reviews", icon: Star, fill: true },
  { name: "GitHub issues", icon: Bug, fill: true },
  { name: "Stack Exchange", icon: CircleQuestionMark },
  { name: "Community forums", icon: Users },
];

export function SourceStrip() {
  return (
    <section className={`${s.section} ${s.sourcesSection}`} aria-label="Where Unmet looks">
      <ul className={s.sources}>
        {SOURCES.map(({ name, icon: Icon, fill }) => (
          <li key={name}>
            <Tile pearl fill={fill} className={s.sourceTile}>
              <Icon strokeWidth={1.8} />
            </Tile>
            <p>{name}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className={s.section}>
      <h2 className={s.h2}>How it works</h2>
      <ol className={s.steps}>
        <li className={s.step}>
          <div className={`${s.pic} ${s.picSearch}`} aria-hidden="true">
            <Tile pearl>
              <Search strokeWidth={2} />
            </Tile>
            <div className={s.pill}>Wedding photographers</div>
          </div>
          <h3>Name a market</h3>
        </li>
        <li className={s.step}>
          <div className={`${s.pic} ${s.picRead}`} aria-hidden="true">
            <div className={s.cluster}>
              <GlassTile icon={MessageSquare} size={56} tone="gb" className={s.rMsg} />
              <GlassTile icon={Check} size={72} tone="gb" line strokeWidth={2.2} className={s.rCheck} />
              <GlassTile icon={Star} size={56} tone="gb" className={s.rStar} />
            </div>
          </div>
          <h3>We read real posts</h3>
        </li>
        <li className={s.step}>
          <div className={`${s.pic} ${s.picIdeas}`} aria-hidden="true">
            <GlassTile icon={Lightbulb} size={72} strokeWidth={1.6} />
          </div>
          <h3>Get ideas worth building</h3>
        </li>
      </ol>
    </section>
  );
}

const CATEGORY_ICON: Partial<Record<string, LucideIcon>> = {
  "Dev tools": Code,
  Productivity: ListTodo,
  Money: CircleDollarSign,
  Work: Briefcase,
  Health: HeartPulse,
  Home: House,
};

export function RecentProblems({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null;
  return (
    <section id="problems" className={`${s.section} ${s.problemsSection}`}>
      <h2 className={s.h2}>Latest problems we found</h2>
      <ul className={s.problems}>
        {cards.map((c) => {
          const Icon = CATEGORY_ICON[c.category] ?? MessageSquare;
          return (
            <li key={c.slug}>
              <Link href={ideaHref(c.slug)} className={s.problem}>
                <Tile className={s.problemTile}>
                  <Icon strokeWidth={1.8} />
                </Tile>
                <span className={s.problemText}>{c.headline}</span>
                <ArrowRight className={s.arrow} size={20} strokeWidth={2} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/app/feed" className={s.all}>
        See all problems
      </Link>
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
      <h2 className={s.h2}>Free while we build it with you</h2>
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

export function Faq() {
  return (
    <section id="faq" className={`${s.section} ${s.faqSection}`}>
      <h2 className={s.h2}>Questions</h2>
      <FaqList />
    </section>
  );
}

export function Closing() {
  return (
    <footer className={s.closing}>
      <div className={s.closingTiles}>
        <GlassTile icon={MessageSquare} size={56} className={`${s.closingSide} ${s.c1}`} />
        <GlassTile icon={Lightbulb} size={72} tone="b1" strokeWidth={1.7} className={s.c2} />
        <GlassTile icon={TrendingUp} size={56} line className={`${s.closingSide} ${s.c3}`} />
      </div>
      <h2 className={s.closingTitle}>Don’t spend months on the wrong idea.</h2>
      <Link href="/welcome/try" className={`glossy ${s.btn}`}>
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
