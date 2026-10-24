import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getPublic, photoSrc } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }) {
  const [settings, profile] = await Promise.all([getPublic("/settings").catch(() => null), getPublic("/profile").catch(() => null)]);
  const s = settings || {};
  const name = profile?.full_name || s.site_title || "Portfolio";
  const photo = photoSrc(profile);
  return (
    <div className="theme-site flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader title={s.site_title || name} name={name} photo={photo} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter name={name} photo={photo} profile={profile} footerText={s.footer_text} />
    </div>
  );
}
