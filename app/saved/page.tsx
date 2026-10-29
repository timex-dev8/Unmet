import type { Metadata } from "next";
import AppBar from "@/components/app/AppBar";
import SavedList from "@/components/saved/SavedList";
import s from "@/components/saved/saved.module.css";

export const metadata: Metadata = { title: "Saved · Unmet" };

export default function SavedPage() {
  return (
    <div className={s.page}>
      <main className={s.wrap}>
        <AppBar variant="back" backHref="/feed" backLabel="Feed" />
        <SavedList />
      </main>
    </div>
  );
}
