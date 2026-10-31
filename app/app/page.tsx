import type { Metadata } from "next";
import Home from "@/components/home/Home";
import { getAllCards } from "@/lib/cards";
import { readProducts } from "@/lib/products";
import { growingStartups } from "@/lib/trustmrr";

export const metadata: Metadata = { title: "Home · Unmet Studio" };

export default async function StudioHome() {
  const [cards, startups, products] = await Promise.all([getAllCards(), growingStartups().catch(() => []), readProducts().catch(() => [])]);
  return <Home cards={cards} startups={startups} products={products} />;
}
