import Link from "next/link";
import Logo from "@/components/Logo";
import s from "./landing.module.css";

const sections = [
  { href: "#how", label: "How it works" },
  { href: "#example", label: "Example" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function Nav() {
  return (
    <div className={s.navWrap}>
      <nav aria-label="Main" className={s.nav}>
        <Link href="/" className={s.brand} aria-label="Unmet home">
          <Logo tone="light" />
        </Link>

        <div className={s.links}>
          {sections.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>

        <div className={s.navRight}>
          {/* Phone menu: native <details>, works without JavaScript */}
          <details className={s.menu}>
            <summary>Menu</summary>
            <div className={s.menuPanel}>
              {sections.map((l) => (
                <a key={l.href} href={l.href}>
                  {l.label}
                </a>
              ))}
              <Link href="/welcome">Sign in</Link>
            </div>
          </details>
          <Link href="/welcome" className={s.signIn}>
            Sign in
          </Link>
          <Link href="/welcome" className={s.navCta}>
            Try free
          </Link>
        </div>
      </nav>
    </div>
  );
}
