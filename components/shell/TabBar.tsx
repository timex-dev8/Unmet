"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "./nav";
import s from "./shell.module.css";

// Phone-only bottom navigation (hidden on desktop, never on the landing page).
export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className={s.tabs} aria-label="Sections">
      {NAV.map(({ href, label, Icon, ink }) => {
        const on = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`${s.tab} ${on ? s.tabOn : ""}`}
            style={on ? { color: ink } : undefined}
            aria-current={on ? "page" : undefined}
          >
            <Icon size={23} strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
