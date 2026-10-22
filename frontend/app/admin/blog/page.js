"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell, { Notice } from "@/components/AdminShell";
import StateBadge from "@/components/StateBadge";
import { adminFetch, errorText } from "@/lib/adminApi";

const STATES = ["", "draft", "in_review", "approved", "scheduled", "published", "rejected"];

export default function BlogAdmin() {
  const [posts, setPosts] = useState(null);
  const [state, setState] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setPosts(null);
    adminFetch(`blog${state ? `?state=${state}` : ""}`).then((r) => (r.ok ? setPosts(r.data) : setErr(errorText(r.data))));
  }, [state]);

  return (
    <AdminShell title="Blog">
      <Notice kind="error">{err}</Notice>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/blog/new" className="btn btn-primary">New post</Link>
        <label htmlFor="st" className="text-sm">Show</label>
        <select id="st" className="field !w-auto" value={state} onChange={(e) => setState(e.target.value)}>
          {STATES.map((s) => <option key={s} value={s}>{s ? s.replace("_", " ") : "All"}</option>)}
        </select>
      </div>
      {posts === null ? <p role="status" className="text-muted">Loading…</p> : posts.length === 0 ? (
        <p className="border border-dashed border-ink/30 p-6 text-muted">No posts here yet.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/blog/${p.id}`} className="font-semibold underline decoration-teal decoration-2 underline-offset-4">{p.title}</Link>
                <p className="text-sm text-muted">/blog/{p.slug} · updated {new Date(p.updated_at).toLocaleString()}</p>
              </div>
              {p.is_ai_generated && <span className="border border-ink px-2 py-0.5 text-xs font-semibold">AI DRAFT</span>}
              {p.quality_warnings?.filter((w) => w.severity === "high").length > 0 && <span className="text-xs font-semibold text-red-800">{p.quality_warnings.filter((w) => w.severity === "high").length} high warnings</span>}
              <StateBadge state={p.state} />
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
