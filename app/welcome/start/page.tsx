import type { Metadata } from "next";
import Onboarding from "@/components/welcome/Onboarding";

export const metadata: Metadata = { title: "Get started · Unmet" };
export const instant = false;

export default async function StartPage({ searchParams }: PageProps<"/welcome/start">) {
  const { next } = await searchParams;
  const to = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  return <Onboarding next={to} />;
}
