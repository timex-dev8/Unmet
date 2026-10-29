import type { Metadata } from "next";
import IdeaDetail from "@/components/idea/IdeaDetail";
import LocalIdea from "@/components/idea/LocalIdea";
import { getAllSlugs, getCard } from "@/lib/cards";

// Known ideas are prerendered; new ones render on the server before sending.
export const instant = false;

export async function generateStaticParams() {
  return (await getAllSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/idea/[slug]">): Promise<Metadata> {
  const card = await getCard((await params).slug);
  if (!card) return { title: "Idea · Unmet" };
  return { title: `${card.headline} · Unmet`, description: card.summary };
}

export default async function IdeaPage({ params }: PageProps<"/idea/[slug]">) {
  const { slug } = await params;
  const card = await getCard(slug);
  // Ideas from research chat live in this browser until Supabase is connected.
  if (!card) return <LocalIdea slug={slug} />;
  return <IdeaDetail card={card} />;
}
