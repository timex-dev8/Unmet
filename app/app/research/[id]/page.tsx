import type { Metadata } from "next";
import ResearchChat from "@/components/research/ResearchChat";
import { exaConfigured } from "@/lib/exa";
import { llmConfigured } from "@/lib/llm";
import s from "@/components/research/research.module.css";

export const metadata: Metadata = { title: "Research · Unmet Studio" };

// Threads live in the browser for now, so this page only passes the id along.
export const instant = false;

export default async function ResearchThreadPage({ params }: PageProps<"/app/research/[id]">) {
  const { id } = await params;
  return (
    <div className={s.page}>
      <ResearchChat key={id} configured={llmConfigured() && exaConfigured()} threadId={id} />
    </div>
  );
}
