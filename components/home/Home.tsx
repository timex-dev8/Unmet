"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import ProductThumb from "@/components/card/ProductThumb";
import SaveButton from "@/components/card/SaveButton";
import DepthPicker from "@/components/research/DepthPicker";
import { useLowOnly } from "@/lib/auth";
import { useInterests } from "@/lib/interests";
import { forYou, profileKeywords } from "@/lib/rank";
import type { Depth } from "@/lib/research-types";
import { useSaved } from "@/lib/saved";
import type { Card, Product } from "@/lib/types";
import { Niches } from "./Interests";
import s from "./home.module.css";

export default function Home({ cards, products = [] }: { cards: Card[]; products?: Product[] }) {
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

function HomeCard({ card, i }: { card: Card; i: number }) {
  const e = card.evidence;
  const sites = new Set(card.sources.map((x) => x.site)).size || 1;
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
          {card.report ? ` · ${VERDICT[card.report.verdict]}` : ""}
          {card.sample ? " · sample" : ""}
        </p>
        <div className={s.cardActions}>
          <SaveButton card={card} small />
          <Link href={`/app/idea/${card.slug}`} className={s.more}>
            See ideas →
          </Link>
        </div>
      </div>
    </article>
  );
}

function HomeProduct({ product, i }: { product: Product; i: number }) {
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

/** Up to 4 products: the top 2 from Product Hunt and the top 2 from TrustMRR, topped up from the other one, then any other source. */
function trendingPicks(products: Product[]): Product[] {
  const ph = products.filter((p) => p.source === "Product Hunt");
  const mrr = products.filter((p) => p.source === "TrustMRR");
  const rest = products.filter((p) => p.source !== "Product Hunt" && p.source !== "TrustMRR");
  const picked = [...ph.slice(0, 2), ...mrr.slice(0, 2)];
  const spare = ph.length < 2 ? [...mrr.slice(2), ...ph.slice(2)] : [...ph.slice(2), ...mrr.slice(2)];
  return [...picked, ...spare, ...rest].slice(0, 4);
}

function TrendingCard({ product, i }: { product: Product; i: number }) {
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
