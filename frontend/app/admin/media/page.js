"use client";
import { useCallback, useEffect, useState } from "react";
import AdminShell, { Notice } from "@/components/AdminShell";
import { adminFetch, errorText } from "@/lib/adminApi";

export default function MediaAdmin() {
  const [items, setItems] = useState(null);
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await adminFetch("media");
    if (r.ok) setItems(r.data); else setMsg({ kind: "error", text: errorText(r.data) });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    const r = await adminFetch("media", { method: "POST", body: new FormData(form) });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: "error", text: errorText(r.data) });
    form.reset();
    setMsg({ kind: "ok", text: "Uploaded. Files are private until you make them public." });
    load();
  }

  async function togglePublic(m) {
    const r = await adminFetch(`media/${m.id}`, { method: "PATCH", json: { is_public: !m.is_public } });
    if (r.ok) load(); else setMsg({ kind: "error", text: errorText(r.data) });
  }

  async function remove(m) {
    if (!confirm(`Delete ${m.original_name}? This cannot be undone.`)) return;
    const r = await adminFetch(`media/${m.id}`, { method: "DELETE" });
    if (r.ok) { setMsg({ kind: "ok", text: "Deleted." }); load(); } else setMsg({ kind: "error", text: errorText(r.data) });
  }

  return (
    <AdminShell title="Media">
      <Notice kind={msg.kind}>{msg.text}</Notice>
      <form onSubmit={upload} className="mb-8 max-w-xl space-y-3 border border-ink/30 bg-white p-5">
        <div><label className="label" htmlFor="file">File (PNG, JPEG, WebP or PDF, max 5 MB)</label><input id="file" name="file" type="file" required accept="image/png,image/jpeg,image/webp,application/pdf" className="field" /></div>
        <div><label className="label" htmlFor="alt">Alt text (for images)</label><input id="alt" name="alt_text" maxLength={300} className="field" /></div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
      </form>
      {items === null ? <p role="status" className="text-muted">Loading…</p> : items.length === 0 ? (
        <p className="border border-dashed border-ink/30 p-6 text-muted">No files yet. Upload your photo, project images and resume PDF.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">ID {m.id}: {m.original_name}</p>
                <p className="text-sm text-muted">{m.content_type} · {(m.size_bytes / 1024).toFixed(0)} KB · {m.is_public ? "public" : "private"}</p>
              </div>
              <button className="btn !py-1" onClick={() => togglePublic(m)}>{m.is_public ? "Make private" : "Make public"}</button>
              <button className="btn btn-danger !py-1" onClick={() => remove(m)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
