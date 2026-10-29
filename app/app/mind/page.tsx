import type { Metadata } from "next";
import MindView from "@/components/mind/MindView";
import { llmConfigured } from "@/lib/llm";

export const metadata: Metadata = {
  title: "Mind · Unmet Studio",
  description: "Dump your thoughts. Unmet groups them, checks them against real evidence, and tells you what they add up to.",
};

export default function MindPage() {
  return <MindView configured={llmConfigured()} />;
}
