"use client";
import { useCallback, useEffect, useState } from "react";
import AdminShell, { Notice } from "@/components/AdminShell";
import { adminFetch, errorText } from "@/lib/adminApi";
import { STATUS_LABEL, STATUS_OPTIONS, highWarnings, listToText, parseList, scoreTone, searchLinks, severityClass, timeAgo, wordCount } from "@/lib/jobs";

const TABS = [["active", "To do"], ["new", "New"], ["saved", "Saved"], ["ready", "Ready"], ["applied", "Applied"], ["interview", "Interview"], ["dismissed", "Dismissed"]];

export default function JobHunt() {
  const [cfg, setCfg] = useState(null);
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [tab, setTab] = useState("active");
  const [minScore, setMinScore] = useState(0);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);       // job id shown in the side panel
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const ok = (text) => setMsg({ kind: "ok", text });
  const fail = (r) => setMsg({ kind: "error", text: errorText(r.data) });

  const loadMeta = useCallback(async () => {
    const [c, s] = await Promise.all([adminFetch("jobs/config"), adminFetch("jobs/stats")]);
    if (c.ok) setCfg(c.data); else fail(c);
    if (s.ok) setStats(s.data);
  }, []);
  const loadJobs = useCallback(async () => {
    const params = new URLSearchParams({ status: tab, min_score: String(minScore) });
    if (q.trim()) params.set("q", q.trim());
    const r = await adminFetch(`jobs?${params}`);
    if (r.ok) setJobs(r.data); else fail(r);
  }, [tab, minScore, q]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("open"));
    if (id) setOpen(id);
    if (window.location.hash === "#settings") setShowSettings(true);
  }, []);
  useEffect(() => { const h = () => { loadMeta(); loadJobs(); }; window.addEventListener("jobs-changed", h); return () => window.removeEventListener("jobs-changed", h); }, [loadMeta, loadJobs]);
  useEffect(() => { const t = setTimeout(loadJobs, q ? 300 : 0); return () => clearTimeout(t); }, [loadJobs, q]);

  async function toggle() {
    setBusy("toggle");
    const r = await adminFetch("jobs/toggle", { method: "POST", json: { enabled: !cfg.enabled } });
    setBusy("");
    if (!r.ok) return fail(r);
    setCfg(r.data);
    ok(r.data.enabled ? "Job search is ON. Press “Search now” to fetch jobs." : "Job search is OFF. Nothing will be fetched until you turn it on.");
    loadMeta();
  }
  async function searchNow() {
    setBusy("search");
    const r = await adminFetch("jobs/search", { method: "POST" });
    setBusy("");
    if (!r.ok) return fail(r);
    const failed = Object.entries(r.data.details).filter(([, d]) => d.error || d.skipped).map(([k, d]) => `${k}: ${d.error || d.skipped}`);
    ok(`Search finished: ${r.data.new_count} new job(s) from ${r.data.seen_count} seen.${failed.length ? ` Notes: ${failed.join("; ")}` : ""}`);
    loadMeta(); loadJobs();
  }
  async function quick(job, status) {
    const r = await adminFetch(`jobs/${job.id}`, { method: "PATCH", json: { status } });
    if (!r.ok) return fail(r);
    loadMeta(); loadJobs();
  }

  const counts = stats?.counts || {};
  const tabCount = (k) => (k === "active" ? (counts.new || 0) + (counts.saved || 0) + (counts.ready || 0) : counts[k] || 0);

  return (
    <AdminShell title="Job hunt" subtitle="Finds jobs from public job APIs, scores them against your resume, and prepares an honest application for you to send.">
      <Notice kind={msg.kind}>{msg.text}</Notice>

      {cfg && (
        <section className={`panel-card mb-5 flex flex-wrap items-center justify-between gap-5 border ${cfg.enabled ? "border-teal/60" : "border-line"}`} aria-labelledby="sw">
          <div className="min-w-0 max-w-xl">
            <h2 id="sw" className="font-display text-xl font-bold">Automatic job search is <span className={cfg.enabled ? "text-teal" : "text-muted"}>{cfg.enabled ? "ON" : "OFF"}</span></h2>
            <p className="mt-1 text-sm text-muted">
              {cfg.enabled
                ? `Searching ${cfg.sources.join(", ")} at most every ${cfg.interval_hours} h (when the server or scheduler runs). Turn it off any time.`
                : "No job site is contacted while this is off, not even by the scheduler. Your saved jobs stay available below."}
            </p>
            {cfg.last_run_at && <p className="mt-1 font-mono text-xs text-muted">Last search: {new Date(cfg.last_run_at).toLocaleString()}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button role="switch" aria-checked={cfg.enabled} aria-label="Automatic job search" disabled={busy === "toggle"} onClick={toggle}
              className={`relative h-9 w-16 rounded-full border transition-colors ${cfg.enabled ? "border-teal bg-teal" : "border-line bg-surface"}`}>
              <span className={`absolute top-1 h-7 w-7 rounded-full transition-all ${cfg.enabled ? "left-8 bg-paper" : "left-1 bg-muted"}`} />
            </button>
            <button className="btn btn-primary" disabled={!cfg.enabled || busy === "search"} onClick={searchNow} title={cfg.enabled ? "" : "Turn the switch on first"}>{busy === "search" ? "Searching…" : "Search now"}</button>
            <button className="btn" aria-expanded={showSettings} onClick={() => setShowSettings(!showSettings)}>Settings</button>
          </div>
        </section>
      )}

      {showSettings && cfg && <Settings cfg={cfg} onSaved={(c) => { setCfg(c); ok("Settings saved."); setShowSettings(false); }} fail={fail} />}

      {cfg && <ResumeCard cfg={cfg} onChanged={() => { loadMeta(); loadJobs(); }} fail={fail} ok={ok} />}
      {cfg && <QuickLinks cfg={cfg} />}

      <div role="tablist" aria-label="Job status" className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn !py-1.5 text-xs ${tab === k ? "btn-primary" : ""}`}>{label} <span className="font-mono opacity-80">{tabCount(k)}</span></button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">Min fit <input type="range" min="0" max="90" step="5" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} aria-label="Minimum fit score" /> <span className="w-6 font-mono">{minScore}</span></label>
          <input className="field !w-48 !py-1.5" placeholder="Search title or company" aria-label="Search jobs" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {jobs === null ? <p role="status" className="text-muted">Loading…</p> : jobs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-muted">
          {cfg && !cfg.enabled && !counts.new ? "No jobs yet. Turn the switch ON and press “Search now”." : "Nothing here for these filters."}
        </p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => {
            const tone = scoreTone(j.fit_score);
            return (
              <li key={j.id} className="panel-card !p-4 sm:!p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${tone.cls}`} title={tone.label}><span className="font-display text-xl font-extrabold leading-none">{j.fit_score}</span><span className="text-[9px] uppercase tracking-wider opacity-80">fit</span></div>
                  <div className="min-w-0 flex-1">
                    <button className="text-left font-display text-lg font-bold hover:text-teal" onClick={() => setOpen(j.id)}>{j.title}</button>
                    <p className="text-sm text-muted">{j.company} · {j.location || "Remote"} · <a className="text-teal underline underline-offset-2" href={j.url} target="_blank" rel="noopener noreferrer">{j.source_name} ↗</a> · {timeAgo(j.posted_at) || "date unknown"}{j.salary_text ? ` · ${j.salary_text}` : ""}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Skills you match">{j.fit_reasons?.matched?.slice(0, 6).map((s) => <li key={s} className="chip !border-teal/50 !text-teal">{s}</li>)}{j.fit_reasons?.missing?.slice(0, 3).map((s) => <li key={s} className="chip opacity-60" title="Asked for, not in your profile">{s}</li>)}</ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary !py-1.5 text-xs" onClick={() => setOpen(j.id)}>{j.has_cover_letter ? "Open packet" : "Prepare & apply"}</button>
                    {j.status === "new" && <button className="btn !py-1.5 text-xs" onClick={() => quick(j, "saved")}>Save</button>}
                    {j.status !== "dismissed" ? <button className="btn !py-1.5 text-xs" onClick={() => quick(j, "dismissed")}>Dismiss</button> : <button className="btn !py-1.5 text-xs" onClick={() => quick(j, "new")}>Restore</button>}
                    {j.status !== "new" && <span className="self-center font-mono text-xs text-muted">{STATUS_LABEL[j.status]}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-8 text-xs text-muted">Jobs come from the public APIs of RemoteOK, Jobicy, Arbeitnow and (with a free key) Adzuna India. Every link goes to the original posting. Nothing is ever applied on your behalf.</p>

      {open && <Packet jobId={open} onClose={() => setOpen(null)} onChanged={() => { loadMeta(); loadJobs(); }} fail={fail} ok={ok} />}
    </AdminShell>
  );
}

