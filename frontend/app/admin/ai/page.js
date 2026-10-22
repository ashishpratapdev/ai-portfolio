"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell, { Notice } from "@/components/AdminShell";
import { adminFetch, errorText } from "@/lib/adminApi";

const TABS = ["Overview", "Topics", "Jobs", "Review queue", "History"];
const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const JOB_STYLE = { queued: "bg-white", running: "bg-sky-100", succeeded: "bg-emerald-100", failed: "bg-red-100", cancelled: "bg-amber-100" };

export default function AIDashboard() {
  const [tab, setTab] = useState("Overview");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  // Stable identities: children list these in effect dependencies, so they must not change on every render.
  const ok = useCallback((text) => setMsg({ kind: "ok", text }), []);
  const fail = useCallback((r) => setMsg({ kind: "error", text: errorText(r.data) }), []);

  return (
    <AdminShell title="AI drafts">
      <p className="mb-4 max-w-2xl border-l-4 border-teal bg-white px-3 py-2 text-sm">
        The AI only prepares drafts. Every AI article lands in <strong>review</strong>, and nothing is published until you approve that exact revision.
        There is no setting that changes this.
      </p>
      <Notice kind={msg.kind}>{msg.text}</Notice>
      <div role="tablist" aria-label="AI sections" className="mb-6 flex flex-wrap gap-2 border-b border-ink pb-2">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setMsg({ kind: "", text: "" }); }} className={`btn !py-1 ${tab === t ? "btn-primary" : ""}`}>{t}</button>)}
      </div>
      {tab === "Overview" && <Overview ok={ok} fail={fail} />}
      {tab === "Topics" && <Topics ok={ok} fail={fail} />}
      {tab === "Jobs" && <Jobs ok={ok} fail={fail} />}
      {tab === "Review queue" && <Queue fail={fail} />}
      {tab === "History" && <History fail={fail} />}
    </AdminShell>
  );
}

