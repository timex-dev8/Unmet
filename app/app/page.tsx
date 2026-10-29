import type { Metadata } from "next";
import Home from "@/components/home/Home";
import { getAllCards } from "@/lib/cards";

export const metadata: Metadata = { title: "Home · Unmet Studio" };

export default async function StudioHome() {
  const cards = await getAllCards();
  return <Home cards={cards} />;
}
