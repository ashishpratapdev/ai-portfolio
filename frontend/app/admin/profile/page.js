"use client";
import { useEffect, useState } from "react";
import AdminShell, { Notice } from "@/components/AdminShell";
import { adminFetch, errorText } from "@/lib/adminApi";
import { linksToText, parseLinks } from "@/lib/format";

export default function ProfileAdmin() {
  const [p, setP] = useState(null);
  const [links, setLinks] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });

  useEffect(() => {
    adminFetch("profile").then((r) => {
      if (r.ok) { setP(r.data); setLinks(linksToText(r.data.social_links)); }
      else setMsg({ kind: "error", text: errorText(r.data) });
    });
  }, []);

  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    const body = {
      full_name: p.full_name, headline: p.headline, bio: p.bio,
      location: p.location || null, contact_email: p.contact_email || null,
      photo_media_id: p.photo_media_id ? Number(p.photo_media_id) : null,
      social_links: parseLinks(links),
    };
    const r = await adminFetch("profile", { method: "PUT", json: body });
    if (r.ok) { setP(r.data); setMsg({ kind: "ok", text: "Saved." }); } else setMsg({ kind: "error", text: errorText(r.data) });
  }

  async function toggle() {
    const r = await adminFetch(`profile/${p.status === "published" ? "unpublish" : "publish"}`, { method: "POST" });
    if (r.ok) { setP(r.data); setMsg({ kind: "ok", text: r.data.status === "published" ? "Published." : "Unpublished." }); } else setMsg({ kind: "error", text: errorText(r.data) });
  }

  return (
    <AdminShell title="Profile">
      <Notice kind={msg.kind}>{msg.text}</Notice>
      {!p ? <p role="status" className="text-muted">Loading…</p> : (
        <form onSubmit={save} className="max-w-xl space-y-4">
          <p className="text-sm text-muted">Status: <strong>{p.status}</strong>. Replace every “[PLACEHOLDER]” with your real, verified details before publishing.</p>
          <div><label className="label" htmlFor="fn">Full name *</label><input id="fn" className="field" required value={p.full_name} onChange={set("full_name")} /></div>
          <div><label className="label" htmlFor="hl">Headline *</label><input id="hl" className="field" required value={p.headline} onChange={set("headline")} /></div>
          <div><label className="label" htmlFor="bio">Bio *</label><textarea id="bio" className="field min-h-40" required value={p.bio} onChange={set("bio")} /></div>
          <div><label className="label" htmlFor="loc">Location</label><input id="loc" className="field" value={p.location || ""} onChange={set("location")} /></div>
          <div><label className="label" htmlFor="em">Public contact email</label><input id="em" type="email" className="field" value={p.contact_email || ""} onChange={set("contact_email")} /></div>
          <div><label className="label" htmlFor="ph">Photo media ID (must be a public image)</label><input id="ph" type="number" className="field" value={p.photo_media_id || ""} onChange={set("photo_media_id")} /></div>
          <div><label className="label" htmlFor="ln">Links, one per line: Label | https://…</label><textarea id="ln" className="field min-h-24" value={links} onChange={(e) => setLinks(e.target.value)} /></div>
          <div className="flex gap-3">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn" onClick={toggle}>{p.status === "published" ? "Unpublish" : "Publish"}</button>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
