"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminShell, { Notice } from "@/components/AdminShell";
import { BarChart, DonutChart, LineChart } from "@/components/charts";
import { adminFetch, errorText } from "@/lib/adminApi";
import { avatarColor, summarise } from "@/lib/dashboard";
import { initials } from "@/lib/format";

const SOURCES = ["projects", "skills", "experience", "services", "blog", "inquiries"];
const STATUS_STYLE = { new: "bg-teal text-onaccent", read: "bg-sky-500/20 text-sky-200", replied: "bg-emerald-500/20 text-emerald-200", spam: "bg-red-500/20 text-red-200", archived: "bg-white/10 text-muted" };

function Contours() {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 80" className="pointer-events-none absolute -right-4 -top-2 h-24 w-48 opacity-25" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M0 60C30 20 60 90 100 50S170 10 200 40" /><path d="M0 48C30 8 60 78 100 38S170 -2 200 28" /><path d="M0 72C30 32 60 102 100 62S170 22 200 52" />
    </svg>
  );
}

function StatCard({ tone = "dark", label, value, hint, href }) {
  const accent = tone === "accent";
  return (
    <Link href={href} className={`group relative block overflow-hidden rounded-3xl px-6 py-5 transition-transform hover:-translate-y-0.5 ${accent ? "bg-teal text-onaccent" : "bg-sidebar text-ink"}`}>
      <Contours />
      <p className={`text-sm font-medium ${accent ? "text-onaccent/80" : "text-muted"}`}>{label}</p>
      <p className="mt-1 font-display text-5xl font-extrabold leading-none">{value}</p>
      <p className={`mt-3 text-xs ${accent ? "text-onaccent/75" : "text-muted"}`}>{hint}</p>
    </Link>
  );
}

function Card({ title, action, children, className = "" }) {
  return (
    <section className={`panel-card ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-display text-lg font-bold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all(SOURCES.map((s) => adminFetch(s))).then((rs) => {
      const bad = rs.find((r) => !r.ok);
      if (bad) setErr(errorText(bad.data));
      setData(Object.fromEntries(SOURCES.map((s, i) => [s, rs[i].ok ? rs[i].data : []])));
    });
  }, []);

  const s = useMemo(() => (data ? summarise(data) : null), [data]);
  const actions = (
    <div className="flex flex-wrap gap-2">
      <Link href="/admin/blog/new" className="btn btn-primary !py-2 text-xs">New blog post</Link>
      <Link href="/admin/projects" className="btn !py-2 text-xs">Add project</Link>
    </div>
  );

  if (!s) return <AdminShell title="Dashboard" actions={actions}><p role="status" className="text-muted">Loading…</p></AdminShell>;

  const barRows = s.inquiryMonths.map((m) => ({ label: m.label, a: m.counts.open || 0, b: m.counts.handled || 0 }));
  const labels = s.inquiryMonths.map((m) => m.label);
  const inqSeries = s.activityMonths.inquiries.map((m) => m.counts.total || 0);
  const postSeries = s.activityMonths.posts.map((m) => m.counts.total || 0);
  const latest = data.inquiries.filter((i) => i.status !== "spam").slice(0, 4);
  const noInquiries = barRows.every((r) => r.a + r.b === 0);

  return (
    <AdminShell title="Dashboard" subtitle="Live numbers from your own content and messages." actions={actions}>
      <Notice kind="error">{err}</Notice>
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard tone="accent" href="/admin/projects" label="Published projects" value={s.cards.projectsPublished} hint={`${s.cards.projectsTotal} total · ${s.cards.projectsTotal - s.cards.projectsPublished} not public`} />
        <StatCard href="/admin/blog" label="Blog posts live" value={s.cards.postsPublished} hint={`${s.cards.postsInReview} waiting for review`} />
        <StatCard href="/admin/inquiries" label="New inquiries" value={s.cards.inquiriesNew} hint={`${s.cards.inquiriesTotal} messages in total (spam excluded)`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <Card title="Latest inquiries" action={<Link href="/admin/inquiries" className="text-xs font-semibold text-teal underline-offset-4 hover:underline">View all</Link>} className="relative overflow-hidden">
          {latest.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">No messages yet. They appear here when someone uses your contact form.</p>
          ) : (
            <div>
              <div className="hidden grid-cols-[2fr_1.4fr_auto_5rem] gap-4 pb-2 text-xs text-muted sm:grid"><span>Sender</span><span>Subject</span><span>Status</span><span className="text-right">Date</span></div>
              <ul>
                {latest.map((i, idx) => (
                  <li key={i.id} className={`relative grid items-center gap-3 py-4 sm:grid-cols-[2fr_1.4fr_auto_5rem] sm:gap-4 ${idx < latest.length - 1 ? "border-b border-dashed border-line" : ""}`}>
                    {idx < latest.length - 1 && <>
                      <span aria-hidden="true" className="absolute -bottom-2 -left-[calc(1.5rem+8px)] hidden h-4 w-4 rounded-full bg-panel sm:block" />
                      <span aria-hidden="true" className="absolute -bottom-2 -right-[calc(1.5rem+8px)] hidden h-4 w-4 rounded-full bg-panel sm:block" />
                    </>}
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-onaccent" style={{ background: avatarColor(i.name) }} aria-hidden="true">{initials(i.name)}</span>
                      <div className="min-w-0"><p className="truncate font-semibold">{i.name}</p><p className="truncate text-xs text-muted">{i.email}</p></div>
                    </div>
                    <p className="truncate text-sm text-muted">{i.subject || i.message}</p>
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[i.status] || ""}`}>{i.status}</span>
                    <time dateTime={i.created_at} className="font-mono text-xs text-muted sm:text-right">{new Date(i.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</time>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Inquiries by month">
          <BarChart rows={barRows} aLabel="Open (new)" bLabel="Handled" ariaLabel={`Inquiries per month, last 6 months. ${barRows.map((r) => `${r.label}: ${r.a + r.b}`).join(", ")}.`} />
          {noInquiries && <p className="mt-3 text-xs text-muted">No inquiries in the last 6 months yet.</p>}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.7fr]">
        <Card title="Content share">
          <DonutChart center="items" ariaLabel={`Content by status: ${s.status.published} published, ${s.status.pending} in progress, ${s.status.archived} archived or rejected.`}
            segments={[{ label: "Published", value: s.status.published, color: "rgb(var(--c-accent))" }, { label: "Draft / in progress", value: s.status.pending, color: "#2DD4BF" }, { label: "Archived / rejected", value: s.status.archived, color: "#5B7C99" }]} />
        </Card>
        <Card title="Activity">
          <LineChart labels={labels} unit="inquiries" ariaLabel={`Monthly activity, last 6 months. Inquiries: ${inqSeries.join(", ")}. Blog posts created: ${postSeries.join(", ")}.`}
            series={[{ name: "Inquiries received", color: "rgb(var(--c-accent))", values: inqSeries }, { name: "Blog posts created", color: "#2DD4BF", values: postSeries }]} />
        </Card>
      </div>
    </AdminShell>
  );
}
