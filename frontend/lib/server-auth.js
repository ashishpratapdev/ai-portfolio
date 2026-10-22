export const COOKIE = "admin_token";

/** Reject cross-site mutating requests (cookie is also SameSite=Strict). */
export function sameOrigin(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
