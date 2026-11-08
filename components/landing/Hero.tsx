import Link from "next/link";
import { ArrowRight, Check, Lightbulb, MessageSquare, Search, Smile, Star, TrendingUp } from "lucide-react";
import { ideaHref } from "@/lib/links";
import GlassTile from "./GlassTile";
import styles from "./landing.module.css";

export type HeroExample = {
  query: string;
  quote: string | null;
  idea: string | null;
  proof: { slug: string; count: number } | null;
};

export default function Hero({ example }: { example: HeroExample }) {
  return (
    <header className={styles.hero}>
      <div className={styles.clouds} aria-hidden="true" />

      <div className={styles.floats}>
        <GlassTile icon={MessageSquare} size={88} strokeWidth={1.7} className={`${styles.float} ${styles.f1}`} />
        <GlassTile icon={Star} size={56} tone="b1" className={`${styles.float} ${styles.float2} ${styles.f2}`} />
        <GlassTile icon={Smile} size={72} tone="b2" strokeWidth={1.7} className={`${styles.float} ${styles.float2} ${styles.f3}`} />
        <GlassTile icon={Lightbulb} size={72} tone="b2" strokeWidth={1.7} className={`${styles.float} ${styles.float2} ${styles.f4}`} />
        <GlassTile icon={Check} size={56} line strokeWidth={2.2} className={`${styles.float} ${styles.f5}`} />
        <GlassTile icon={TrendingUp} size={88} tone="b1" line strokeWidth={1.7} className={`${styles.float} ${styles.f6}`} />
      </div>

      <div className={styles.heroInner}>
        <h1 className={styles.h1}>
          Code doesn’t make you money. The right{" "}
          <span className={styles.ideaTile} aria-hidden="true">
            <Lightbulb strokeWidth={1.8} />
          </span>{" "}
          idea does.
        </h1>
        <p className={styles.lede}>See what people complain about, and whether it’s worth building.</p>
        <Link href="/welcome/try" className={`glossy ${styles.btn} ${styles.cta}`}>
          Find your first idea
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <div className={styles.row}>
        <GlassTile icon={MessageSquare} size={56} tone="b2" className={styles.r1} />
        <GlassTile icon={TrendingUp} size={72} tone="b1" line strokeWidth={2} className={styles.r2} />
        <GlassTile icon={Star} size={56} className={styles.r3} />
      </div>

      <ExampleCard example={example} />
    </header>
  );
}

function ExampleCard({ example }: { example: HeroExample }) {
  const { query, quote, idea, proof } = example;
  return (
    <figure className={styles.card} aria-label="An example answer from Unmet">
      <p className={styles.search}>
        <Search strokeWidth={2} aria-hidden="true" />
        <span>{query}</span>
      </p>
      {quote && (
        <>
          <p className={styles.cardLabel}>People are saying</p>
          <p className={styles.quote}>“{quote}”</p>
        </>
      )}
      {idea && (
        <>
          <p className={`${styles.cardLabel} ${quote ? styles.cardGap : ""}`}>You could build</p>
          <p className={styles.idea}>{idea}</p>
        </>
      )}
      {proof && (
        <p className={styles.proof}>
          Found in {proof.count} {proof.count === 1 ? "place" : "places"}
          <Link href={ideaHref(proof.slug)}>See the proof</Link>
        </p>
      )}
    </figure>
  );
}
