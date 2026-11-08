import type { CSSProperties } from "react";
import type { Product } from "@/lib/types";
import styles from "./productThumb.module.css";

/* ph serves originals via imgix, ask for a 2x crop */
function thumbSrc(src: string, size: number) {
  try {
    const url = new URL(src);
    if (url.hostname !== "ph-files.imgix.net" || url.searchParams.has("s")) return src; // signed urls break if changed
    const px = String(Math.round(size * 2));
    url.searchParams.set("auto", "format");
    url.searchParams.set("w", px);
    url.searchParams.set("h", px);
    url.searchParams.set("fit", "crop");
    return url.toString();
  } catch {
    return src;
  }
}

export default function ProductThumb({
  product,
  size = 48,
  radius = 12,
}: {
  product: Pick<Product, "name" | "image">;
  size?: number;
  radius?: number;
}) {
  const style = { "--thumb": `${size}px`, "--thumb-r": `${radius}px` } as CSSProperties;
  if (product.image) {
    return (
      // alt is empty because the name sits next to it
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbSrc(product.image, size)}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={styles.thumb}
        style={style}
      />
    );
  }
  return (
    <span className={`${styles.thumb} ${styles.letter}`} style={style} aria-hidden="true">
      {product.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
