const API = process.env.API_URL || "https://portfolio-ashish-api.onrender.com";
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || "https://portfolio-ashish-api.onrender.com";

const RETRYABLE = new Set([429, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The free API host sleeps when idle and answers 429/502/503 (or hangs) while it wakes up (~30-60 s).
 *  Retry with backoff instead of showing an error page. */
async function fetchWithRetry(url, init = {}, attempts = 7) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
      if (!RETRYABLE.has(res.status)) return res;
      last = res;
      res.body?.cancel();
    } catch (e) {
      last = e;
    }
    if (i < attempts - 1) await sleep(Math.min(1500 * 2 ** i, 12000));
  }
  if (last instanceof Response) return last;
  throw last;
}

// Wake the API once and let every concurrent request share that wait, instead of firing a burst at a sleeping host.
let awakeAt = 0;
let waking = null;
async function ensureAwake() {
  if (Date.now() - awakeAt < 5 * 60 * 1000) return;
  waking ||= (async () => {
    try {
      const res = await fetchWithRetry(`${API}/health`, { cache: "no-store" }, 8);
      if (res.ok) awakeAt = Date.now();
    } catch {
      /* the data request below reports the real error */
    } finally {
      waking = null;
    }
  })();
  await waking;
}

/** Fetch published content. Returns null on 404; throws on other failures (handled by error.js).
 *  Cached for 30 s by default (blog lists may pass a longer revalidate); the API never returns drafts, so caches hold only public data. */
export async function getPublic(path, { revalidate = 30 } = {}) {
  await ensureAwake();
  const res = await fetchWithRetry(`${API}/api/v1/public${path}`, { next: { revalidate } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The content service returned ${res.status}.`);
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
    await ensureAwake();
    const res = await fetchWithRetry(`${API}/api/v1/public/resume`, { next: { revalidate: 30 } }, 3);
    res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

export const resumeUrl = () => `${PUBLIC_API}/api/v1/public/resume`;
export { API };
