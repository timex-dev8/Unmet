import type { CSSProperties } from "react";
import type { Product } from "@/lib/types";
import t from "./productThumb.module.css";

// A product's icon, or its first letter on blue when the source has no image.
export default function ProductThumb({ product, size = 48, radius = 12 }: { product: Product; size?: number; radius?: number }) {
  const style = { "--thumb": `${size}px`, "--thumb-r": `${radius}px` } as CSSProperties;
  if (product.image) {
    return (
      // The name sits next to it, so the image is decoration (alt="").
      // eslint-disable-next-line @next/next/no-img-element
      <img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" className={t.thumb} style={style} />
    );
  }
  return (
    <span className={`${t.thumb} ${t.letter}`} style={style} aria-hidden="true">
      {product.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
