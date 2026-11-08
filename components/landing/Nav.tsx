"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Menu, X } from "lucide-react";
import Logo from "@/components/Logo";
import LiquidGlass from "@/components/motion/LiquidGlass";
import s from "./landing.module.css";

const sections = [
  { id: "how", label: "How it works" },
  { id: "pricing", label: "Pricing" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const links = useRef<HTMLDivElement>(null);
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
    const els = sections.map((x) => document.getElementById(x.id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id);
        if (window.scrollY < 300) setCurrent(null);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // measure the bubble from the link itself, shared layout drifts inside the fixed bar while scrolling
  useLayoutEffect(() => {
    const measure = () => {
      const a = current ? links.current?.querySelector<HTMLElement>(`a[href="#${current}"]`) : null;
      setBubble(a ? { x: a.offsetLeft, w: a.offsetWidth } : null);
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
    <div className={`${s.navWrap} ${light ? s.navLight : ""}`}>
      <LiquidGlass radius={22} className={s.nav}>
        <nav aria-label="Main" className={s.navInner}>
          <Link href="/" className={s.brand} aria-label="Unmet home">
            <Logo tone={light ? "dark" : "light"} size={24} />
          </Link>

          <div ref={links} className={s.links}>
            <span
              className={s.bubble}
              style={{ opacity: bubble ? 1 : 0, width: bubble?.w ?? 0, transform: `translateX(${bubble?.x ?? 0}px)` }}
              aria-hidden="true"
            />
            {sections.map((l) => (
              <a key={l.id} href={`#${l.id}`} className={current === l.id ? s.linkOn : ""} aria-current={current === l.id ? "location" : undefined}>
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
            <button
              type="button"
              className={s.menuBtn}
              aria-expanded={open}
              aria-controls="landing-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </nav>
      </LiquidGlass>

      {open && (
        <LiquidGlass radius={22} className={s.sheet}>
          <div id="landing-menu" className={s.sheetInner}>
            {[...sections, { id: "faq", label: "Questions" }].map((l) => (
              <a key={l.id} href={`#${l.id}`} className={current === l.id ? s.sheetOn : ""} onClick={() => setOpen(false)}>
                {l.label}
                <ChevronRight size={18} aria-hidden="true" />
              </a>
            ))}
            <span className={s.sheetRule} />
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
