"use server";

import { getCard } from "@/lib/cards";
import type { Card } from "@/lib/types";

/** The full card for a slug (Home sends only a slim copy; saving needs the whole card for Saved and Board). */
export async function loadCard(slug: string): Promise<Card | null> {
  if (typeof slug !== "string" || slug.length > 200) return null;
  return (await getCard(slug)) ?? null;
}
