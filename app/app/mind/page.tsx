import type { Metadata } from "next";
import MindView from "@/components/mind/MindView";
import { llmConfigured } from "@/lib/llm";

export const metadata: Metadata = {
  title: "Shape · Unmet Studio",
  description: "Describe your idea in your own words. Unmet turns it into a clear plan.",
};

export default function MindPage() {
  return <MindView configured={llmConfigured()} />;
}
