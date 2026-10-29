import type { Metadata } from "next";
import SavedList from "@/components/saved/SavedList";
import s from "@/components/saved/saved.module.css";

export const metadata: Metadata = { title: "Board · Unmet Studio" };

// For now the board lists saved ideas; stages (Spotted → Building) come next.
export default function BoardPage() {
  return (
    <div className={s.page}>
      <main className={s.wrap}>
        <SavedList />
      </main>
    </div>
  );
}
