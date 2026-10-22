"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell, { Notice } from "@/components/AdminShell";
import Markdown from "@/components/Markdown";
import StateBadge from "@/components/StateBadge";
import { adminFetch, errorText } from "@/lib/adminApi";
import { linksToText, parseLinks } from "@/lib/format";

const EMPTY = { title: "", slug: "", excerpt: "", body: "", author_name: "", categories: "", tags: "", sources: "", cover_media_id: "", cover_alt: "", seo_title: "", seo_description: "", canonical_url: "", noindex: false };
const csv = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

const fromPost = (p) => ({
  title: p.title, slug: p.slug, excerpt: p.excerpt, body: p.body, author_name: p.author_name,
  categories: p.categories.join(", "), tags: p.tags.join(", "), sources: linksToText(p.source_refs.map((s) => ({ label: s.title, url: s.url }))),
  cover_media_id: p.cover_media_id ?? "", cover_alt: p.cover_alt ?? "", seo_title: p.seo_title ?? "", seo_description: p.seo_description ?? "",
  canonical_url: p.canonical_url ?? "", noindex: p.noindex,
});
const toPayload = (f) => ({
  title: f.title, slug: f.slug || null, excerpt: f.excerpt, body: f.body, author_name: f.author_name, categories: csv(f.categories), tags: csv(f.tags),
  source_refs: parseLinks(f.sources).map((l) => ({ title: l.label, url: l.url })), cover_media_id: f.cover_media_id ? Number(f.cover_media_id) : null,
  cover_alt: f.cover_alt || null, seo_title: f.seo_title || null, seo_description: f.seo_description || null, canonical_url: f.canonical_url || null, noindex: f.noindex,
});
const SEV = { high: "border-red-700 bg-red-50", medium: "border-amber-600 bg-amber-50", low: "border-line bg-white", info: "border-sky-600 bg-sky-50" };