function ResumeCard({ cfg, onChanged, fail, ok }) {
  const r = cfg.resume || { uploaded: false };
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  async function run(label, req, done) {
    setBusy(label);
    const res = await req();
    setBusy("");
    if (!res.ok) return fail(res);
    ok(done(res.data));
    onChanged();
  }
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    run("up", () => adminFetch("jobs/resume/upload", { method: "POST", body: fd }), (d) => `Resume read: ${d.skills.length} skills and ${d.titles.length} job title(s) found.`);
  };
  return (
    <section id="resume" className="panel-card mb-5" aria-labelledby="rs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl"><h2 id="rs" className="font-display text-xl font-bold">Your resume {r.uploaded && <span className="pill ml-2 bg-mark text-teal">✓ loaded</span>}</h2>
          <p className="mt-1 text-sm text-muted">The search and your AI cover letters are built from this. It is read on the server, stored privately in your database, and never shown on your public site.</p></div>
        <div className="flex flex-wrap gap-2">
          <label className={`btn btn-primary cursor-pointer ${busy === "up" ? "opacity-60" : ""}`}>{busy === "up" ? "Reading…" : r.uploaded ? "Replace file" : "Upload PDF / text"}<input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={upload} disabled={busy === "up"} /></label>
          <button className="btn" onClick={() => setPaste(!paste)} aria-expanded={paste}>Paste text</button>
        </div>
      </div>
      {paste && (
        <div className="mt-4"><label className="label" htmlFor="pt">Resume text</label><textarea id="pt" className="field min-h-48" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary mt-2" disabled={text.trim().length < 80 || busy === "txt"} onClick={() => run("txt", () => adminFetch("jobs/resume/text", { method: "POST", json: { text } }), (d) => `Resume read: ${d.skills.length} skills found.`).then(() => { setText(""); setPaste(false); })}>Save resume text</button></div>
      )}
      {r.uploaded ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div><h3 className="eyebrow mb-2">Skills found ({r.skills.length})</h3><ul className="flex flex-wrap gap-1.5">{r.skills.map((s) => <li key={s} className="chip">{s}</li>)}</ul></div>
          <div><h3 className="eyebrow mb-2">Roles &amp; experience</h3>
            <ul className="list-disc pl-5 text-sm">{r.titles.map((t) => <li key={t}>{t}</li>)}</ul>
            {r.years ? <p className="mt-1 text-sm text-muted">Experience stated: {r.years}+ years</p> : null}
            <p className="mt-1 font-mono text-xs text-muted">{r.filename} · {new Date(r.uploaded_at).toLocaleDateString()}</p></div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-2 rounded-2xl bg-panel p-3 text-sm">
            <span className="text-muted">Suggested search keywords:</span>{r.keywords.map((k) => <span key={k} className="chip">{k}</span>)}
            <button className="btn btn-primary ml-auto !py-1.5 text-xs" disabled={busy === "kw"} onClick={() => run("kw", () => adminFetch("jobs/resume/apply-keywords", { method: "POST" }), () => "Search keywords and experience updated from your resume.")}>Use for my search</button>
            <button className="btn btn-danger !py-1.5 text-xs" onClick={() => confirm("Remove the stored resume? Your saved jobs stay.") && run("rm", () => adminFetch("jobs/resume", { method: "DELETE" }), () => "Resume removed.")}>Remove</button>
          </div>
        </div>
      ) : <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">No resume yet. Upload a PDF (up to 2 MB) or paste the text. Until then the search uses the skills from your portfolio.</p>}
    </section>
  );
}

