import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { productResearchHref } from "@/lib/links";
import type { Product } from "@/lib/types";
import ProductThumb from "./ProductThumb";
import ideaCardStyles from "./ideaCard.module.css";
import productCardStyles from "./productCard.module.css";

export default function ProductCard({ product }: { product: Product }) {
  const gaps = productResearchHref(product);
  return (
    <article className={ideaCardStyles.card} aria-labelledby={`p-${product.slug}`}>
      <div className={ideaCardStyles.body}>
        <div className={ideaCardStyles.meta}>
          <span>
            {product.category}
            {product.rising ? " · ↑ Rising" : ""} · for {product.forWho.toLowerCase()}
          </span>
          <span className={productCardStyles.working}>Working</span>
        </div>
        <div className={productCardStyles.head}>
          <ProductThumb product={product} size={56} radius={14} />
          <h2 id={`p-${product.slug}`} className={ideaCardStyles.headline}>
            {product.name}
          </h2>
        </div>
        <p className={ideaCardStyles.summary}>{product.oneLine}</p>

        <ul className={productCardStyles.proof} aria-label="Proof it's working">
          {product.proof.map((proof) => (
            <li key={proof.label}>
              <a href={proof.url} target="_blank" rel="noopener noreferrer" draggable={false}>
                {proof.label}
                <span className={productCardStyles.site}>{proof.site}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className={productCardStyles.why}>{product.why}</p>

        <div className={ideaCardStyles.bottom}>
          <div className={productCardStyles.actions}>
            <Link href={gaps} className={`glossy ${productCardStyles.gaps}`} draggable={false}>
              <Sparkles size={15} aria-hidden="true" />
              Find its gaps
            </Link>
            <a href={product.url} target="_blank" rel="noopener noreferrer" className={productCardStyles.visit} draggable={false}>
              Visit
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
