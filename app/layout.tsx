import type { Metadata, Viewport } from "next";
import { EB_Garamond, Geist } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

// Two typefaces (DESIGN.md): EB Garamond for big headlines only, Geist for everything else.
const display = EB_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["500"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Unmet: find what people complain about",
  description: "Swipe through real problems, saved with their sources. Find what people complain about. Build the fix.",
};

export const viewport: Viewport = {
  themeColor: "#2c6ad6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${geist.variable}`} data-scroll-behavior="smooth">
      <body>
        {children}
        {/* Page views for Unmet itself (Vercel Web Analytics: no cookies, free on Hobby) */}
        <Analytics />
      </body>
    </html>
  );
}
