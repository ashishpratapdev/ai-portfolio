const API = process.env.API_URL || "http://localhost:8000";
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

import { STATIC_CONTENT as S } from "./static-content.js";

const FALLBACK = process.env.STATIC_FALLBACK !== "0";
const TIMEOUT_MS = Number(process.env.PUBLIC_API_TIMEOUT_MS || 3500);
const RETRYABLE = new Set([429, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Built-in resume content, served when the API is asleep/unreachable so the public site ALWAYS opens. */
export function staticFor(path) {
  const [p] = path.split("?");
  switch (p) {
    case "/profile": return S.profile;
    case "/skills": return S.skills;
    case "/experience": return S.experience;
    case "/projects": return S.projects;
    case "/services": return S.services;
    case "/settings": return S.settings;
    case "/blog": return { items: [], total: 0, page: 1, page_size: 10, pages: 1 };
    case "/blog-filters": return { categories: [], tags: [] };
    case "/sitemap":
      return [...["/", "/about", "/experience", "/projects", "/services", "/resume", "/contact", "/blog"], ...S.projects.map((x) => `/projects/${x.slug}`)]
        .map((path) => ({ path, lastmod: null }));
    default: {
      const m = /^\/projects\/([^/]+)$/.exec(p);
      return m ? S.projects.find((x) => x.slug === decodeURIComponent(m[1])) || null : null;
    }
  }
}

// Circuit breaker: after a failure, skip the API for a while so pages open instantly from the built-in content
// instead of every request waiting on a sleeping host. One background ping wakes it for the next visitor.
let downUntil = 0;
let waking = false;
function wake() {
  if (waking) return;
  waking = true;
  fetch(`${API}/health`, { cache: "no-store", signal: AbortSignal.timeout(60000) }).catch(() => {}).finally(() => { waking = false; });
}

/** Returns a Response, or null if the API is down/asleep (never waits more than ~8 s in total). */
async function tryApi(url, init = {}) {
  if (Date.now() < downUntil) return null;
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!RETRYABLE.has(res.status) && res.status < 500) { downUntil = 0; return res; }
      res.body?.cancel();
    } catch {
      /* timeout / connection refused: treated as "asleep" */
    }
    if (i === 0) await sleep(600);
  }
  downUntil = Date.now() + 20_000;
  wake();
  return null;
}

/** Fetch published content (cached 30 s). 404 -> null, except the profile: if it is not published yet the built-in
 *  profile is shown. API asleep/erroring -> built-in resume content (set STATIC_FALLBACK=0 to throw instead). */
export async function getPublic(path, { revalidate = 30 } = {}) {
  const res = await tryApi(`${API}/api/v1/public${path}`, { next: { revalidate } });
  if (!res || (!res.ok && res.status !== 404)) {
    if (!FALLBACK) throw new Error("The content service is not responding.");
    return staticFor(path);
  }
  if (res.status === 404) return FALLBACK && path.split("?")[0] === "/profile" ? staticFor("/profile") : null;
  return res.json();
}

/** The owner's photo: a public media item if set in the profile, otherwise /photo.jpg from frontend/public (survives deploys). */
export function photoSrc(profile) {
  return profile?.photo_media_id ? mediaUrl(profile.photo_media_id) : "/photo.jpg";
}

export function mediaUrl(id) {
  return id ? `${PUBLIC_API}/api/v1/public/media/${id}` : null;
}

export async function resumeAvailable() {
  try {
    const res = await tryApi(`${API}/api/v1/public/resume`, { next: { revalidate: 30 } });
    res?.body?.cancel();
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export const resumeUrl = () => `${PUBLIC_API}/api/v1/public/resume`;
export { API };
