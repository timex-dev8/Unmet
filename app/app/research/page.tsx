import type { Metadata } from "next";
import ResearchChat from "@/components/research/ResearchChat";
import { exaConfigured } from "@/lib/exa";
import { llmConfigured } from "@/lib/llm";
import s from "@/components/research/research.module.css";

export const metadata: Metadata = {
  title: "Research · Unmet Studio",
  description: "Describe a market. Unmet searches recent posts and turns real complaints into ideas, with sources.",
};

// ?q= starts a research (from Home or "Dig deeper"); ?new=1 starts a fresh chat.
export const instant = false;

export default async function ResearchPage({ searchParams }: PageProps<"/app/research">) {
  const { q, new: fresh } = await searchParams;
  return (
    <div className={s.page}>
      <ResearchChat
        configured={llmConfigured() && exaConfigured()}
        initialQuery={typeof q === "string" ? q.slice(0, 500) : undefined}
        startFresh={fresh === "1"}
      />
    </div>
  );
}
