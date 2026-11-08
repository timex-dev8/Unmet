"use server";

import { getCard } from "@/lib/cards";
import type { Card } from "@/lib/types";

// home only sends a slim card, saving needs the full one
export async function loadCard(slug: string): Promise<Card | null> {
  if (typeof slug !== "string" || slug.length > 200) return null;
  return (await getCard(slug)) ?? null;
}
