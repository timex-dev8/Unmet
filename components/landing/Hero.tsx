import Link from "next/link";
import { ArrowRight } from "lucide-react";
import s from "./landing.module.css";

// Full-bleed navy hero. Behind the headline: a slow wall of real complaint quotes from the feed,
// so the first thing people see is the product's raw material, not a stock photo.
export default function Hero({ quotes, liveCount }: { quotes: string[]; liveCount: number | null }) {
  const rows = [quotes.filter((_, i) => i % 3 === 0), quotes.filter((_, i) => i % 3 === 1), quotes.filter((_, i) => i % 3 === 2)];
  return (
    <header className={s.hero}>
      <div className={s.wall} aria-hidden="true">
        {rows.map((row, r) => (
          <div key={r} className={`${s.wallRow} ${r % 2 ? s.wallReverse : ""}`}>
            {/* Two copies, so the strip loops without a gap */}
            {[...row, ...row].map((q, i) => (
              <span key={i} className={s.wallQuote}>
                “{q}”
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className={s.heroInner}>
        <p className={s.eyebrow}>{liveCount ? `${liveCount} problems with proof, found from real posts` : "Startup ideas from real complaints"}</p>
        <h1 className={s.h1}>Build what people are already asking for.</h1>
        <p className={s.lede}>
          Unmet reads thousands of real complaints across the web, finds the ones that keep coming back, and tells you if they’re worth building, with
          the proof.
        </p>
        <div className={s.ctas}>
          <Link href="/welcome" className={s.ctaPrimary}>
            Find your first idea, free
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <a href="#example" className={s.ctaGhost}>
            See an example
          </a>
        </div>
        <p className={s.heroNote}>No account needed to start.</p>
      </div>
    </header>
  );
}
