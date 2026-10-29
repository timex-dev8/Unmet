import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is only the fallback: Apple devices use SF Pro through the system font stack.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unmet: find what people complain about",
  description: "Swipe through real problems, saved with their sources. Find what people complain about. Build the fix.",
};

export const viewport: Viewport = {
  themeColor: "#073a8b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
