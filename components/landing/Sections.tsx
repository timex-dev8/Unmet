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
import styles from "./landing.module.css";

function Tile({ children, className, pearl, fill }: { children: ReactNode; className?: string; pearl?: boolean; fill?: boolean }) {
  return (
    <span className={`${styles.tile} ${pearl ? styles.pearl : ""} ${fill ? styles.tileFill : ""} ${className ?? ""}`} aria-hidden="true">
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
    <section className={`${styles.section} ${styles.sourcesSection}`} aria-label="Where Unmet looks">
      <ul className={styles.sources}>
        {SOURCES.map(({ name, icon: Icon, fill }) => (
          <li key={name}>
            <Tile pearl fill={fill} className={styles.sourceTile}>
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
    <section id="how" className={styles.section}>
      <h2 className={styles.h2}>How it works</h2>
      <ol className={styles.steps}>
        <li className={styles.step}>
          <div className={`${styles.pic} ${styles.picSearch}`} aria-hidden="true">
            <Tile pearl>
              <Search strokeWidth={2} />
            </Tile>
            <div className={styles.pill}>Wedding photographers</div>
          </div>
          <h3>Name a market</h3>
        </li>
        <li className={styles.step}>
          <div className={`${styles.pic} ${styles.picRead}`} aria-hidden="true">
            <div className={styles.cluster}>
              <GlassTile icon={MessageSquare} size={56} tone="gb" className={styles.rMsg} />
              <GlassTile icon={Check} size={72} tone="gb" line strokeWidth={2.2} className={styles.rCheck} />
              <GlassTile icon={Star} size={56} tone="gb" className={styles.rStar} />
            </div>
          </div>
          <h3>We read real posts</h3>
        </li>
        <li className={styles.step}>
          <div className={`${styles.pic} ${styles.picIdeas}`} aria-hidden="true">
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
    <section id="problems" className={`${styles.section} ${styles.problemsSection}`}>
      <h2 className={styles.h2}>Latest problems we found</h2>
      <ul className={styles.problems}>
        {cards.map((card) => {
          const Icon = CATEGORY_ICON[card.category] ?? MessageSquare;
          return (
            <li key={card.slug}>
              <Link href={ideaHref(card.slug)} className={styles.problem}>
                <Tile className={styles.problemTile}>
                  <Icon strokeWidth={1.8} />
                </Tile>
                <span className={styles.problemText}>{card.headline}</span>
                <ArrowRight className={styles.arrow} size={20} strokeWidth={2} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/app/feed" className={styles.all}>
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
    <section id="pricing" className={styles.section}>
      <h2 className={styles.h2}>Free while we build it with you</h2>
      <div className={styles.plans}>
        {PLANS.map((plan) => (
          <div key={plan.name} className={`${styles.plan} ${plan.featured ? styles.planBlue : styles.planMist}`}>
            <p className={styles.planName}>{plan.name}</p>
            <p className={styles.planPrice}>Free</p>
            <p className={styles.planNote}>{plan.note}</p>
            <ul>
              {plan.items.map((item) => (
                <li key={item}>
                  <Check size={17} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/welcome" className={styles.planCta}>
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className={`${styles.section} ${styles.faqSection}`}>
      <h2 className={styles.h2}>Questions</h2>
      <FaqList />
    </section>
  );
}

export function Closing() {
  return (
    <footer className={styles.closing}>
      <div className={styles.closingTiles}>
        <GlassTile icon={MessageSquare} size={56} className={`${styles.closingSide} ${styles.c1}`} />
        <GlassTile icon={Lightbulb} size={72} tone="b1" strokeWidth={1.7} className={styles.c2} />
        <GlassTile icon={TrendingUp} size={56} line className={`${styles.closingSide} ${styles.c3}`} />
      </div>
      <h2 className={styles.closingTitle}>Don’t spend months on the wrong idea.</h2>
      <Link href="/welcome/try" className={`glossy ${styles.btn}`}>
        Find my idea, free
      </Link>
      <nav aria-label="Footer" className={styles.footer}>
        <span>Unmet · Ideas from real complaints, with the proof</span>
        <span className={styles.footerLinks}>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link href="/welcome">Sign in</Link>
        </span>
      </nav>
    </footer>
  );
}
