"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/AdminLayout";
import { Notice } from "@/components/AdminShell";
import { OverviewBars } from "@/components/charts";
import { adminFetch, errorText } from "@/lib/adminApi";
import { groupSourceCounts, pctChange, scoreTone, STATUS_LABEL, timeAgo, toCsv } from "@/lib/jobs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SOURCE_TILES = [["remoteok", "RemoteOK", "#16A34A"], ["jobicy", "Jobicy", "#0EA5E9"], ["arbeitnow", "Arbeitnow", "#F59E0B"], ["adzuna", "Adzuna India", "#8B5CF6"], ["boards", "MNC career boards", "#111827"]];
const STATUS_PILL = { new: "bg-mark text-teal", saved: "bg-sky-100 text-sky-800", ready: "bg-amber-100 text-amber-800", applied: "bg-emerald-100 text-emerald-800", interview: "bg-violet-100 text-violet-800", offer: "bg-emerald-200 text-emerald-900", rejected: "bg-red-100 text-red-800", dismissed: "bg-black/5 text-muted" };

function Chip({ change, suffix = "from last month" }) {
  const cls = change.dir === "up" ? "bg-mark text-teal" : change.dir === "down" ? "bg-red-100 text-red-700" : "bg-black/5 text-muted";
  return <p className="mt-3 flex items-center gap-2 text-xs"><span className={`pill ${cls}`}>{change.text} {change.dir === "up" ? "↑" : change.dir === "down" ? "↓" : ""}</span><span className="text-muted">{suffix}</span></p>;
}

