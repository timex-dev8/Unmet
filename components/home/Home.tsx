"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import ProductThumb from "@/components/card/ProductThumb";
import SaveButton from "@/components/card/SaveButton";
import DepthPicker from "@/components/research/DepthPicker";
import { useLowOnly } from "@/lib/auth";
import { loadCard } from "@/lib/card-action";
import { type HomeIdea, type HomeProduct, trendingPicks } from "@/lib/home";
import { useInterests } from "@/lib/interests";
import { forYou, profileKeywords } from "@/lib/rank";
import type { Depth } from "@/lib/research-types";
import { useSaved } from "@/lib/saved";
import { Niches } from "./Interests";
import s from "./home.module.css";

export default function Home({ cards, products = [] }: { cards: HomeIdea[]; products?: HomeProduct[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [depth, setDepth] = useState<Depth>("medium");
  const { saved } = useSaved();
  const { interests } = useInterests();
  const lowOnly = useLowOnly();

  const picks = forYou(cards, { picked: interests.picked, skipped: interests.skipped, saved, keywords: profileKeywords(interests) });
  // "For you" mixes in one real product that's working, for inspiration (lib/products)
  const product = products[0];
  const shown = product ? picks.slice(0, 2) : picks;
  // "Trending products" skips the one already shown above
  const trending = trendingPicks(products.slice(1));

  function start(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (q) router.push(`/app/research?q=${encodeURIComponent(q)}&depth=${lowOnly ? "low" : depth}`);
  }

  return (
    <main className={s.home} data-wash>
      <section className={`${s.hero} rise`}>
        <h1 className={s.title}>What do you want to explore?</h1>
        <p className={s.lede}>Name a market or a product. Unmet finds what people complain about and turns it into ideas worth building.</p>
        <form className={s.composer} onSubmit={start}>
          <label htmlFor="home-q" className="sr-only">
            Describe a market or audience
          </label>
          <input
            id="home-q"
            className={s.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Like “barbershops” or “Calendly”"
            autoComplete="off"
            enterKeyHint="go"
          />
          <DepthPicker value={depth} onChange={setDepth} />
          <button type="submit" className={s.send} disabled={!input.trim()} aria-label="Start research">
            <ArrowUp size={20} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </form>
      </section>

      <section className="rise" style={stagger(2)} aria-labelledby="niches-title">
        <h2 id="niches-title" className={`fade-text ${s.h2} ${s.nichesTitle}`}>
          Your niches
        </h2>
        <Niches />
      </section>

      <section aria-labelledby="for-you">
        <div className={s.sectionHead}>
          <h2 id="for-you" className={`fade-text ${s.h2}`}>
            For you
          </h2>
        </div>
        <div className={s.cards}>
          {shown.map((card, i) => (
            <HomeCard key={card.slug} card={card} i={i + 2} />
          ))}
          {product && <HomeProduct product={product} i={shown.length + 2} />}
        </div>
      </section>

      {trending.length > 0 && (
        <section aria-labelledby="trending">
          <div className={s.sectionHead}>
            <h2 id="trending" className={`fade-text ${s.h2}`}>
              Trending products
            </h2>
            <Link href="/app/feed" className={s.more}>
              See all<span className={s.moreFeed}> in Feed</span> →
            </Link>
          </div>
          <div className={s.trending}>
            {trending.map((p, i) => (
              <TrendingCard key={p.slug} product={p} i={i + 4} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/** Delay for the shared `.rise` entrance (40ms per step, see globals.css). */
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

const VERDICT = { strong: "Strong opportunity", maybe: "Worth a closer look", weak: "Weak signal so far" } as const;

function HomeCard({ card, i }: { card: HomeIdea; i: number }) {
  const e = card.evidence;
  const sites = card.sites;
  return (
    <article className={`${s.card} rise`} style={stagger(i)}>
      <div className={s.cardBody}>
        <span className={s.meta}>
          {card.category}
          {card.trend === "rising" ? " · ↑ Rising" : ""}
        </span>
        <h3 className={s.cardTitle}>
          <Link href={`/app/idea/${card.slug}`}>{card.headline}</Link>
        </h3>
        <p className={s.evidence}>
          {e.threads ? `${e.threads} sources on ${sites} ${sites === 1 ? "site" : "sites"}` : `${e.posts} mentions · ${e.site}`}
          {card.verdict ? ` · ${VERDICT[card.verdict]}` : ""}
          {card.sample ? " · sample" : ""}
        </p>
        <div className={s.cardActions}>
          <SaveButton card={card} load={loadCard} small />
          <Link href={`/app/idea/${card.slug}`} className={s.more}>
            See ideas →
          </Link>
        </div>
      </div>
    </article>
  );
}

function HomeProduct({ product, i }: { product: HomeProduct; i: number }) {
  const gaps = `/app/research?q=${encodeURIComponent(`What do people hate about ${product.name}?`)}`;
  return (
    <article className={`${s.card} rise`} style={stagger(i)}>
      <div className={s.cardBody}>
        <span className={`${s.meta} ${s.metaWorking}`}>Working · {product.category}</span>
        <h3 className={s.cardTitle}>
          <a href={product.url} target="_blank" rel="noopener noreferrer">
            {product.name}
          </a>
        </h3>
        <p className={s.productLine}>{product.oneLine}</p>
        {product.proof[0] && <p className={s.evidence}>{product.proof[0].label}</p>}
        <div className={s.cardActions}>
          <Link href={gaps} className={s.more}>
            Find its gaps →
          </Link>
        </div>
      </div>
    </article>
  );
}

function TrendingCard({ product, i }: { product: HomeProduct; i: number }) {
  const gaps = `/app/research?q=${encodeURIComponent(`What do people hate about ${product.name}?`)}`;
  const proof = product.proof[0];
  return (
    <article className={`${s.trendCard} rise`} style={stagger(i)}>
      <div className={s.trendTop}>
        <ProductThumb product={product} />
        <span className={s.trendSource}>{product.source}</span>
      </div>
      <h3 className={s.trendName}>
        <a href={product.url} target="_blank" rel="noopener noreferrer">
          {product.name}
        </a>
      </h3>
      <p className={s.trendLine}>{product.oneLine}</p>
      {proof && (
        <a href={proof.url} target="_blank" rel="noopener noreferrer" className={s.trendChip}>
          {proof.label}
        </a>
      )}
      <Link href={gaps} className={`${s.more} ${s.trendGaps}`}>
        Find its gaps →
      </Link>
    </article>
  );
}
