"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Menu, X } from "lucide-react";
import Logo from "@/components/Logo";
import Highlight from "@/components/motion/Highlight";
import LiquidGlass from "@/components/motion/LiquidGlass";
import s from "./landing.module.css";

const sections = [
  { id: "how", label: "How it works" },
  { id: "trust", label: "Why trust it" },
  { id: "pricing", label: "Pricing" },
];

// A floating, rounded bar of liquid glass: clear over the sky, frosted white once the page scrolls.
// A glass bubble sits behind the section you're reading; on phones the links open in a glass sheet.
export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The section crossing the upper part of the screen is the current one
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

          <div className={s.links}>
            {sections.map((l) => (
              <a key={l.id} href={`#${l.id}`} className={current === l.id ? s.linkOn : ""} aria-current={current === l.id ? "location" : undefined}>
                {current === l.id && <Highlight id="landing-nav" className={s.bubble} />}
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
