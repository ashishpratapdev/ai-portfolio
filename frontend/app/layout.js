import "./globals.css";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import { Container } from "@/components/ui";
import Analytics from "@/components/Analytics";
import { getPublic } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

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

export default async function RootLayout({ children }) {
  const s = (await getPublic("/settings").catch(() => null)) || {};
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Analytics />
        <SiteHeader title={s.site_title || "Portfolio"} />
        <main id="main" className="flex-1">{children}</main>
        <footer className="mt-20 border-t border-line py-8 text-sm text-muted">
          <Container>{s.footer_text || ""}</Container>
        </footer>
      </body>
    </html>
  );
}
