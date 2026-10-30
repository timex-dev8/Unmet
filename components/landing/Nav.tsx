"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import s from "./landing.module.css";

const sections = [
  { href: "#how", label: "How it works" },
  { href: "#trust", label: "Why trust it" },
  { href: "#pricing", label: "Pricing" },
];

// White text on the sky at the top; frosted white with dark text once the page scrolls under it.
export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`${s.navWrap} ${scrolled ? s.navScrolled : ""}`}>
      <nav aria-label="Main" className={s.nav}>
        <Link href="/" className={s.brand} aria-label="Unmet home">
          <Logo tone={scrolled ? "dark" : "light"} />
        </Link>

        <div className={s.links}>
          {sections.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>

        <div className={s.navRight}>
          <Link href="/welcome" className={s.signIn}>
            Sign in
          </Link>
          <Link href="/welcome" className={`glossy ${s.navCta}`}>
            Try free
          </Link>
        </div>
      </nav>
    </div>
  );
}
