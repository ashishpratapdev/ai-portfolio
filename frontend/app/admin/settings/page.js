"use client";
import { useEffect, useState } from "react";
import AdminShell, { Notice } from "@/components/AdminShell";
import { adminFetch, errorText } from "@/lib/adminApi";

const FIELDS = [
  ["site_title", "Site title"],
  ["tagline", "Tagline (used as the page description)"],
  ["footer_text", "Footer text"],
  ["resume_media_id", "Resume media ID (a PDF; it must also be marked public)"],
];

export default function SettingsAdmin() {
  const [v, setV] = useState(null);
  const [msg, setMsg] = useState({ kind: "", text: "" });

  useEffect(() => {
    adminFetch("settings").then((r) => (r.ok ? setV(Object.fromEntries(FIELDS.map(([k]) => [k, r.data[k] || ""]))) : setMsg({ kind: "error", text: errorText(r.data) })));
  }, []);

  async function save(e) {
    e.preventDefault();
    const r = await adminFetch("settings", { method: "PUT", json: v });
    setMsg(r.ok ? { kind: "ok", text: "Saved." } : { kind: "error", text: errorText(r.data) });
  }

  return (
    <AdminShell title="Settings">
      <Notice kind={msg.kind}>{msg.text}</Notice>
      {!v ? <p role="status" className="text-muted">Loading…</p> : (
        <form onSubmit={save} className="max-w-xl space-y-4">
          {FIELDS.map(([k, label]) => (
            <div key={k}><label className="label" htmlFor={k}>{label}</label><input id={k} className="field" maxLength={500} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>
          ))}
          <button className="btn btn-primary">Save settings</button>
        </form>
      )}
    </AdminShell>
  );
}