function Card({ icon, title, right, children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-white p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-display text-lg font-bold"><span className="icon-tile"><Icon name={icon} size={19} /></span>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const [cfg, setCfg] = useState(null);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState(null);
  const [profile, setProfile] = useState(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });

  const load = useCallback(async () => {
    const [c, s, p] = await Promise.all([adminFetch("jobs/config"), adminFetch("jobs/stats"), adminFetch("profile")]);
    if (c.ok) setCfg(c.data); else setMsg({ kind: "error", text: errorText(c.data) });
    if (s.ok) setStats(s.data);
    if (p.ok) setProfile(p.data);
  }, []);
  const loadRecent = useCallback(async () => {
    const r = await adminFetch(`jobs?sort=recent&limit=6${filter ? `&status=${filter}` : ""}`);
    if (r.ok) setRecent(r.data);
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadRecent(); }, [loadRecent]);
  useEffect(() => { const h = () => { load(); loadRecent(); }; window.addEventListener("jobs-changed", h); return () => window.removeEventListener("jobs-changed", h); }, [load, loadRecent]);

  async function searchNow() {
    setBusy("search");
    const r = await adminFetch("jobs/search", { method: "POST" });
    setBusy("");
    setMsg(r.ok ? { kind: "ok", text: `Search finished: ${r.data.new_count} new job(s).` } : { kind: "error", text: errorText(r.data) });
    load(); loadRecent();
  }
  async function exportCsv() {
    const r = await adminFetch("jobs?sort=recent&limit=200");
    if (!r.ok) return setMsg({ kind: "error", text: errorText(r.data) });
    const url = URL.createObjectURL(new Blob([toCsv(r.data)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `jobs-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const first = (profile?.full_name || "there").split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  if (!cfg || !stats) return <p role="status" className="p-6 text-muted">Loading…</p>;

  const counts = stats.counts;
  const sources = groupSourceCounts(stats.by_source);
  const foundChange = pctChange(stats.this_month.found, stats.last_month.found);
  const appliedChange = pctChange(stats.this_month.applied, stats.last_month.applied);
  const goalPct = Math.min(100, Math.round((stats.this_month.applied / (stats.goal || 1)) * 100));
  const missing = stats.completeness.checks.filter((c) => !c.done).map((c) => c.label);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Welcome back, {first}</h1>
          <p className="mt-1 text-sm text-muted">Monitor your job search and portfolio today. Everything here comes from your own data.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium sm:inline-flex"><Icon name="dashboard" size={16} /> {today}</span>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Export CSV</button>
        </div>
      </header>
      <Notice kind={msg.kind}>{msg.text}</Notice>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card icon="jobs" title="Job search" className="xl:row-span-2"
          right={<span className={`pill ${cfg.enabled ? "bg-mark text-teal" : "bg-black/5 text-muted"}`}><span className={`h-2 w-2 rounded-full ${cfg.enabled ? "bg-teal" : "bg-muted"}`} />{cfg.enabled ? "ON" : "OFF"}</span>}>
          <p className="font-display text-5xl font-extrabold leading-none">{stats.this_month.found}</p>
          <p className="mt-1 text-sm text-muted">new matches this month</p>
          <Chip change={foundChange} />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={searchNow} disabled={!cfg.enabled || busy === "search"} title={cfg.enabled ? "" : "Turn the search on first (sidebar)"} className="inline-flex items-center justify-center gap-2 rounded-full bg-teal px-4 py-3 text-sm font-semibold text-onaccent hover:bg-teal-dark disabled:opacity-50">{busy === "search" ? "Searching…" : "Search now"}</button>
            <Link href="/admin/jobs#resume" className="inline-flex items-center justify-center gap-2 rounded-full bg-panel px-4 py-3 text-sm font-semibold hover:bg-line">{cfg.resume.uploaded ? "Resume ✓" : "Upload resume"}</Link>
          </div>
          <div className="mb-3 mt-7 flex items-center justify-between"><h3 className="font-semibold">Job sources</h3><Link href="/admin/jobs#settings" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-panel">+ Add boards</Link></div>
          <ul className="grid grid-cols-2 gap-3">
            {SOURCE_TILES.map(([key, name, color]) => {
              const info = cfg.available_sources.find((s) => s.key === key);
              const active = cfg.sources.includes(key) && info?.available && (key !== "boards" || cfg.company_boards.length > 0);
              return (
                <li key={key} className="rounded-2xl bg-panel p-3.5">
                  <div className="flex items-center gap-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: color }} aria-hidden="true">{name[0]}</span><span className="truncate text-sm font-semibold">{name}</span></div>
                  <p className="mt-2 font-display text-xl font-bold">{sources[key]}<span className="ml-1 text-xs font-normal text-muted">jobs</span></p>
                  <p className={`mt-0.5 text-xs font-medium ${active ? "text-teal" : "text-red-600"}`}>{active ? "Active" : "Inactive"}</p>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card icon="inquiries" title="Applications sent" right={<span className="text-muted" aria-hidden="true">···</span>}>
          <p className="font-display text-4xl font-extrabold">{stats.this_month.applied}<span className="ml-2 text-base font-medium text-muted">this month</span></p>
          <Chip change={appliedChange} />
        </Card>
        <Card icon="skills" title="Interviews & offers" right={<span className="text-muted" aria-hidden="true">···</span>}>
          <p className="font-display text-4xl font-extrabold">{(counts.interview || 0) + (counts.offer || 0)}</p>
          <p className="mt-3 flex items-center gap-2 text-xs"><span className="pill bg-mark text-teal">{counts.ready || 0} ready</span><span className="text-muted">packets waiting for you to send</span></p>
        </Card>

        <Card icon="dashboard" title="Overview" className="xl:col-span-2" right={<span className="flex items-center gap-3 text-xs"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-teal" />Matches found</span><span className="rounded-full border border-line px-3 py-1.5 font-semibold">This year ▾</span></span>}>
          <OverviewBars labels={MONTHS} values={stats.monthly.found} ariaLabel={`Job matches found per month in ${stats.year}: ${stats.monthly.found.map((v, i) => `${MONTHS[i]} ${v}`).join(", ")}.`} />
        </Card>

        <Card icon="ai" title="My goals" right={<span className="text-muted" aria-hidden="true">···</span>}>
          <ul className="space-y-3">
            <li className="rounded-2xl bg-panel p-4">
              <div className="flex items-baseline justify-between gap-3"><p className="font-semibold">Applications this month</p><p className="font-mono text-sm font-semibold">{goalPct}%</p></div>
              <p className="text-sm text-muted"><span className="font-semibold text-ink">{stats.this_month.applied}</span> / {stats.goal}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100} aria-label="Applications goal"><div className="h-full rounded-full bg-teal" style={{ width: `${goalPct}%` }} /></div>
            </li>
            <li className="rounded-2xl bg-panel p-4">
              <div className="flex items-baseline justify-between gap-3"><p className="font-semibold">Search setup</p><p className="font-mono text-sm font-semibold">{stats.completeness.percent}%</p></div>
              <p className="text-sm text-muted">{missing.length ? `Missing: ${missing.join(", ")}` : "Resume, skills, keywords and boards are all set."}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={stats.completeness.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Search setup"><div className="h-full rounded-full bg-teal" style={{ width: `${stats.completeness.percent}%` }} /></div>
            </li>
          </ul>
        </Card>

        <Card icon="jobs" title="Recent job matches" className="xl:col-span-2" right={
          <label className="flex items-center gap-2 text-xs"><span className="sr-only">Filter by status</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold"><option value="">Filter: all</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>}>
          {recent === null ? <p role="status" className="text-muted">Loading…</p> : recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">No jobs yet. Turn the search on in the sidebar, upload your resume, and press “Search now”.</p>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">Most recent job matches</caption>
              <thead><tr className="bg-panel text-xs text-muted"><th className="rounded-l-xl px-4 py-2.5 font-medium">Activity</th><th className="px-3 font-medium">Found</th><th className="px-3 font-medium">Fit</th><th className="px-3 font-medium">Status</th><th className="rounded-r-xl px-3" /></tr></thead>
              <tbody>{recent.map((j) => (
                <tr key={j.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel text-xs font-bold" aria-hidden="true">{j.company[0]}</span><div className="min-w-0"><p className="truncate font-medium">{j.title}</p><p className="truncate text-xs text-muted">{j.company} · {j.source_name}</p></div></div></td>
                  <td className="whitespace-nowrap px-3 text-muted">{timeAgo(j.fetched_at)}</td>
                  <td className="px-3"><span className={`pill ${scoreTone(j.fit_score).cls}`}>{j.fit_score}</span></td>
                  <td className="px-3"><span className={`pill ${STATUS_PILL[j.status] || ""}`}>{STATUS_LABEL[j.status]}</span></td>
                  <td className="px-3 text-right"><Link href={`/admin/jobs?open=${j.id}`} className="text-xs font-semibold text-teal underline-offset-2 hover:underline">Open</Link></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
      </div>
    </div>
  );
}