function QuickLinks({ cfg }) {
  const links = searchLinks(cfg.keywords, cfg.locations);
  const groups = [...new Set(links.map((l) => l.group))];
  return (
    <section className="panel-card mb-5" aria-labelledby="ql">
      <h2 id="ql" className="font-display text-lg font-bold">Search other platforms</h2>
      <p className="mt-1 text-sm text-muted">One click opens each site&apos;s own search with your keywords filled in. Nothing is scraped. Apply there yourself, using the packet from a matching job.</p>
      <div className="mt-3 space-y-2">{groups.map((g) => (
        <div key={g} className="flex flex-wrap items-center gap-2"><span className="w-36 text-xs font-semibold uppercase tracking-wider text-muted">{g}</span>
          {links.filter((l) => l.group === g).map((l) => <a key={l.name} className="btn !py-1.5 text-xs" href={l.url} target="_blank" rel="noopener noreferrer">{l.name} ↗</a>)}</div>))}</div>
    </section>
  );
}

function Settings({ cfg, onSaved, fail }) {
  const [f, setF] = useState({ ...cfg, keywords: listToText(cfg.keywords), exclude_keywords: listToText(cfg.exclude_keywords), locations: listToText(cfg.locations), company_boards: (cfg.company_boards || []).join("\n") });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const toggleSource = (k) => setF({ ...f, sources: f.sources.includes(k) ? f.sources.filter((x) => x !== k) : [...f.sources, k] });
  async function save(e) {
    e.preventDefault();
    const body = { keywords: parseList(f.keywords), exclude_keywords: parseList(f.exclude_keywords), locations: parseList(f.locations), remote_only: f.remote_only, sources: f.sources, company_boards: parseList(f.company_boards), apply_goal: Number(f.apply_goal),
      min_fit_score: Number(f.min_fit_score), max_new_per_run: Number(f.max_new_per_run), interval_hours: Number(f.interval_hours), my_years: Number(f.my_years), max_preps_per_day: Number(f.max_preps_per_day) };
    const r = await adminFetch("jobs/config", { method: "PUT", json: body });
    if (r.ok) onSaved(r.data); else fail(r);
  }
  return (
    <form onSubmit={save} className="panel-card mb-5 grid gap-4 md:grid-cols-2">
      <div><label className="label" htmlFor="kw">Keywords to look for (comma-separated)</label><textarea id="kw" className="field min-h-20" value={f.keywords} onChange={set("keywords")} /></div>
      <div><label className="label" htmlFor="ex">Skip titles containing</label><textarea id="ex" className="field min-h-20" value={f.exclude_keywords} onChange={set("exclude_keywords")} /></div>
      <div><label className="label" htmlFor="lo">Locations you can work from</label><input id="lo" className="field" value={f.locations} onChange={set("locations")} /><p className="mt-1 text-xs text-muted">Remote jobs limited to other regions (e.g. “USA only”) are skipped.</p></div>
      <fieldset><legend className="label">Sources</legend>
        {f.available_sources.map((s) => (
          <label key={s.key} className={`mb-1 flex items-center gap-2 text-sm ${s.available ? "" : "opacity-50"}`}>
            <input type="checkbox" disabled={!s.available} checked={f.sources.includes(s.key)} onChange={() => toggleSource(s.key)} /> {s.name}{!s.available && <span className="text-xs text-muted"> (needs ADZUNA_APP_ID and ADZUNA_APP_KEY on the server)</span>}
          </label>
        ))}
        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.remote_only} onChange={set("remote_only")} /> Remote jobs only</label>
      </fieldset>
      <div className="md:col-span-2" id="boards">
        <label className="label" htmlFor="cb">Company career boards (one per line) for MNCs and startups</label>
        <textarea id="cb" className="field min-h-24 font-mono text-xs" placeholder={"greenhouse:stripe\nlever:spotify\nashby:notion"} value={f.company_boards} onChange={set("company_boards")} />
        <p className="mt-1 text-xs text-muted">Format <code>greenhouse:name</code>, <code>lever:name</code> or <code>ashby:name</code>, where name is the company&apos;s board name in its careers URL (jobs.lever.co/<b>name</b>). Up to 10 boards per search. Add India cities (Bengaluru, Hyderabad, Pune…) to Locations to see their on-site jobs. Companies with their own portals (Google, Amazon, TCS, Infosys…) have no public API: use the platform links above.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-6">
        {[["apply_goal", "Applications goal / month"], ["min_fit_score", "Min fit (0-100)"], ["max_new_per_run", "Max new / run"], ["interval_hours", "Every (hours, ≥6)"], ["my_years", "My years of experience"], ["max_preps_per_day", "AI packets / day"]].map(([k, l]) => (
          <div key={k}><label className="label" htmlFor={k}>{l}</label><input id={k} type="number" className="field" value={f[k]} onChange={set(k)} /></div>
        ))}
      </div>
      <div className="md:col-span-2"><button className="btn btn-primary">Save settings</button></div>
    </form>
  );
}

