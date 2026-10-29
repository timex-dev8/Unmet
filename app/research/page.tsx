import type { Metadata } from "next";
import AppBar from "@/components/app/AppBar";
import ResearchChat from "@/components/research/ResearchChat";
import { exaConfigured } from "@/lib/exa";
import { llmConfigured } from "@/lib/llm";
import s from "@/components/research/research.module.css";

export const metadata: Metadata = {
  title: "Research · Unmet",
  description: "Describe a market. Unmet searches recent posts and turns real complaints into ideas, with sources.",
};

export default function ResearchPage() {
  return (
    <div className={s.page}>
      <div className={s.top}>
        <AppBar />
      </div>
      <ResearchChat configured={llmConfigured() && exaConfigured()} />
    </div>
  );
}
