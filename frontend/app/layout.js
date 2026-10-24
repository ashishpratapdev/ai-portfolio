import "./globals.css";
import { Bricolage_Grotesque, JetBrains_Mono, Public_Sans } from "next/font/google";
import Analytics from "@/components/Analytics";
import { getPublic } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const s = (await getPublic("/settings").catch(() => null)) || {};
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: s.site_title || "Portfolio", template: `%s | ${s.site_title || "Portfolio"}` },
    description: s.tagline,
    alternates: { types: { "application/rss+xml": "/blog/rss.xml" } },
    openGraph: { siteName: s.site_title || "Portfolio", type: "website" },
    verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  };
}

export const viewport = { themeColor: "#0A0E13" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Analytics />
        {children}
      </body>
    </html>
  );
}
