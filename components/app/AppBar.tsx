import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import styles from "./app.module.css";

export default function AppBar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className={styles.bar}>
      <Link href={backHref} className={styles.back}>
        <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
        {backLabel}
      </Link>
      <div className={styles.right} />
    </div>
  );
}
