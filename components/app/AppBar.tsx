import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import Logo from "@/components/Logo";
import SavedLink from "./SavedLink";
import s from "./app.module.css";

type Props =
  | { variant?: "main" }
  | { variant: "back"; backHref: string; backLabel: string; title?: string; right?: React.ReactNode };

export default function AppBar(props: Props) {
  if (props.variant === "back") {
    return (
      <div className={s.bar} style={{ paddingLeft: 8 }}>
        <Link href={props.backHref} className={s.back}>
          <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
          {props.backLabel}
        </Link>
        {props.title && <span className={s.barTitle}>{props.title}</span>}
        <div className={s.right} style={{ minWidth: 44 }}>
          {props.right}
        </div>
      </div>
    );
  }

  return (
    <div className={s.bar}>
      <Link href="/" className={s.brand} aria-label="Unmet home">
        <Logo size={24} />
      </Link>
      <div className={s.right}>
        <Link href="/search" className={s.iconLink} aria-label="Search">
          <Search size={21} aria-hidden="true" />
        </Link>
        <SavedLink />
      </div>
    </div>
  );
}
