import type { Metadata, Viewport } from "next";
import { EB_Garamond, Geist } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const display = EB_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["500"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

const TITLE = "Unmet: startup ideas from real complaints, with proof";
const DESCRIPTION =
  "Unmet reads real complaints across the web and tells you which ones are worth building, with the proof. Every claim links to a real post.";

export const metadata: Metadata = {
  metadataBase: new URL("https://unmet-ten.vercel.app"),
  title: { default: TITLE, template: "%s · Unmet" },
  description: DESCRIPTION,
  applicationName: "Unmet",
  alternates: { canonical: "/" },
  openGraph: { siteName: "Unmet", type: "website", title: TITLE, description: DESCRIPTION, url: "/", locale: "en_US" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#2c6ad6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${geist.variable}`} data-scroll-behavior="smooth">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
