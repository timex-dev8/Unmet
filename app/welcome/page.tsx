import type { Metadata } from "next";
import Welcome from "@/components/welcome/Welcome";
import { getAllCards } from "@/lib/cards";

export const metadata: Metadata = { title: "Welcome · Unmet" };
export const instant = false;

const safeNext = (n: string | string[] | undefined) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/app");

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const { next, signin } = await searchParams;
  const quotes = (await getAllCards())
    .map((c) => c.quote)
    .filter((q) => q && q.length > 18)
    .slice(0, 4);
  return <Welcome next={safeNext(next)} failed={signin === "failed"} quotes={quotes} />;
}
