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
import { ideaHref, productResearchHref, researchHref } from "@/lib/links";
import { forYou, profileKeywords } from "@/lib/rank";
import type { Depth } from "@/lib/research-types";
import { useSaved } from "@/lib/saved";
import { categoryLabel } from "@/lib/types";
import { VERDICT } from "@/lib/verdict";
import { Niches } from "./Interests";
import styles from "./home.module.css";

export default function Home({ cards, products = [] }: { cards: HomeIdea[]; products?: HomeProduct[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [depth, setDepth] = useState<Depth>("medium");
  const { saved } = useSaved();
  const { interests } = useInterests();
  const lowOnly = useLowOnly();

  const picks = forYou(cards, { picked: interests.picked, skipped: interests.skipped, saved, keywords: profileKeywords(interests) });
  // "For you" gets one working product for inspiration
  const product = products[0];
  const shown = product ? picks.slice(0, 2) : picks;
  // trending skips the one shown above
  const trending = trendingPicks(products.slice(1));

  function start(e: FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (query) router.push(researchHref(query, lowOnly ? "low" : depth));
  }

  return (
    <main className={styles.home} data-wash>
      <section className={`${styles.hero} rise`}>
        <h1 className={styles.title}>What problem do you want to own?</h1>
        <p className={styles.lede}>Name a market or a product. Unmet finds what people complain about and turns it into ideas worth building.</p>
        <form className={styles.composer} onSubmit={start}>
          <label htmlFor="home-q" className="sr-only">
            Describe a market or audience
          </label>
          <input
            id="home-q"
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Like “barbershops” or “Calendly”"
            autoComplete="off"
            enterKeyHint="go"
          />
          <DepthPicker value={depth} onChange={setDepth} />
          <button type="submit" className="send-btn glossy" disabled={!input.trim()} aria-label="Start research">
            <ArrowUp size={20} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </form>
      </section>

      <section className="rise" style={stagger(2)} aria-labelledby="niches-title">
        <h2 id="niches-title" className={`fade-text ${styles.h2} ${styles.nichesTitle}`}>
          Your niches
        </h2>
        <Niches />
      </section>

      <section aria-labelledby="for-you">
        <div className={styles.sectionHead}>
          <h2 id="for-you" className={`fade-text ${styles.h2}`}>
            For you
          </h2>
        </div>
        <div className={styles.cards}>
          {shown.map((card, i) => (
            <HomeCard key={card.slug} card={card} index={i + 2} />
          ))}
          {product && <HomeProduct product={product} index={shown.length + 2} />}
        </div>
      </section>

      {trending.length > 0 && (
        <section aria-labelledby="trending">
          <div className={styles.sectionHead}>
            <h2 id="trending" className={`fade-text ${styles.h2}`}>
              Trending products
            </h2>
            <Link href="/app/feed" className={styles.more}>
              See all<span className={styles.moreFeed}> in Feed</span> →
            </Link>
          </div>
          <div className={styles.trending}>
            {trending.map((trendingProduct, i) => (
              <TrendingCard key={trendingProduct.slug} product={trendingProduct} index={i + 4} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

function HomeCard({ card, index }: { card: HomeIdea; index: number }) {
  const evidence = card.evidence;
  const sites = card.sites;
  return (
    <article className={`${styles.card} rise`} style={stagger(index)}>
      <div className={styles.cardBody}>
        <span className={styles.meta}>
          {categoryLabel(card.category)}
          {card.trend === "rising" ? " · ↑ Rising" : ""}
        </span>
        <h3 className={styles.cardTitle}>
          <Link href={ideaHref(card.slug)}>{card.headline}</Link>
        </h3>
        <p className={styles.evidence}>
          {evidence.threads
            ? `${evidence.threads} sources on ${sites} ${sites === 1 ? "site" : "sites"}`
            : `${evidence.posts} mentions · ${evidence.site}`}
          {card.verdict ? ` · ${VERDICT[card.verdict].label}` : ""}
          {card.sample ? " · sample" : ""}
        </p>
        <div className={styles.cardActions}>
          <SaveButton card={card} load={loadCard} small />
          <Link href={ideaHref(card.slug)} className={styles.more}>
            See ideas →
          </Link>
        </div>
      </div>
    </article>
  );
}

function HomeProduct({ product, index }: { product: HomeProduct; index: number }) {
  const gaps = productResearchHref(product);
  return (
    <article className={`${styles.card} rise`} style={stagger(index)}>
      <div className={styles.cardBody}>
        <span className={`${styles.meta} ${styles.metaWorking}`}>Working · {categoryLabel(product.category)}</span>
        <h3 className={styles.cardTitle}>
          <a href={product.url} target="_blank" rel="noopener noreferrer">
            {product.name}
          </a>
        </h3>
        <p className={styles.productLine}>{product.oneLine}</p>
        {product.proof[0] && <p className={styles.evidence}>{product.proof[0].label}</p>}
        <div className={styles.cardActions}>
          <Link href={gaps} className={styles.more}>
            Find its gaps →
          </Link>
        </div>
      </div>
    </article>
  );
}

function TrendingCard({ product, index }: { product: HomeProduct; index: number }) {
  const gaps = productResearchHref(product);
  const proof = product.proof[0];
  return (
    <article className={`${styles.trendCard} rise`} style={stagger(index)}>
      <div className={styles.trendTop}>
        <ProductThumb product={product} />
        <span className={styles.trendSource}>{product.source}</span>
      </div>
      <h3 className={styles.trendName}>
        <a href={product.url} target="_blank" rel="noopener noreferrer">
          {product.name}
        </a>
      </h3>
      <p className={styles.trendLine}>{product.oneLine}</p>
      {proof && (
        <a href={proof.url} target="_blank" rel="noopener noreferrer" className={styles.trendChip}>
          {proof.label}
        </a>
      )}
      <Link href={gaps} className={`${styles.more} ${styles.trendGaps}`}>
        Find its gaps →
      </Link>
    </article>
  );
}
