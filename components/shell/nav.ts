import { House, Layers, LayoutGrid, NotebookPen, Sparkles, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; Icon: LucideIcon };

// The studio's main sections. Order matches the sidebar and the phone tab bar.
export const NAV: NavItem[] = [
  { href: "/app", label: "Home", Icon: House },
  { href: "/app/mind", label: "Mind", Icon: NotebookPen },
  { href: "/app/feed", label: "Feed", Icon: Layers },
  { href: "/app/research", label: "Research", Icon: Sparkles },
  { href: "/app/board", label: "Board", Icon: LayoutGrid },
];

export function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}
