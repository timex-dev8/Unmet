import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import s from "./app.module.css";

// A back bar for detail screens inside the studio (the studio's own top bar handles the rest).
export default function AppBar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className={s.bar}>
      <Link href={backHref} className={s.back}>
        <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
        {backLabel}
      </Link>
      <div className={s.right} />
    </div>
  );
}
