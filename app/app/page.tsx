import type { Metadata } from "next";
import Home from "@/components/home/Home";
import { getAllCards } from "@/lib/cards";
import { growingStartups } from "@/lib/trustmrr";

export const metadata: Metadata = { title: "Home · Unmet Studio" };

export default async function StudioHome() {
  const [cards, startups] = await Promise.all([getAllCards(), growingStartups().catch(() => [])]);
  return <Home cards={cards} startups={startups} />;
}
