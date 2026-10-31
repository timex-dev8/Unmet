import type { Metadata } from "next";
import Welcome from "@/components/welcome/Welcome";
import { safeNext } from "@/lib/links";

export const metadata: Metadata = { title: "Welcome · Unmet" };
export const instant = false;

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const { next, signin } = await searchParams;
  return <Welcome next={safeNext(next)} failed={signin === "failed"} />;
}
