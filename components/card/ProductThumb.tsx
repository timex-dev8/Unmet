import type { CSSProperties } from "react";
import type { Product } from "@/lib/types";
import t from "./productThumb.module.css";

/** Product Hunt serves originals from imgix: ask for a crop at 2x the size shown, in the best format the browser takes. */
function thumbSrc(src: string, size: number) {
  try {
    const u = new URL(src);
    if (u.hostname !== "ph-files.imgix.net" || u.searchParams.has("s")) return src; // signed URLs break if changed
    const px = String(Math.round(size * 2));
    u.searchParams.set("auto", "format");
    u.searchParams.set("w", px);
    u.searchParams.set("h", px);
    u.searchParams.set("fit", "crop");
    return u.toString();
  } catch {
    return src;
  }
}

// A product's icon, or its first letter on blue when the source has no image.
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
      // The name sits next to it, so the image is decoration (alt="").
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbSrc(product.image, size)}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={t.thumb}
        style={style}
      />
    );
  }
  return (
    <span className={`${t.thumb} ${t.letter}`} style={style} aria-hidden="true">
      {product.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
