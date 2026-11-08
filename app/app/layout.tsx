import type { Metadata, Viewport } from "next";
import MotionProvider from "@/components/motion/MotionProvider";
import AccountSync from "@/components/shell/AccountSync";
import AppGate from "@/components/shell/AppGate";
import Sidebar from "@/components/shell/Sidebar";
import TabBar from "@/components/shell/TabBar";
import TopBar from "@/components/shell/TopBar";
import s from "@/components/shell/shell.module.css";

// studio is private, idea pages opt back in
export const metadata: Metadata = { title: { default: "Studio · Unmet", template: "%s · Unmet" }, robots: { index: false, follow: true } };

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function StudioLayout({ children }: LayoutProps<"/app">) {
  return (
    <MotionProvider>
      <div className={s.shell}>
        <Sidebar />
        <div className={s.main}>
          <TopBar />
          <div className={s.content}>
            <AppGate>{children}</AppGate>
          </div>
        </div>
        <TabBar />
        <AccountSync />
      </div>
    </MotionProvider>
  );
}
