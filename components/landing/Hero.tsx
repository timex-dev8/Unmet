import Link from "next/link";
import { ArrowRight, Check, Lightbulb, MessageSquare, Search, Smile, Star, TrendingUp } from "lucide-react";
import { ideaHref } from "@/lib/links";
import GlassTile from "./GlassTile";
import s from "./landing.module.css";

export type HeroExample = {
  query: string;
  quote: string | null;
  idea: string | null;
  proof: { slug: string; count: number } | null;
};

export default function Hero({ example }: { example: HeroExample }) {
  return (
    <header className={s.hero}>
      <div className={s.clouds} aria-hidden="true" />

      <div className={s.floats}>
        <GlassTile icon={MessageSquare} size={88} strokeWidth={1.7} className={`${s.float} ${s.f1}`} />
        <GlassTile icon={Star} size={56} tone="b1" className={`${s.float} ${s.float2} ${s.f2}`} />
        <GlassTile icon={Smile} size={72} tone="b2" strokeWidth={1.7} className={`${s.float} ${s.float2} ${s.f3}`} />
        <GlassTile icon={Lightbulb} size={72} tone="b2" strokeWidth={1.7} className={`${s.float} ${s.float2} ${s.f4}`} />
        <GlassTile icon={Check} size={56} line strokeWidth={2.2} className={`${s.float} ${s.f5}`} />
        <GlassTile icon={TrendingUp} size={88} tone="b1" line strokeWidth={1.7} className={`${s.float} ${s.f6}`} />
      </div>

      <div className={s.heroInner}>
        <h1 className={s.h1}>
          Code doesn’t make you money. The right{" "}
          <span className={s.ideaTile} aria-hidden="true">
            <Lightbulb strokeWidth={1.8} />
          </span>{" "}
          idea does.
        </h1>
        <p className={s.lede}>See what people complain about, and whether it’s worth building.</p>
        <Link href="/welcome/try" className={`glossy ${s.btn} ${s.cta}`}>
          Find your first idea
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <div className={s.row}>
        <GlassTile icon={MessageSquare} size={56} tone="b2" className={s.r1} />
        <GlassTile icon={TrendingUp} size={72} tone="b1" line strokeWidth={2} className={s.r2} />
        <GlassTile icon={Star} size={56} className={s.r3} />
      </div>

      <ExampleCard example={example} />
    </header>
  );
}

function ExampleCard({ example }: { example: HeroExample }) {
  const { query, quote, idea, proof } = example;
  return (
    <figure className={s.card} aria-label="An example answer from Unmet">
      <p className={s.search}>
        <Search strokeWidth={2} aria-hidden="true" />
        <span>{query}</span>
      </p>
      {quote && (
        <>
          <p className={s.cardLabel}>People are saying</p>
          <p className={s.quote}>“{quote}”</p>
        </>
      )}
      {idea && (
        <>
          <p className={`${s.cardLabel} ${quote ? s.cardGap : ""}`}>You could build</p>
          <p className={s.idea}>{idea}</p>
        </>
      )}
      {proof && (
        <p className={s.proof}>
          Found in {proof.count} {proof.count === 1 ? "place" : "places"}
          <Link href={ideaHref(proof.slug)}>See the proof</Link>
        </p>
      )}
    </figure>
  );
}
