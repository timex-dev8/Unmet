import type { Metadata } from "next";
import Home from "@/components/home/Home";
import { getAllCards } from "@/lib/cards";
import { homeIdea, homeProducts } from "@/lib/home";
import { readProducts } from "@/lib/products";

export const metadata: Metadata = { title: "Home" };

export default async function StudioHome() {
  const [cards, products] = await Promise.all([getAllCards(), readProducts().catch(() => [])]);
  // Home ranks and shows a few; send it only what it reads (lib/home.ts), not every full card
  return <Home cards={cards.map(homeIdea)} products={homeProducts(products)} />;
}
