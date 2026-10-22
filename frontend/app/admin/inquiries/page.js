"use client";
import { useCallback, useEffect, useState } from "react";
import AdminShell, { Notice } from "@/components/AdminShell";
import { adminFetch, errorText } from "@/lib/adminApi";

const STATUSES = ["new", "read", "replied", "spam", "archived"];

export default function Inquiries() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });

  const load = useCallback(async () => {
    const r = await adminFetch(`inquiries${status ? `?status=${status}` : ""}`);
    if (r.ok) setRows(r.data); else setMsg({ kind: "error", text: errorText(r.data) });
  }, [status]);
  useEffect(() => { load(); }, [load]);

  async function setSt(i, s) {
    const r = await adminFetch(`inquiries/${i.id}`, { method: "PATCH", json: { status: s } });
    if (r.ok) load(); else setMsg({ kind: "error", text: errorText(r.data) });
  }
  async function del(i) {
    if (!confirm(`Delete the message from ${i.name}? This cannot be undone.`)) return;
    const r = await adminFetch(`inquiries/${i.id}`, { method: "DELETE" });
    if (r.ok) load(); else setMsg({ kind: "error", text: errorText(r.data) });
  }

  return (
    <AdminShell title="Inquiries">
      <Notice kind={msg.kind}>{msg.text}</Notice>
      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="fs" className="text-sm">Show</label>
        <select id="fs" className="field !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {rows === null ? <p role="status" className="text-muted">Loading…</p> : rows.length === 0 ? <p className="border border-dashed border-ink/30 p-6 text-muted">No messages.</p> : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((i) => (
            <li key={i.id} className="py-4">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <strong>{i.name}</strong>
                <a className="underline" href={`mailto:${i.email}`}>{i.email}</a>
                <span className="text-sm text-muted">{new Date(i.created_at).toLocaleString()}</span>
              </div>
              {i.subject && <p className="font-medium">{i.subject}</p>}
              <p className="mt-2 max-w-prose whitespace-pre-wrap">{i.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`s${i.id}`}>Status</label>
                <select id={`s${i.id}`} className="field !w-auto !py-1" value={i.status} onChange={(e) => setSt(i, e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                <button className="btn btn-danger !py-1" onClick={() => del(i)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
