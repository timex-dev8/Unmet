import type { ProductProof, ProductSource } from "@/lib/types";

export type RawProduct = {
  name: string;
  url: string;
  description: string; // only read by the card writer, never shown
  hint?: string;
  proof: ProductProof[];
  rising?: boolean;
  image?: string;
  source: ProductSource;
  weight: number; // verified revenue weighs most
};

export const headers = { "User-Agent": "unmet-feed (unmet-ten.vercel.app)" };
