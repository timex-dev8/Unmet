"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Highlight from "@/components/motion/Highlight";
import LiquidGlass from "@/components/motion/LiquidGlass";
import { NAV, isActive } from "./nav";
import styles from "./shell.module.css";

export default function TabBar() {
  const pathname = usePathname();
  return (
    <div className={styles.tabsWrap}>
      <LiquidGlass radius={26} className={styles.tabsGlass}>
        <nav className={styles.tabs} aria-label="Sections">
          {NAV.map(({ href, label, Icon }) => {
            const isCurrent = isActive(pathname, href);
            return (
              <Link key={href} href={href} className={`${styles.tab} ${isCurrent ? styles.tabOn : ""}`} aria-current={isCurrent ? "page" : undefined}>
                <span className={styles.tabIcon}>
                  {isCurrent && <Highlight id="tab-bar" className={styles.tabPill} />}
                  <Icon size={22} strokeWidth={isCurrent ? 2.2 : 1.8} aria-hidden="true" />
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
