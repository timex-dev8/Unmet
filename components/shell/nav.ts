import { House, Layers, LayoutGrid, NotebookPen, Sparkles, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; Icon: LucideIcon };

// The studio's main sections, in the order people use them: start, get inspired, research, keep, shape.
// Order matches the sidebar and the phone tab bar.
export const NAV: NavItem[] = [
  { href: "/app", label: "Home", Icon: House },
  { href: "/app/feed", label: "Feed", Icon: Layers },
  { href: "/app/research", label: "Research", Icon: Sparkles },
  { href: "/app/board", label: "Board", Icon: LayoutGrid },
  // Shape (route kept as /app/mind so old links work): turn your own idea into a clear brief
  { href: "/app/mind", label: "Shape", Icon: NotebookPen },
];

export function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}
