"use client";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, errorText } from "@/lib/adminApi";
import { Notice } from "./AdminShell";

const emptyForm = (fields) =>
  Object.fromEntries(fields.map((f) => [f.name, f.default ?? ""]));

function toForm(fields, item) {
  return Object.fromEntries(
    fields.map((f) => {
      const v = item[f.name];
      return [f.name, f.type === "list" ? (v || []).join(", ") : v ?? ""];
    })
  );
}

function toPayload(fields, form) {
  const out = {};
  for (const f of fields) {
    let v = form[f.name];
    if (f.type === "list") v = v.split(",").map((s) => s.trim()).filter(Boolean);
    else if (f.type === "number") v = v === "" ? null : Number(v);
    else if (typeof v === "string") v = v.trim() === "" && !f.required ? null : v;
    out[f.name] = v;
  }
  return out;
}

export default function ResourceManager({ resource, config }) {
  const { fields } = config;
  const label = (i) => ({ skills: i.name, experience: `${i.role}, ${i.company}`, projects: i.title, services: i.title })[resource];
  const sub = (i) => ({ skills: i.category, experience: `${i.start_date} → ${i.end_date || "present"}`, projects: `/projects/${i.slug}`, services: i.price_note || "" })[resource];

  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | item
  const [form, setForm] = useState(emptyForm(fields));
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await adminFetch(`${resource}${filter ? `?status=${filter}` : ""}`);
    if (r.ok) setItems(r.data);
    else setMsg({ kind: "error", text: errorText(r.data) });
  }, [resource, filter]);

  useEffect(() => { load(); }, [load]);

  const done = (text) => setMsg({ kind: "ok", text });
  const fail = (r) => setMsg({ kind: "error", text: errorText(r.data) });

  function startNew() { setEditing("new"); setForm(emptyForm(fields)); setMsg({ kind: "", text: "" }); }
  function startEdit(item) { setEditing(item); setForm(toForm(fields, item)); setMsg({ kind: "", text: "" }); }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const payload = toPayload(fields, form);
    const isNew = editing === "new";
    const r = await adminFetch(isNew ? resource : `${resource}/${editing.id}`, { method: isNew ? "POST" : "PATCH", json: payload });
    setBusy(false);
    if (!r.ok) return fail(r);
    done(isNew ? "Created as a draft. Publish it to show it on the site." : "Saved.");
    setEditing(null);
    load();
  }

  async function act(item, action) {
    if (action === "archive" && !confirm(`Archive "${label(item)}"? It will be hidden from the site.`)) return;
    const r = await adminFetch(`${resource}/${item.id}/${action}`, { method: "POST" });
    if (!r.ok) return fail(r);
    done(`${action === "publish" ? "Published" : action === "unpublish" ? "Unpublished" : action === "archive" ? "Archived" : "Restored as draft"}.`);
    load();
  }

  async function move(index, dir) {
    const ids = items.map((i) => i.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    const r = await adminFetch(`${resource}/reorder`, { method: "POST", json: { ids } });
    if (!r.ok) return fail(r);
    done("Order saved.");
    load();
  }

  return (
    <div>
      <Notice kind={msg.kind}>{msg.text}</Notice>

      {editing ? (
        <form onSubmit={save} className="mb-10 max-w-xl space-y-4 border border-ink/30 bg-white p-5">
          <h2 className="text-xl font-semibold">{editing === "new" ? "New item" : "Edit item"}</h2>
          {fields.map((f) => (
            <div key={f.name}>
              <label className="label" htmlFor={f.name}>{f.label}{f.required && " *"}</label>
              {f.type === "textarea" ? (
                <textarea id={f.name} className="field min-h-32" required={f.required} value={form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
              ) : (
                <input id={f.name} className="field" required={f.required}
                  type={f.type === "url" ? "url" : f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  value={form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="flex gap-3">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" onClick={startNew}>Add new</button>
          <label className="text-sm" htmlFor="filter">Show </label>
          <select id="filter" className="field !w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option><option value="draft">Drafts</option><option value="published">Published</option><option value="archived">Archived</option>
          </select>
        </div>
      )}

      {items === null ? (
        <p role="status" className="text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="border border-dashed border-ink/30 p-6 text-muted">Nothing here yet. Use “Add new” to create your first item.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((item, idx) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{label(item)}</p>
                <p className="text-sm text-muted">{sub(item)} · <span className={item.status === "published" ? "font-semibold text-teal" : ""}>{item.status}</span></p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!filter && <>
                  <button className="btn !px-2 !py-1" aria-label={`Move ${label(item)} up`} onClick={() => move(idx, -1)} disabled={idx === 0}>↑</button>
                  <button className="btn !px-2 !py-1" aria-label={`Move ${label(item)} down`} onClick={() => move(idx, 1)} disabled={idx === items.length - 1}>↓</button>
                </>}
                {item.status !== "archived" && <button className="btn !py-1" onClick={() => startEdit(item)}>Edit</button>}
                {item.status === "draft" && <button className="btn btn-primary !py-1" onClick={() => act(item, "publish")}>Publish</button>}
                {item.status === "published" && <button className="btn !py-1" onClick={() => act(item, "unpublish")}>Unpublish</button>}
                {item.status !== "archived" && <button className="btn btn-danger !py-1" onClick={() => act(item, "archive")}>Archive</button>}
                {item.status === "archived" && <button className="btn !py-1" onClick={() => act(item, "restore")}>Restore</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {filter && <p className="mt-3 text-sm text-muted">Clear the filter to reorder items.</p>}
    </div>
  );
}
