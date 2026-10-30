import { House, Layers, LayoutGrid, NotebookPen, Sparkles, type LucideIcon } from "lucide-react";

/** color = icon tile, ink = readable text color of the same hue (active tab label). */
export type NavItem = { href: string; label: string; Icon: LucideIcon; color: string; ink: string };

// The studio's main sections. Order matches the sidebar and the phone tab bar.
export const NAV: NavItem[] = [
  { href: "/app", label: "Home", Icon: House, color: "var(--blue)", ink: "var(--link)" },
  { href: "/app/mind", label: "Mind", Icon: NotebookPen, color: "var(--c-prod)", ink: "var(--c-prod-ink)" },
  { href: "/app/feed", label: "Feed", Icon: Layers, color: "var(--c-work)", ink: "var(--c-work-ink)" },
  { href: "/app/research", label: "Research", Icon: Sparkles, color: "var(--c-dev)", ink: "var(--c-dev-ink)" },
  { href: "/app/board", label: "Board", Icon: LayoutGrid, color: "var(--c-money)", ink: "var(--c-money-ink)" },
];

export function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}
