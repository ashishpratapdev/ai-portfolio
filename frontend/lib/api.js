const API = process.env.API_URL || "http://localhost:8000";
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Fetch published content. Returns null on 404; throws on other failures (handled by error.js). */
export async function getPublic(path, { revalidate } = {}) {
  // Blog data may be cached briefly (the API never returns drafts, so caches never hold private content).
  const init = revalidate ? { next: { revalidate } } : { cache: "no-store" };
  const res = await fetch(`${API}/api/v1/public${path}`, init);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The content service returned ${res.status}.`);
  return res.json();
}

export function mediaUrl(id) {
  return id ? `${PUBLIC_API}/api/v1/public/media/${id}` : null;
}

export async function resumeAvailable() {
  try {
    const res = await fetch(`${API}/api/v1/public/resume`, { cache: "no-store" });
    res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

export const resumeUrl = () => `${PUBLIC_API}/api/v1/public/resume`;
export { API };
