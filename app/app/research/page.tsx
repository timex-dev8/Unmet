import type { Metadata } from "next";
import ResearchChat from "@/components/research/ResearchChat";
import { getCard } from "@/lib/cards";
import { exaConfigured } from "@/lib/exa";
import { llmConfigured } from "@/lib/llm";
import styles from "@/components/research/research.module.css";

export const metadata: Metadata = {
  title: "New research",
  description: "Describe a market. Unmet searches recent posts and turns real complaints into ideas, with sources.",
};

// ?q= starts a research, ?about=<slug> says which idea
export const instant = false;

export default async function NewResearchPage({ searchParams }: PageProps<"/app/research">) {
  const { q: queryParam, about, depth } = await searchParams;
  const card = typeof about === "string" ? await getCard(about) : null;
  return (
    <div className={styles.page}>
      <ResearchChat
        configured={llmConfigured() && exaConfigured()}
        initialQuery={typeof queryParam === "string" ? queryParam.slice(0, 500) : undefined}
        initialDepth={depth === "low" || depth === "medium" || depth === "high" ? depth : undefined}
        about={card ? { slug: card.slug, headline: card.headline, summary: card.summary } : undefined}
      />
    </div>
  );
}
