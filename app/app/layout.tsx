import type { Metadata } from "next";
import MotionProvider from "@/components/motion/MotionProvider";
import Sidebar from "@/components/shell/Sidebar";
import TabBar from "@/components/shell/TabBar";
import TopBar from "@/components/shell/TopBar";
import s from "@/components/shell/shell.module.css";

export const metadata: Metadata = { title: "Unmet Studio" };

// The studio: every app screen shares this frame.
export default function StudioLayout({ children }: LayoutProps<"/app">) {
  return (
    <MotionProvider>
      <div className={s.shell}>
        <Sidebar />
        <div className={s.main}>
          <TopBar />
          <div className={s.content}>{children}</div>
        </div>
        <TabBar />
      </div>
    </MotionProvider>
  );
}