export default function Editor({ params }) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [saved, setSaved] = useState(JSON.stringify(EMPTY));
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [revs, setRevs] = useState(null);
  const [when, setWhen] = useState("");

  const load = useCallback(async () => {
    const r = await adminFetch(`blog/${id}`);
    if (!r.ok) return setMsg({ kind: "error", text: errorText(r.data) });
    setPost(r.data);
    const form = fromPost(r.data);
    setF(form);
    setSaved(JSON.stringify(form));
  }, [id]);
  useEffect(() => { if (!isNew) load(); }, [isNew, load]);

  const dirty = JSON.stringify(f) !== saved;
  const locked = post?.state === "published";
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const fail = (r) => setMsg({ kind: "error", text: errorText(r.data) });

  async function save(e) {
    e.preventDefault();
    const r = isNew ? await adminFetch("blog", { method: "POST", json: toPayload(f) }) : await adminFetch(`blog/${id}`, { method: "PATCH", json: toPayload(f) });
    if (!r.ok) return fail(r);
    if (isNew) return router.replace(`/admin/blog/${r.data.id}`);
    setPost(r.data);
    const form = fromPost(r.data);
    setF(form);
    setSaved(JSON.stringify(form));
    setMsg({ kind: "ok", text: r.data.approval_invalidated ? "Saved. Your earlier approval was cleared because the content changed; approve this version again." : "Saved." });
  }

  async function act(action, json, okText) {
    const r = await adminFetch(`blog/${id}/${action}`, { method: "POST", json });
    if (!r.ok) return fail(r);
    setPost(r.data);
    const form = fromPost(r.data);
    setF(form);
    setSaved(JSON.stringify(form));
    setMsg({ kind: "ok", text: okText });
  }

  async function remove() {
    if (!confirm("Delete this post permanently?")) return;
    const r = await adminFetch(`blog/${id}`, { method: "DELETE" });
    if (r.ok) router.push("/admin/blog"); else fail(r);
  }

  async function showRevs() {
    const r = await adminFetch(`blog/${id}/revisions`);
    if (r.ok) setRevs(r.data); else fail(r);
  }

  const s = post?.state;
  return (
    <AdminShell title={isNew ? "New post" : "Edit post"}>
      <p className="mb-4 text-sm"><Link href="/admin/blog" className="underline">← All posts</Link></p>
      <Notice kind={msg.kind}>{msg.text}</Notice>

      {post && (
        <section className="mb-8 border border-ink/30 bg-white p-5" aria-labelledby="wf">
          <h2 id="wf" className="flex flex-wrap items-center gap-3 text-xl font-semibold">Workflow <StateBadge state={post.state} />{post.is_ai_generated && <span className="border border-ink px-2 py-0.5 text-xs font-semibold">AI DRAFT</span>}</h2>
          <p className="mt-2 text-sm text-muted">
            Revision <code className="bg-paper px-1">{post.content_hash.slice(0, 12)}</code>
            {post.approved_at && <> · approved {post.approval_valid ? "this exact revision" : "an older revision (no longer valid)"} on {new Date(post.approved_at).toLocaleString()} by admin #{post.approved_by}</>}
            {post.scheduled_at && <> · scheduled for {new Date(post.scheduled_at).toLocaleString()}</>}
          </p>
          {post.rejection_reason && <p className="mt-2 text-sm text-red-800">Rejected: {post.rejection_reason}</p>}
          {dirty && <p className="mt-2 text-sm font-semibold text-amber-800">You have unsaved changes. Save before using workflow actions so you approve what you reviewed.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {s === "draft" && <button className="btn" disabled={dirty} onClick={() => act("review", undefined, "Submitted for review.")}>Submit for review</button>}
            {s === "in_review" && <button className="btn btn-primary" disabled={dirty} onClick={() => act("approve", { revision_hash: post.content_hash }, "Approved this exact revision.")}>Approve this revision</button>}
            {s === "approved" && <button className="btn btn-primary" disabled={dirty} onClick={() => act("publish", undefined, "Published.")}>Publish now</button>}
            {(s === "in_review" || s === "approved") && <button className="btn btn-danger" onClick={() => { const reason = prompt("Reason for rejecting this post:"); if (reason) act("reject", { reason }, "Rejected."); }}>Reject</button>}
            {["in_review", "approved", "scheduled", "rejected", "published"].includes(s) && <button className="btn" onClick={() => act("draft", undefined, s === "published" ? "Unpublished and returned to draft." : "Returned to draft.")}>{s === "published" ? "Unpublish" : "Return to draft"}</button>}
            {s === "scheduled" && <button className="btn" onClick={() => act("unschedule", undefined, "Schedule removed; post is approved but not scheduled.")}>Cancel schedule</button>}
            {(s === "draft" || s === "rejected") && <button className="btn btn-danger" onClick={remove}>Delete</button>}
            {s === "published" && <a className="btn" href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">View live</a>}
          </div>
          {s === "approved" && (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div><label className="label" htmlFor="when">Schedule for (your local time)</label><input id="when" type="datetime-local" className="field" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
              <button className="btn" disabled={!when || dirty} onClick={() => act("schedule", { publish_at: new Date(when).toISOString() }, "Scheduled.")}>Schedule</button>
              <p className="w-full text-xs text-muted">Scheduled posts publish when the scheduler/worker runs (see deployment guide). Approval is re-checked at that moment.</p>
            </div>
          )}
          {post.quality_warnings?.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold">Review notes ({post.quality_warnings.length})</h3>
              <ul className="mt-2 space-y-2">{post.quality_warnings.map((w, i) => <li key={i} className={`border-l-4 px-3 py-2 text-sm ${SEV[w.severity] || SEV.low}`}><strong>{w.code.replaceAll("_", " ")}</strong> ({w.severity}): {w.message}</li>)}</ul>
            </div>
          )}
          <div className="mt-4"><button className="btn !py-1" onClick={showRevs}>Show revisions</button></div>
          {revs && <ul className="mt-3 space-y-1 text-sm">{revs.map((r) => <li key={r.revision_no}>#{r.revision_no} · {r.source === "ai" ? "AI" : `admin #${r.created_by}`} · {new Date(r.created_at).toLocaleString()} · <code>{r.content_hash.slice(0, 12)}</code></li>)}</ul>}
        </section>
      )}

      {locked && <Notice kind="error">This post is published and locked. Unpublish it to edit.</Notice>}
      <form onSubmit={save} className="max-w-3xl space-y-4">
        <fieldset disabled={locked} className="space-y-4">
          <div><label className="label" htmlFor="title">Title *</label><input id="title" required maxLength={200} className="field" value={f.title} onChange={set("title")} /></div>
          <div><label className="label" htmlFor="slug">URL slug (auto from title if blank)</label><input id="slug" maxLength={200} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="field" value={f.slug} onChange={set("slug")} /></div>
          <div><label className="label" htmlFor="excerpt">Excerpt * ({f.excerpt.length}/400)</label><textarea id="excerpt" required maxLength={400} className="field min-h-20" value={f.excerpt} onChange={set("excerpt")} /></div>
          <div>
            <div className="flex items-center justify-between"><label className="label" htmlFor="body">Body (Markdown) *</label><button type="button" className="btn !py-1" onClick={() => setPreview(!preview)}>{preview ? "Edit" : "Preview"}</button></div>
            {preview ? <div className="border border-line bg-white p-5"><h2 className="text-3xl font-bold">{f.title}</h2><Markdown source={f.body} /></div>
              : <textarea id="body" required className="field min-h-96 font-mono" value={f.body} onChange={set("body")} />}
          </div>
          <div><label className="label" htmlFor="author">Author *</label><input id="author" required maxLength={120} className="field" value={f.author_name} onChange={set("author_name")} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="cats">Categories (comma-separated)</label><input id="cats" className="field" value={f.categories} onChange={set("categories")} /></div>
            <div><label className="label" htmlFor="tags">Tags (comma-separated)</label><input id="tags" className="field" value={f.tags} onChange={set("tags")} /></div>
          </div>
          <div><label className="label" htmlFor="src">Source references, one per line: Title | https://…</label><textarea id="src" className="field min-h-20" value={f.sources} onChange={set("sources")} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="cover">Cover image media ID (public image)</label><input id="cover" type="number" className="field" value={f.cover_media_id} onChange={set("cover_media_id")} /></div>
            <div><label className="label" htmlFor="alt">Cover alt text {f.cover_media_id && "*"}</label><input id="alt" maxLength={300} required={Boolean(f.cover_media_id)} className="field" value={f.cover_alt} onChange={set("cover_alt")} /></div>
          </div>
          <div><label className="label" htmlFor="seot">SEO title ({f.seo_title.length}/70)</label><input id="seot" maxLength={70} className="field" value={f.seo_title} onChange={set("seo_title")} /></div>
          <div><label className="label" htmlFor="seod">SEO description ({f.seo_description.length}/170)</label><textarea id="seod" maxLength={170} className="field min-h-16" value={f.seo_description} onChange={set("seo_description")} /></div>
          <div><label className="label" htmlFor="canon">Canonical URL (blank = this site)</label><input id="canon" type="url" className="field" value={f.canonical_url} onChange={set("canonical_url")} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.noindex} onChange={set("noindex")} /> Hide from search engines and the sitemap (noindex)</label>
        </fieldset>
        {!locked && <button className="btn btn-primary">{isNew ? "Create draft" : "Save changes"}</button>}
      </form>
    </AdminShell>
  );
}
