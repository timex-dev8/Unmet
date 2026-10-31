import type { Metadata } from "next";
import Onboarding from "@/components/welcome/Onboarding";
import { safeNext } from "@/lib/links";

export const metadata: Metadata = { title: "Get started · Unmet" };
export const instant = false;

export default async function StartPage({ searchParams }: PageProps<"/welcome/start">) {
  const { next } = await searchParams;
  return <Onboarding next={safeNext(next)} />;
}
