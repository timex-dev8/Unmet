"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Highlight from "@/components/motion/Highlight";
import LiquidGlass from "@/components/motion/LiquidGlass";
import { NAV, isActive } from "./nav";
import s from "./shell.module.css";

export default function TabBar() {
  const pathname = usePathname();
  return (
    <div className={s.tabsWrap}>
      <LiquidGlass radius={26} className={s.tabsGlass}>
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
      </LiquidGlass>
    </div>
  );
}