function Overview({ ok, fail }) {
  const [c, setC] = useState(null);
  const [usage, setUsage] = useState(null);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([adminFetch("ai/config"), adminFetch("ai/usage")]);
    if (a.ok) setC({ ...a.data, categories: a.data.categories.join("\n"), feeds: a.data.feeds.join("\n"), allowed_domains: a.data.allowed_domains.join("\n") }); else fail(a);
    if (b.ok) setUsage(b.data);
  }, [fail]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault();
    const body = { ...c, categories: lines(c.categories), feeds: lines(c.feeds), allowed_domains: lines(c.allowed_domains),
      max_topics_per_run: Number(c.max_topics_per_run), daily_job_budget: Number(c.daily_job_budget), monthly_token_budget: Number(c.monthly_token_budget), stale_days: Number(c.stale_days) };
    const r = await adminFetch("ai/config", { method: "PUT", json: body });
    if (r.ok) { ok("Settings saved."); load(); } else fail(r);
  }
  async function action(path, text) {
    const r = await adminFetch(path, { method: "POST" });
    if (r.ok) { ok(text); load(); } else fail(r);
  }
  if (!c) return <p role="status" className="text-muted">Loading…</p>;
  const set = (k) => (e) => setC({ ...c, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <form onSubmit={save} className="max-w-xl space-y-4">
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={c.enabled} onChange={set("enabled")} /> Pipeline enabled</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="freq">Automatic schedule</label>
            <select id="freq" className="field" value={c.frequency} onChange={set("frequency")}><option value="manual">Manual only</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
          <div><label className="label" htmlFor="tz">Time zone (IANA)</label><input id="tz" className="field" value={c.timezone} onChange={set("timezone")} placeholder="Asia/Kolkata" /></div>
        </div>
        <div><label className="label" htmlFor="tone">Tone</label><input id="tone" className="field" maxLength={120} value={c.tone} onChange={set("tone")} /></div>
        <div><label className="label" htmlFor="cats">Categories / topic keywords (one per line)</label><textarea id="cats" className="field min-h-20" value={c.categories} onChange={set("categories")} /></div>
        <div><label className="label" htmlFor="feeds">RSS/Atom feed URLs (one per line)</label><textarea id="feeds" className="field min-h-20" value={c.feeds} onChange={set("feeds")} /></div>
        <div><label className="label" htmlFor="doms">Approved domains (one per line, e.g. example.com)</label><textarea id="doms" className="field min-h-20" value={c.allowed_domains} onChange={set("allowed_domains")} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="mt">Max new topics per run</label><input id="mt" type="number" min="1" max="20" className="field" value={c.max_topics_per_run} onChange={set("max_topics_per_run")} /></div>
          <div><label className="label" htmlFor="sd">Stale after (days)</label><input id="sd" type="number" min="30" className="field" value={c.stale_days} onChange={set("stale_days")} /></div>
          <div><label className="label" htmlFor="db">Daily job budget</label><input id="db" type="number" min="0" className="field" value={c.daily_job_budget} onChange={set("daily_job_budget")} /></div>
          <div><label className="label" htmlFor="mb">Monthly token budget</label><input id="mb" type="number" min="0" className="field" value={c.monthly_token_budget} onChange={set("monthly_token_budget")} /></div>
        </div>
        <button className="btn btn-primary">Save settings</button>
      </form>
      <aside className="space-y-4">
        {usage && (
          <section className="border border-ink/30 bg-white p-4" aria-labelledby="us">
            <h2 id="us" className="font-semibold">Usage</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Provider</dt><dd>{usage.provider}</dd></div>
              <div className="flex justify-between"><dt>Jobs today</dt><dd>{usage.jobs_today} / {usage.daily_job_budget}</dd></div>
              <div className="flex justify-between"><dt>Tokens this month</dt><dd>{usage.tokens_this_month.toLocaleString()} / {usage.monthly_token_budget.toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt>Estimated cost</dt><dd>{usage.estimated_cost_usd === null ? "unknown" : `$${usage.estimated_cost_usd}`}</dd></div>
            </dl>
            {usage.cost_note && <p className="mt-2 text-xs text-muted">{usage.cost_note}</p>}
            {usage.provider === "mock" && <p className="mt-2 text-xs font-semibold text-amber-800">Mock provider: drafts are fake placeholders. Set AI_PROVIDER=anthropic on the server for real drafts (billed by your provider).</p>}
          </section>
        )}
        <div className="flex flex-col gap-2">
          <button className="btn" onClick={() => action("ai/discover", "Discovery job queued.")}>Find topics now</button>
          <button className="btn" onClick={() => action("ai/run", "Ran the queue (up to 2 jobs).")}>Run queued jobs now</button>
        </div>
      </aside>
    </div>
  );
}

function Topics({ ok, fail }) {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("");
  const [nt, setNt] = useState({ title: "", url: "" });
  const load = useCallback(async () => {
    const r = await adminFetch(`ai/topics${status ? `?status=${status}` : ""}`);
    if (r.ok) setRows(r.data); else fail(r);
  }, [status, fail]);
  useEffect(() => { load(); }, [load]);

  async function post(path, json, text) {
    const r = await adminFetch(path, { method: "POST", json });
    if (r.ok) { ok(text); load(); return true; } fail(r); return false;
  }
  async function add(e) {
    e.preventDefault();
    if (await post("ai/topics", { title: nt.title, url: nt.url || null }, "Topic added.")) setNt({ title: "", url: "" });
  }
  return (
    <div>
      <form onSubmit={add} className="mb-6 flex max-w-2xl flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1"><label className="label" htmlFor="nt">Add a topic idea</label><input id="nt" required minLength={3} maxLength={300} className="field" value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} /></div>
        <div className="min-w-48 flex-1"><label className="label" htmlFor="nu">Source URL (approved domain)</label><input id="nu" type="url" className="field" value={nt.url} onChange={(e) => setNt({ ...nt, url: e.target.value })} /></div>
        <button className="btn">Add</button>
      </form>
      <div className="mb-3 flex items-center gap-3"><label className="text-sm" htmlFor="ts">Show</label>
        <select id="ts" className="field !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{["discovered", "researching", "drafted", "rejected", "failed", "duplicate"].map((s) => <option key={s}>{s}</option>)}</select></div>
      {rows === null ? <p role="status" className="text-muted">Loading…</p> : rows.length === 0 ? <p className="border border-dashed border-ink/30 p-6 text-muted">No topics yet. Configure feeds and approved domains in Overview, then press “Find topics now”.</p> : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((t) => (
            <li key={t.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1"><p className="font-semibold">{t.title}</p><p className="text-sm text-muted">{t.status}{t.reject_reason ? ` · ${t.reject_reason}` : ""}</p></div>
                {(t.status === "discovered" || t.status === "failed") && <button className="btn btn-primary !py-1" onClick={() => post(`ai/topics/${t.id}/draft`, undefined, "Draft job queued.")}>Draft this</button>}
                {["discovered", "failed", "duplicate"].includes(t.status) && <button className="btn !py-1" onClick={() => { const reason = prompt("Why reject this topic?"); if (reason) post(`ai/topics/${t.id}/reject`, { reason }, "Topic rejected."); }}>Reject</button>}
                {t.post_id && <Link className="underline" href={`/admin/blog/${t.post_id}`}>Open draft</Link>}
              </div>
              {t.sources?.length > 0 && <ul className="mt-1 text-xs text-muted">{t.sources.map((s) => <li key={s.url}>{s.domain} · {s.title} · {s.published_at ? new Date(s.published_at).toLocaleDateString() : "undated"} · retrieved {new Date(s.retrieved_at).toLocaleDateString()}</li>)}</ul>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Jobs({ ok, fail }) {
  const [rows, setRows] = useState(null);
  const load = useCallback(async () => {
    const r = await adminFetch("ai/jobs");
    if (r.ok) setRows(r.data); else fail(r);
  }, [fail]);
  useEffect(() => { load(); }, [load]);
  async function act(id, a) {
    const r = await adminFetch(`ai/jobs/${id}/${a}`, { method: "POST" });
    if (r.ok) { ok(a === "cancel" ? "Cancel requested." : "Job re-queued."); load(); } else fail(r);
  }
  if (rows === null) return <p role="status" className="text-muted">Loading…</p>;
  if (!rows.length) return <p className="border border-dashed border-ink/30 p-6 text-muted">No jobs yet.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((j) => (
        <li key={j.id} className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`border border-ink/40 px-2 py-0.5 text-xs font-semibold uppercase ${JOB_STYLE[j.state]}`}>{j.state}</span>
            <strong>#{j.id} {j.kind}</strong>
            <span className="text-sm text-muted">attempt {j.attempts}/{j.max_attempts} · {j.tokens_in + j.tokens_out} tokens{j.state === "queued" && j.attempts > 0 ? ` · next try ${new Date(j.run_after).toLocaleTimeString()}` : ""}</span>
            <span className="ml-auto flex gap-2">
              {["queued", "running"].includes(j.state) && !j.cancel_requested && <button className="btn !py-1" onClick={() => act(j.id, "cancel")}>Cancel</button>}
              {j.cancel_requested && j.state === "running" && <span className="text-sm">cancelling…</span>}
              {["failed", "cancelled"].includes(j.state) && <button className="btn !py-1" onClick={() => act(j.id, "retry")}>Retry</button>}
            </span>
          </div>
          {j.error && <p className="mt-1 text-sm text-red-800" role="alert">{j.error}</p>}
          {j.log?.length > 0 && <details className="mt-1 text-xs text-muted"><summary>Log</summary><ul>{j.log.map((l, i) => <li key={i}>{l.t.slice(11, 19)} {l.m}</li>)}</ul></details>}
        </li>
      ))}
    </ul>
  );
}

function Queue({ fail }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { adminFetch("ai/review-queue").then((r) => (r.ok ? setRows(r.data) : fail(r))); }, [fail]);
  if (rows === null) return <p role="status" className="text-muted">Loading…</p>;
  if (!rows.length) return <p className="border border-dashed border-ink/30 p-6 text-muted">Nothing waiting for review.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((p) => {
        const high = p.quality_warnings.filter((w) => w.severity === "high").length;
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
            <Link className="font-semibold underline decoration-teal decoration-2 underline-offset-4" href={`/admin/blog/${p.id}`}>{p.title}</Link>
            <span className={`text-sm ${high ? "font-semibold text-red-800" : "text-muted"}`}>{high} high · {p.quality_warnings.length} notes · {p.source_refs.length} sources</span>
          </li>
        );
      })}
    </ul>
  );
}

function History({ fail }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { adminFetch("ai/history").then((r) => (r.ok ? setRows(r.data) : fail(r))); }, [fail]);
  if (rows === null) return <p role="status" className="text-muted">Loading…</p>;
  if (!rows.length) return <p className="border border-dashed border-ink/30 p-6 text-muted">No activity yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Recent AI and publishing activity</caption>
        <thead><tr className="border-b border-ink"><th className="py-2 pr-4">When</th><th className="pr-4">Who</th><th className="pr-4">Action</th><th className="pr-4">Item</th><th>Detail</th></tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id} className="border-b border-line"><td className="py-2 pr-4 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td><td className="pr-4">{a.admin_id ? `admin #${a.admin_id}` : "system/AI"}</td><td className="pr-4">{a.action}</td><td className="pr-4">{a.entity} {a.entity_id}</td><td className="text-muted">{a.detail}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
