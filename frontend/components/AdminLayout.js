"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Avatar from "./Avatar";
import { adminFetch, errorText } from "@/lib/adminApi";

const I = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  profile: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  skills: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  experience: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  projects: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  services: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  blog: <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
  inquiries: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  ai: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" /></>,
  jobs: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>,
  media: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
  settings: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  globe: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>,
};

export const NAV_GROUPS = [
  ["Main menu", [["/admin", "Dashboard", "dashboard"], ["/admin/jobs", "Job hunt", "jobs", "jobs"], ["/admin/inquiries", "Inquiries", "inquiries", "inquiries"], ["/admin/blog", "Blog", "blog"]]],
  ["Features", [["/admin/profile", "Profile", "profile"], ["/admin/experience", "Experience", "experience"], ["/admin/projects", "Projects", "projects"], ["/admin/skills", "Skills", "skills"], ["/admin/services", "Services", "services"], ["/admin/ai", "AI drafts", "ai"]]],
  ["General", [["/admin/media", "Media", "media"], ["/admin/settings", "Settings", "settings"]]],
];
const FLAT = NAV_GROUPS.flatMap(([, items]) => items);

export function Icon({ name, size = 20 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[name]}</svg>;
}

function NavItem({ href, label, icon, badge, active, onNavigate }) {
  return (
    <li>
      <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-colors ${active ? "bg-mark font-semibold text-teal" : "text-ink/75 hover:bg-panel"}`}>
        <Icon name={icon} size={19} /> <span className="flex-1">{label}</span>
        {badge > 0 && <span className="rounded-full bg-panel px-2 py-0.5 text-[11px] font-semibold text-muted">{badge}</span>}
      </Link>
    </li>
  );
}

function JobCard({ cfg, busy, onToggle, onSearch }) {
  if (!cfg) return null;
  return (
    <div className="rounded-3xl bg-gradient-to-br from-teal to-teal-dark p-4 text-onaccent">
      <p className="font-display text-base font-bold">Auto job search: {cfg.enabled ? "ON" : "OFF"}</p>
      <p className="mt-1 text-xs leading-snug text-onaccent/80">{cfg.enabled ? "Finding jobs that match your resume." : "Nothing is fetched while this is off."}</p>
      <div className="mt-3 flex gap-2">
        {cfg.enabled ? (
          <>
            <button onClick={onSearch} disabled={busy} className="flex-1 rounded-full bg-white px-3 py-2 text-xs font-bold text-teal disabled:opacity-60">{busy === "search" ? "Searching…" : "Search now"}</button>
            <button onClick={onToggle} disabled={busy} className="rounded-full border border-white/50 px-3 py-2 text-xs font-semibold">Turn off</button>
          </>
        ) : (
          <button onClick={onToggle} disabled={busy} className="w-full rounded-full bg-white px-3 py-2 text-xs font-bold text-teal disabled:opacity-60">Turn on</button>
        )}
      </div>
    </div>
  );
}

function Sidebar({ pathname, badges, jobCfg, busy, onToggle, onSearch, onLogout, onNavigate }) {
  const active = (href) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-2 pb-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-onaccent"><Icon name="dashboard" size={22} /></span>
        <span className="font-display text-xl font-extrabold">Portfolio</span>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        {NAV_GROUPS.map(([group, items]) => (
          <div key={group} className="mb-4">
            <p className="mb-1.5 px-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{group}</p>
            <ul className="space-y-0.5">{items.map(([href, label, icon, badgeKey]) => <NavItem key={href} href={href} label={label} icon={icon} badge={badgeKey ? badges[badgeKey] : 0} active={active(href)} onNavigate={onNavigate} />)}</ul>
          </div>
        ))}
        <ul className="space-y-0.5">
          <li><a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium text-ink/75 hover:bg-panel"><Icon name="globe" size={19} /> View live site</a></li>
          <li><button onClick={onLogout} className="flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-left text-sm font-medium text-ink/75 hover:bg-panel"><Icon name="logout" size={19} /> Log out</button></li>
        </ul>
      </div>
      <div className="pt-3"><JobCard cfg={jobCfg} busy={busy} onToggle={onToggle} onSearch={onSearch} /></div>
    </div>
  );
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState({ jobs: 0, inquiries: 0 });
  const [jobCfg, setJobCfg] = useState(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef(null);

  const refresh = useCallback(async () => {
    const [p, st, inq, cfg] = await Promise.all([adminFetch("profile"), adminFetch("jobs/stats"), adminFetch("inquiries?status=new"), adminFetch("jobs/config")]);
    if (p.ok) setProfile(p.data);
    if (st.ok) setBadges((b) => ({ ...b, jobs: (st.data.counts.new || 0) + (st.data.counts.ready || 0) }));
    if (inq.ok) setBadges((b) => ({ ...b, inquiries: inq.data.length }));
    if (cfg.ok) setJobCfg(cfg.data);
  }, []);
  useEffect(() => { refresh(); }, [refresh, pathname]);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const matches = useMemo(() => (q.trim() ? FLAT.filter(([, label]) => label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : []), [q]);
  const go = (href) => { setQ(""); router.push(href); };

  async function toggleJobs() {
    setBusy("toggle");
    const r = await adminFetch("jobs/toggle", { method: "POST", json: { enabled: !jobCfg.enabled } });
    setBusy("");
    if (r.ok) { setJobCfg(r.data); router.refresh(); } else setToast(errorText(r.data));
  }
  async function searchJobs() {
    setBusy("search");
    const r = await adminFetch("jobs/search", { method: "POST" });
    setBusy("");
    setToast(r.ok ? `Search finished: ${r.data.new_count} new job(s).` : errorText(r.data));
    refresh();
    window.dispatchEvent(new Event("jobs-changed"));
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }
  const sidebar = (onNavigate) => <Sidebar pathname={pathname} badges={badges} jobCfg={jobCfg} busy={busy} onToggle={toggleJobs} onSearch={searchJobs} onLogout={logout} onNavigate={onNavigate} />;

  return (
    <div className="min-h-screen p-2 sm:p-5">
      <div className="mx-auto flex max-w-[1500px] rounded-[2rem] bg-white p-3 shadow-[0_20px_60px_-30px_rgba(0,0,0,.25)] sm:p-4">
        <aside className="hidden w-[250px] shrink-0 lg:block" aria-label="Sidebar"><div className="sticky top-5 h-[calc(100vh-3.5rem)]">{sidebar()}</div></aside>

        <div className="min-w-0 flex-1 lg:pl-4">
          <div className="mb-3 flex items-center gap-3">
            <button className="btn !px-3 !py-2 lg:hidden" aria-expanded={open} aria-controls="admin-drawer" onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
            <div className="relative max-w-sm flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={17} /></span>
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) go(matches[0][0]); if (e.key === "Escape") setQ(""); }}
                aria-label="Jump to a page" placeholder="Jump to…" className="w-full rounded-full bg-panel py-2.5 pl-10 pr-14 text-sm outline-none placeholder:text-muted" />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] text-muted">Ctrl K</kbd>
              {matches.length > 0 && <ul role="listbox" className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-white p-1 shadow-lg">{matches.map(([href, label, icon]) => <li key={href}><button role="option" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-panel" onClick={() => go(href)}><Icon name={icon} size={16} /> {label}</button></li>)}</ul>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/admin/inquiries" aria-label={`Inquiries${badges.inquiries ? `, ${badges.inquiries} new` : ""}`} className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line hover:bg-panel"><Icon name="inquiries" size={18} />{badges.inquiries > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />}</Link>
              <Link href="/admin/jobs" aria-label={`Job matches${badges.jobs ? `, ${badges.jobs} to review` : ""}`} className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line hover:bg-panel"><Icon name="bell" size={18} />{badges.jobs > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-teal" />}</Link>
              <div className="relative">
                <button onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Account menu" className="flex items-center gap-1 rounded-full p-0.5 hover:bg-panel">
                  <Avatar src="/photo.jpg" name={profile?.full_name || "Admin"} size={40} /><span aria-hidden="true" className="pr-1 text-xs text-muted">▾</span>
                </button>
                {menu && <div className="absolute right-0 z-30 mt-2 w-48 rounded-2xl border border-line bg-white p-1 text-sm shadow-lg">
                  <p className="truncate px-3 py-2 text-xs text-muted">{profile?.full_name || "Admin"}</p>
                  <a href="/" target="_blank" rel="noopener noreferrer" className="block rounded-xl px-3 py-2 hover:bg-panel">View live site</a>
                  <button onClick={logout} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-panel">Log out</button></div>}
              </div>
            </div>
          </div>

          {open && (
            <div id="admin-drawer" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
              <div className="h-full w-[290px] max-w-[85vw] bg-white p-4" onClick={(e) => e.stopPropagation()}>{sidebar(() => setOpen(false))}</div>
            </div>
          )}
          {toast && <p role="status" className="mb-3 flex items-center justify-between rounded-2xl border border-teal/40 bg-mark px-4 py-2 text-sm text-ink">{toast}<button className="text-xs font-semibold text-teal" onClick={() => setToast("")}>Dismiss</button></p>}
          <main id="admin-main" className="min-w-0 rounded-3xl bg-panel p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
