"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import Logo from "@/components/Logo";
import Highlight from "@/components/motion/Highlight";
import { useThreads } from "@/lib/research-store";
import { useSaved } from "@/lib/saved";
import AccountButton from "./AccountButton";
import { NAV, isActive } from "./nav";
import styles from "./shell.module.css";

export default function Sidebar() {
  const pathname = usePathname();
  const { saved } = useSaved();
  const threads = useThreads().slice(0, 8);
  const onResearch = pathname === "/app/research" || pathname.startsWith("/app/research/");

  return (
    <aside className={styles.side} aria-label="Studio">
      <Link href="/" className={styles.brand} aria-label="Unmet home page">
        <Logo size={24} />
      </Link>

      <Link href="/app/research" className={`pill ${onResearch ? styles.newQuiet : "pill-dark"} ${styles.newBtn}`}>
        <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
        New research
      </Link>

      <nav className={styles.nav} aria-label="Sections">
        {NAV.map(({ href, label, Icon }) => {
          const inSection = isActive(pathname, href);
          const onExactPage = inSection && pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${onExactPage ? styles.navOn : inSection ? styles.navWithin : ""}`}
              aria-current={inSection ? "page" : undefined}
            >
              {onExactPage && <Highlight id="side-nav" className={styles.navPill} />}
              <Icon size={19} strokeWidth={inSection ? 2.2 : 1.8} aria-hidden="true" />
              {label}
              {href === "/app/board" && saved.length > 0 && (
                <span key={saved.length} className={styles.count}>
                  {saved.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {threads.length > 0 && (
        <>
          <p className={styles.sideLabel}>Recent research</p>
          <div className={styles.threads}>
            {threads.map((thread) => {
              const href = `/app/research/${thread.id}`;
              const isOpenThread = pathname === href;
              return (
                <Link
                  key={thread.id}
                  href={href}
                  className={`${styles.thread} ${isOpenThread ? styles.threadOn : ""}`}
                  aria-current={isOpenThread ? "page" : undefined}
                >
                  {thread.title}
                </Link>
              );
            })}
          </div>
        </>
      )}
      <AccountButton variant="side" />
    </aside>
  );
}
