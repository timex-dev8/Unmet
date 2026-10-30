import type { Metadata } from "next";
import IdeaDetail from "@/components/idea/IdeaDetail";
import LocalIdea from "@/components/idea/LocalIdea";
import { getAllSlugs, getCard } from "@/lib/cards";
import { getIdea } from "@/lib/research/store";

// Known ideas are prerendered; new ones render on the server before sending.
export const instant = false;

export async function generateStaticParams() {
  return (await getAllSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/app/idea/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const card = (await getCard(slug)) ?? (await getIdea(slug));
  if (!card) return { title: "Idea · Unmet" };
  return { title: `${card.headline} · Unmet`, description: card.summary };
}

export default async function IdeaPage({ params }: PageProps<"/app/idea/[slug]">) {
  const { slug } = await params;
  // Feed ideas, then ideas found by research (saved in Supabase), then this browser's own copy.
  const card = (await getCard(slug)) ?? (await getIdea(slug));
  if (!card) return <LocalIdea slug={slug} />;
  return <IdeaDetail card={card} />;
}
