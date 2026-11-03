"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { adminFetch } from "@/lib/adminApi";

const I = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  profile: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  skills: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  experience: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  projects: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  services: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  blog: <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
  inquiries: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  ai: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" /></>,
  media: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
  settings: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></>,
};

const NAV = [
  ["/admin", "Dashboard", "dashboard"], ["/admin/profile", "Profile", "profile"], ["/admin/skills", "Skills", "skills"],
  ["/admin/experience", "Experience", "experience"], ["/admin/projects", "Projects", "projects"], ["/admin/services", "Services", "services"],
  ["/admin/blog", "Blog", "blog"], ["/admin/inquiries", "Inquiries", "inquiries"], ["/admin/ai", "AI drafts", "ai"],
  ["/admin/media", "Media", "media"], ["/admin/settings", "Settings", "settings"],
];

function Icon({ name }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[name]}</svg>;
}

function NavList({ pathname, onNavigate }) {
  const active = (href) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label="Admin" className="mt-6 flex-1">
      <ul className="space-y-1">
        {NAV.map(([href, label, icon]) => {
          const on = active(href);
          return (
            <li key={href} className={on ? "relative ml-3 bg-panel before:pointer-events-none before:absolute before:right-0 before:-top-5 before:h-5 before:w-5 before:bg-[radial-gradient(circle_at_0_0,transparent_20px,rgb(var(--c-panel))_21px)] after:pointer-events-none after:absolute after:right-0 after:-bottom-5 after:h-5 after:w-5 after:bg-[radial-gradient(circle_at_0_100%,transparent_20px,rgb(var(--c-panel))_21px)] rounded-l-full" : "ml-3"}>
              <Link href={href} onClick={onNavigate} aria-current={on ? "page" : undefined}
                className={`flex items-center gap-3 rounded-l-full py-3 pl-5 pr-4 text-sm font-semibold tracking-wide transition-colors ${on ? "text-teal" : "text-ink/75 hover:text-teal"}`}>
                <Icon name={icon} /> <span className="uppercase">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Sidebar({ profile, pathname, onNavigate, onLogout }) {
  return (
    <div className="flex h-full flex-col rounded-[2rem] bg-sidebar py-8 pl-0 pr-0">
      <div className="flex flex-col items-center px-6 text-center">
        <span className="rounded-full p-1.5 ring-2 ring-teal/70">
          <Avatar src={profile?.photo_media_id ? `/api/admin/media/${profile.photo_media_id}/file` : "/photo.jpg"} name={profile?.full_name || "Admin"} size={84} />
        </span>
        <p className="mt-4 font-display text-lg font-bold uppercase tracking-wide">{profile?.full_name || "Admin"}</p>
        {profile?.contact_email && <p className="mt-0.5 max-w-full truncate text-xs text-muted">{profile.contact_email}</p>}
      </div>
      <div className="mt-6 border-t border-white/5" />
      <NavList pathname={pathname} onNavigate={onNavigate} />
      <div className="mx-6 mt-6 space-y-2">
        <Link href="/" target="_blank" className="btn w-full !py-2 text-xs">View live site ↗</Link>
        <button onClick={onLogout} className="btn w-full !py-2 text-xs">Sign out</button>
      </div>
      <div aria-hidden="true" className="mx-6 mt-6 h-16 rounded-xl opacity-60" style={{ backgroundImage: "radial-gradient(rgb(var(--c-accent) / .55) 1.2px, transparent 1.4px)", backgroundSize: "9px 9px", WebkitMaskImage: "linear-gradient(to bottom, black, transparent)", maskImage: "linear-gradient(to bottom, black, transparent)" }} />
    </div>
  );
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { adminFetch("profile").then((r) => r.ok && setProfile(r.data)); }, []);
  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen p-3 sm:p-5">
      <div className="mx-auto flex max-w-[1500px] gap-0 rounded-[2.25rem] bg-panel p-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] sm:p-4 lg:gap-5">
        <aside className="hidden w-[270px] shrink-0 lg:block" aria-label="Sidebar"><div className="sticky top-5 h-[calc(100vh-4.5rem)]"><Sidebar profile={profile} pathname={pathname} onLogout={logout} /></div></aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-3"><Avatar src="/photo.jpg" name={profile?.full_name || "Admin"} size={36} className="ring-2 ring-teal/70" /><span className="font-display font-bold">{profile?.full_name || "Admin"}</span></div>
            <button className="btn !py-2" aria-expanded={open} aria-controls="admin-drawer" onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
          </div>
          {open && (
            <div id="admin-drawer" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
              <div className="h-full w-[290px] max-w-[85vw] p-3" onClick={(e) => e.stopPropagation()}><Sidebar profile={profile} pathname={pathname} onNavigate={() => setOpen(false)} onLogout={logout} /></div>
            </div>
          )}
          <main id="admin-main" className="min-w-0 px-1 pb-6 sm:px-2 lg:pr-3">{children}</main>
        </div>
      </div>
    </div>
  );
}
