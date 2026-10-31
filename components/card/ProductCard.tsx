import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { productResearchHref } from "@/lib/links";
import type { Product } from "@/lib/types";
import ProductThumb from "./ProductThumb";
import f from "./ideaCard.module.css";
import p from "./productCard.module.css";

// The feed's "what's working" card: a real product, what it does, and the proof it's working.
// The main action turns it into research: what do its users complain about?
export default function ProductCard({ product }: { product: Product }) {
  const gaps = productResearchHref(product);
  return (
    <article className={f.card} aria-labelledby={`p-${product.slug}`}>
      <div className={f.body}>
        <div className={f.meta}>
          <span>
            {product.category}
            {product.rising ? " · ↑ Rising" : ""} · for {product.forWho.toLowerCase()}
          </span>
          <span className={p.working}>Working</span>
        </div>
        <div className={p.head}>
          <ProductThumb product={product} size={56} radius={14} />
          <h2 id={`p-${product.slug}`} className={f.headline}>
            {product.name}
          </h2>
        </div>
        <p className={f.summary}>{product.oneLine}</p>

        <ul className={p.proof} aria-label="Proof it's working">
          {product.proof.map((x) => (
            <li key={x.label}>
              <a href={x.url} target="_blank" rel="noopener noreferrer" draggable={false}>
                {x.label}
                <span className={p.site}>{x.site}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className={p.why}>{product.why}</p>

        <div className={f.bottom}>
          <div className={p.actions}>
            <Link href={gaps} className={`glossy ${p.gaps}`} draggable={false}>
              <Sparkles size={15} aria-hidden="true" />
              Find its gaps
            </Link>
            <a href={product.url} target="_blank" rel="noopener noreferrer" className={p.visit} draggable={false}>
              Visit
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
