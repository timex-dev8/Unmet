import { House, Layers, LayoutGrid, NotebookPen, Sparkles, type LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; Icon: LucideIcon };

export const NAV: NavItem[] = [
  { href: "/app", label: "Home", Icon: House },
  { href: "/app/feed", label: "Feed", Icon: Layers },
  { href: "/app/research", label: "Research", Icon: Sparkles },
  { href: "/app/board", label: "Board", Icon: LayoutGrid },
  // route stays /app/mind so old links work
  { href: "/app/mind", label: "Shape", Icon: NotebookPen },
];

export function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}
