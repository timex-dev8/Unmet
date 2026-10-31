import type { ProductProof, ProductSource } from "@/lib/types";

/** What every product source returns, before merging and writing the card. */
export type RawProduct = {
  name: string;
  url: string; // the product's own site, or its store page
  description: string; // the source's own text, only read by the card writer, never shown
  hint?: string; // e.g. the App Store genre or TrustMRR category
  proof: ProductProof[];
  rising?: boolean;
  image?: string; // icon or thumbnail URL, when the source has one
  source: ProductSource; // which source found it, for round-robin and the Home picks
  weight: number; // how strong the proof is, for ordering (verified revenue weighs most)
};

export const headers = { "User-Agent": "unmet-feed (unmet-ten.vercel.app)" };
