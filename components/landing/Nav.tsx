"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Menu, X } from "lucide-react";
import Logo from "@/components/Logo";
import LiquidGlass from "@/components/motion/LiquidGlass";
import styles from "./landing.module.css";

const sections = [
  { id: "how", label: "How it works" },
  { id: "pricing", label: "Pricing" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const linksRef = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<{ x: number; w: number } | null>(null);

  useEffect(() => {
    // clear glass over the deep sky, frosted white over the pale part so text keeps contrast
    const onScroll = () => {
      const hero = document.querySelector("header");
      const deep = hero ? hero.offsetHeight * 0.4 : 300;
      setScrolled(window.scrollY > deep);
      if (window.scrollY < 300) setCurrent(null);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sectionEls = sections.map((section) => document.getElementById(section.id)).filter((sectionEl): sectionEl is HTMLElement => !!sectionEl);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
        if (window.scrollY < 300) setCurrent(null);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    sectionEls.forEach((sectionEl) => observer.observe(sectionEl));
    return () => observer.disconnect();
  }, []);

  // measure the bubble from the link itself, shared layout drifts inside the fixed bar while scrolling
  useLayoutEffect(() => {
    const measure = () => {
      const activeLink = current ? linksRef.current?.querySelector<HTMLElement>(`a[href="#${current}"]`) : null;
      setBubble(activeLink ? { x: activeLink.offsetLeft, w: activeLink.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [current]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const light = scrolled && !open;

  return (
    <div className={`${styles.navWrap} ${light ? styles.navLight : ""}`}>
      <LiquidGlass radius={22} className={styles.nav}>
        <nav aria-label="Main" className={styles.navInner}>
          <Link href="/" className={styles.brand} aria-label="Unmet home">
            <Logo tone={light ? "dark" : "light"} size={24} />
          </Link>

          <div ref={linksRef} className={styles.links}>
            <span
              className={styles.bubble}
              style={{ opacity: bubble ? 1 : 0, width: bubble?.w ?? 0, transform: `translateX(${bubble?.x ?? 0}px)` }}
              aria-hidden="true"
            />
            {sections.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={current === link.id ? styles.linkOn : ""}
                aria-current={current === link.id ? "location" : undefined}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className={styles.navRight}>
            <Link href="/welcome" className={styles.signIn}>
              Sign in
            </Link>
            <Link href="/welcome" className={`glossy ${styles.navCta}`}>
              Try free
            </Link>
            <button
              type="button"
              className={styles.menuBtn}
              aria-expanded={open}
              aria-controls="landing-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((wasOpen) => !wasOpen)}
            >
              {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </nav>
      </LiquidGlass>

      {open && (
        <LiquidGlass radius={22} className={styles.sheet}>
          <div id="landing-menu" className={styles.sheetInner}>
            {[...sections, { id: "faq", label: "Questions" }].map((link) => (
              <a key={link.id} href={`#${link.id}`} className={current === link.id ? styles.sheetOn : ""} onClick={() => setOpen(false)}>
                {link.label}
                <ChevronRight size={18} aria-hidden="true" />
              </a>
            ))}
            <span className={styles.sheetRule} />
            <Link href="/welcome" onClick={() => setOpen(false)}>
              Sign in
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </LiquidGlass>
      )}
    </div>
  );
}
