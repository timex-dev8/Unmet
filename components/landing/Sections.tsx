import Link from "next/link";
import { ChartNoAxesColumn, Layers, MessageSquare, Search } from "lucide-react";
import s from "./landing.module.css";

export function SourceStrip() {
  const soon = ["Product Hunt", "Google Trends", "App reviews"];
  return (
    <div className={s.strip}>
      <div className={s.stripInner}>
        <span className={s.stripLabel}>Pulled from</span>
        <span>Hacker News</span>
        {soon.map((name) => (
          <span key={name} className={s.dim}>
            {name}
            <span className={s.soon}>Soon</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const steps = [
  { Icon: MessageSquare, title: "We listen", text: "Public posts where people say what’s broken." },
  { Icon: Layers, title: "We group", text: "Similar complaints become one problem." },
  { Icon: ChartNoAxesColumn, title: "You decide", text: "Each idea is scored, with every source linked." },
];

export function HowItWorks() {
  return (
    <section id="how" className={s.section}>
      <h2 className={s.h2}>Many complaints become one idea.</h2>
      <div className={s.steps}>
        {steps.map(({ Icon, title, text }) => (
          <div key={title} className={s.step}>
            <div className={s.stepIcon}>
              <Icon size={24} aria-hidden="true" />
            </div>
            <h3 className={s.stepTitle}>{title}</h3>
            <p className={s.stepText}>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section id="features" className={s.features}>
      <div className={s.featuresInner}>
        <h2 className={s.h2}>Everything starts with a swipe.</h2>
        <div className={s.grid}>
          <div className={`${s.tile} ${s.wide}`}>
            <h3 className={s.tileTitle}>Swipe feed</h3>
            <p className={s.tileText}>One problem per screen. Swipe right to save.</p>
            <div className={s.stack} aria-hidden="true">
              <div />
              <div />
              <div>Renters can’t dispute deposit fees</div>
            </div>
          </div>
          <div className={`${s.tile} ${s.narrow}`}>
            <h3 className={s.tileTitle}>Search</h3>
            <p className={s.tileText}>Describe it in your own words.</p>
            <div className={s.search} aria-hidden="true">
              <Search size={18} />
              people who hate commuting
            </div>
          </div>
        </div>
        <div className={s.grid}>
          <div className={`${s.tile} ${s.narrow}`}>
            <h3 className={s.tileTitle}>Research with AI</h3>
            <p className={s.tileText}>Describe a market. Get real complaints, grouped into ideas, with sources.</p>
            <Link href="/app/research" className={s.tileLink}>
              Try it →
            </Link>
          </div>
          <div className={`${s.tile} ${s.wide}`}>
            <h3 className={s.tileTitle}>
              Validate my idea <span className={s.badge}>Premium</span>
            </h3>
            <p className={s.tileText}>Paste your idea. See if it’s worth building.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className={s.section}>
      <h2 className={s.h2}>Browse free. Pay when you build.</h2>
      <div className={s.plans}>
        <div className={s.plan}>
          <h3 className={s.planName}>Free</h3>
          <div className={s.price}>$0</div>
          <ul className={s.perks}>
            <li>Unlimited feed</li>
            <li>A few saves</li>
            <li>Basic search</li>
          </ul>
          <Link href="/app" className={`pill pill-blue ${s.full}`}>
            Open Unmet
          </Link>
        </div>
        <div className={`${s.plan} ${s.planPremium}`}>
          <h3 className={s.planName}>Premium</h3>
          <div className={s.price}>
            $9<small> a month</small>
          </div>
          <ul className={s.perks}>
            <li>Unlimited saves and chat</li>
            <li>Idea validation reports</li>
            <li>Weekly digest</li>
          </ul>
          {/* No payments in the demo; becomes a waitlist form once Supabase is connected. */}
          <span className={`pill pill-white ${s.full} ${s.disabled}`} aria-disabled="true">
            Waitlist opens soon
          </span>
        </div>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <div className={s.closingWrap}>
      <div className={s.closing}>
        <h2 className={s.closingTitle}>Your next idea is one swipe away.</h2>
        <Link href="/app" className="pill pill-white">
          Open Unmet
        </Link>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className={s.footer}>
      <div className={s.footerInner}>
        <span>© 2026 Unmet</span>
        <span>Built from public Hacker News posts. Every card links to its sources.</span>
      </div>
    </footer>
  );
}
