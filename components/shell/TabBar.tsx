"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Highlight from "@/components/motion/Highlight";
import { NAV, isActive } from "./nav";
import s from "./shell.module.css";

// Phone-only bottom navigation (hidden on desktop, never on the landing page).
export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className={s.tabs} aria-label="Sections">
      {NAV.map(({ href, label, Icon }) => {
        const on = isActive(pathname, href);
        return (
          <Link key={href} href={href} className={`${s.tab} ${on ? s.tabOn : ""}`} aria-current={on ? "page" : undefined}>
            <span className={s.tabIcon}>
              {on && <Highlight id="tab-bar" className={s.tabPill} />}
              <Icon size={22} strokeWidth={on ? 2.2 : 1.8} aria-hidden="true" />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
