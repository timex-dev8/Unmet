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
import s from "./shell.module.css";

export default function Sidebar() {
  const pathname = usePathname();
  const { saved } = useSaved();
  const threads = useThreads().slice(0, 8);

  return (
    <aside className={s.side} aria-label="Studio">
      <Link href="/" className={s.brand} aria-label="Unmet home page">
        <Logo size={24} />
      </Link>

      <Link href="/app/research" className={`pill pill-dark ${s.newBtn}`}>
        <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
        New research
      </Link>

      <nav className={s.nav} aria-label="Sections">
        {NAV.map(({ href, label, Icon }) => {
          const on = isActive(pathname, href);
          const here = on && pathname === href;
          return (
            <Link key={href} href={href} className={`${s.navItem} ${here ? s.navOn : on ? s.navWithin : ""}`} aria-current={on ? "page" : undefined}>
              {here && <Highlight id="side-nav" className={s.navPill} />}
              <Icon size={19} strokeWidth={on ? 2.2 : 1.8} aria-hidden="true" />
              {label}
              {href === "/app/board" && saved.length > 0 && (
                <span key={saved.length} className={s.count}>
                  {saved.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {threads.length > 0 && (
        <>
          <p className={s.sideLabel}>Recent research</p>
          <div className={s.threads}>
            {threads.map((t) => {
              const href = `/app/research/${t.id}`;
              const on = pathname === href;
              return (
                <Link key={t.id} href={href} className={`${s.thread} ${on ? s.threadOn : ""}`} aria-current={on ? "page" : undefined}>
                  {t.title}
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