function Packet({ jobId, onClose, onChanged, fail, ok }) {
  const [job, setJob] = useState(null);
  const [letter, setLetter] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const r = await adminFetch(`jobs/${jobId}`);
    if (r.ok) { setJob(r.data); setLetter(r.data.cover_letter || ""); setNotes(r.data.notes || ""); } else fail(r);
  }, [jobId, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);

  async function patch(json, text) {
    const r = await adminFetch(`jobs/${jobId}`, { method: "PATCH", json });
    if (!r.ok) return fail(r);
    setJob(r.data); if (text) ok(text); onChanged();
  }
  async function prepare() {
    setBusy("prep");
    const r = await adminFetch(`jobs/${jobId}/prepare`, { method: "POST" });
    setBusy("");
    if (!r.ok) return fail(r);
    setJob(r.data); setLetter(r.data.cover_letter || ""); ok("Application packet ready. Read it carefully and fix anything that is not true."); onChanged();
  }
  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); ok(`${what} copied.`); } catch { fail({ data: { detail: "Could not copy automatically. Select the text and copy it." } }); }
  }
  async function openAndApply() {
    if (letter) await copy(letter, "Cover letter");
    window.open(job.url, "_blank", "noopener,noreferrer");
  }

  const high = highWarnings(job?.prep_warnings);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-label="Job application packet" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-panel p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
        {!job ? <p role="status" className="text-muted">Loading…</p> : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-display text-2xl font-extrabold">{job.title}</h2><p className="text-muted">{job.company} · {job.location || "Remote"}</p></div>
              <button className="btn !py-1.5 text-xs" onClick={onClose}>Close</button>
            </div>
            <p className="mt-2 text-sm"><span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreTone(job.fit_score).cls}`}>{job.fit_score} · {scoreTone(job.fit_score).label}</span>{" "}
              <a className="ml-2 text-teal underline underline-offset-2" href={job.url} target="_blank" rel="noopener noreferrer">View on {job.source_name} ↗</a></p>

            <section className="mt-5" aria-labelledby="fit"><h3 id="fit" className="eyebrow mb-2">Why it fits</h3>
              <ul className="flex flex-wrap gap-1.5">{job.fit_reasons.matched.map((s) => <li key={s} className="chip !border-teal/50 !text-teal">✓ {s}</li>)}{job.fit_reasons.missing.map((s) => <li key={s} className="chip opacity-70">✗ {s}</li>)}</ul>
              {job.fit_reasons.notes.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-muted">{job.fit_reasons.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            </section>

            <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold">Job description (from the source, untrusted text)</summary><p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded-xl bg-surface p-4 text-sm text-muted">{job.description || "No description provided."}</p></details>

            <section className="mt-6" aria-labelledby="pk">
              <div className="mb-2 flex items-center justify-between gap-3"><h3 id="pk" className="eyebrow">Your application packet</h3>
                <button className="btn btn-primary !py-1.5 text-xs" disabled={busy === "prep"} onClick={prepare}>{busy === "prep" ? "Writing…" : job.cover_letter ? "Regenerate with AI" : "Prepare with AI"}</button></div>
              <p className="mb-3 text-xs text-muted">The AI only reuses facts from your own profile and resume. It never applies for you. You read, edit, and submit it yourself.</p>
              {job.cover_letter || letter ? (
                <>
                  {job.prep_warnings.length > 0 && (
                    <ul className="mb-3 space-y-2" aria-label="Review notes">{job.prep_warnings.map((w, i) => <li key={i} className={`rounded-lg border-l-4 px-3 py-2 text-sm ${severityClass(w.severity)}`}><strong>{w.code.replaceAll("_", " ")}</strong>: {w.message}</li>)}</ul>
                  )}
                  {high.length > 0 && <p role="alert" className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-800">{high.length} serious issue(s) above. Fix them before you send anything.</p>}
                  <label className="label" htmlFor="cl">Cover letter ({wordCount(letter)} words, editable)</label>
                  <textarea id="cl" className="field min-h-64" value={letter} onChange={(e) => setLetter(e.target.value)} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="btn !py-1.5 text-xs" onClick={() => patch({ cover_letter: letter }, "Letter saved.")} disabled={letter === (job.cover_letter || "")}>Save edits</button>
                    <button className="btn !py-1.5 text-xs" onClick={() => copy(letter, "Cover letter")}>Copy letter</button>
                  </div>
                  {job.highlights.length > 0 && (<div className="mt-4"><h4 className="text-sm font-semibold">Resume highlights to emphasise</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{job.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                    <button className="btn mt-2 !py-1.5 text-xs" onClick={() => copy(job.highlights.map((h) => `• ${h}`).join("\n"), "Highlights")}>Copy highlights</button></div>)}
                </>
              ) : <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">No packet yet. “Prepare with AI” writes a tailored cover letter and highlights from your resume.</p>}
            </section>

            <section className="mt-6 space-y-3" aria-labelledby="ap"><h3 id="ap" className="eyebrow">Apply</h3>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={openAndApply}>{letter ? "Copy letter & open job page ↗" : "Open job page ↗"}</button>
                <button className="btn" onClick={() => confirm("Mark as applied? Only do this after you really submitted the application.") && patch({ status: "applied" }, "Marked as applied.")} disabled={job.status === "applied"}>I applied</button>
                <button className="btn" onClick={() => patch({ status: "dismissed" }, "Dismissed.")}>Dismiss</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                <div><label className="label" htmlFor="st">Status</label>
                  <select id="st" className="field" value={job.status} onChange={(e) => patch({ status: e.target.value }, `Status: ${STATUS_LABEL[e.target.value]}.`)}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
                  {job.applied_at && <p className="mt-1 font-mono text-xs text-muted">Applied {new Date(job.applied_at).toLocaleDateString()}</p>}</div>
                <div><label className="label" htmlFor="nt">Notes</label><textarea id="nt" className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (job.notes || "") && patch({ notes })} /></div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
