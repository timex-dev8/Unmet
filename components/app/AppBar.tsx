import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import s from "./app.module.css";

// A back bar for detail screens inside the studio (the studio's own top bar handles the rest).
export default function AppBar({
  backHref,
  backLabel,
  title,
  right,
}: {
  variant?: "back";
  backHref: string;
  backLabel: string;
  title?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={s.bar} style={{ paddingLeft: 8 }}>
      <Link href={backHref} className={s.back}>
        <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
        {backLabel}
      </Link>
      {title && <span className={s.barTitle}>{title}</span>}
      <div className={s.right} style={{ minWidth: 44 }}>
        {right}
      </div>
    </div>
  );
}
