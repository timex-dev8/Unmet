import type { Metadata } from "next";
import Welcome from "@/components/welcome/Welcome";

export const metadata: Metadata = { title: "Welcome · Unmet" };
export const instant = false;

const safeNext = (n: string | string[] | undefined) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/app");

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const { next, signin } = await searchParams;
  return <Welcome next={safeNext(next)} failed={signin === "failed"} />;
}
