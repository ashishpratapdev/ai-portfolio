"use client";

/** Calls the same-origin proxy. Returns {ok, status, data}. Redirects to login on 401. */
export async function adminFetch(path, { method = "GET", json, body } = {}) {
  const init = { method, headers: {} };
  if (json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (body) {
    init.body = body; // FormData
  }
  let res;
  try {
    res = await fetch(`/api/admin/${path}`, init);
  } catch {
    return { ok: false, status: 0, data: { detail: "Network error. Check your connection and try again." } };
  }
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/admin/login";
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export function errorText(data) {
  const d = data?.detail;
  if (!d) return "Something went wrong. Try again.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => `${(e.loc || []).slice(-1)[0] ?? "field"}: ${e.msg}`).join("; ");
  return "Something went wrong. Try again.";
}
