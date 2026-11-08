import type { Metadata } from "next";
import IdeaDetail from "@/components/idea/IdeaDetail";
import LocalIdea from "@/components/idea/LocalIdea";
import JsonLd from "@/components/seo/JsonLd";
import { getAllSlugs, getCard } from "@/lib/cards";
import { ideaHref } from "@/lib/links";
import { getIdea } from "@/lib/research/store";

export const instant = false;

export async function generateStaticParams() {
  return (await getAllSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/app/idea/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const card = (await getCard(slug)) ?? (await getIdea(slug));
  // missing cards and samples stay out of search
  if (!card) return { title: "Idea", robots: { index: false, follow: true } };
  const path = ideaHref(slug);
  return {
    title: card.headline,
    description: card.summary,
    alternates: { canonical: path },
    robots: { index: !card.sample, follow: true },
    openGraph: {
      type: "article",
      siteName: "Unmet",
      title: card.headline,
      description: card.summary,
      url: path,
      modifiedTime: card.evidence.updatedAt,
    },
    twitter: { card: "summary_large_image", title: card.headline, description: card.summary },
  };
}

export default async function IdeaPage({ params }: PageProps<"/app/idea/[slug]">) {
  const { slug } = await params;
  // feed ideas, then researched ones (supabase), then this browsers own copy
  const card = (await getCard(slug)) ?? (await getIdea(slug));
  if (!card) return <LocalIdea slug={slug} />;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: card.headline,
          description: card.summary,
          dateModified: card.evidence.updatedAt,
          mainEntityOfPage: `https://unmet-ten.vercel.app${ideaHref(slug)}`,
          publisher: { "@type": "Organization", name: "Unmet", url: "https://unmet-ten.vercel.app" },
        }}
      />
      <IdeaDetail card={card} />
    </>
  );
}
