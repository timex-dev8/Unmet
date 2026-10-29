import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata: Metadata = { title: "Feed · Unmet" };

// Placeholder until the swipe feed is built (Saturday).
export default function FeedPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 24,
        textAlign: "center",
        background: "var(--gray)",
      }}
    >
      <Logo size={40} />
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 600, letterSpacing: "-0.04em" }}>The feed is being built.</h1>
      <p style={{ margin: 0, color: "var(--muted)", maxWidth: "22em" }}>
        Real problems from Hacker News are on their way.
      </p>
      <Link href="/" className="pill pill-dark">
        Back home
      </Link>
    </main>
  );
}
