import type { Metadata } from "next";
import Home from "@/components/home/Home";
import { getAllCards } from "@/lib/cards";
import { readProducts } from "@/lib/products";

export const metadata: Metadata = { title: "Home · Unmet Studio" };

export default async function StudioHome() {
  const [cards, products] = await Promise.all([getAllCards(), readProducts().catch(() => [])]);
  return <Home cards={cards} products={products} />;
}
