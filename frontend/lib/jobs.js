// Small pure helpers for the Job hunt admin page.

export function scoreTone(score) {
  if (score >= 75) return { label: "Strong match", cls: "bg-teal text-onaccent" };
  if (score >= 55) return { label: "Good match", cls: "bg-emerald-500/20 text-emerald-200" };
  if (score >= 35) return { label: "Possible", cls: "bg-amber-500/20 text-amber-200" };
  return { label: "Weak", cls: "bg-white/10 text-muted" };
}

export function timeAgo(iso, now = new Date()) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.floor((now.getTime() - t) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export const STATUS_LABEL = { new: "New", saved: "Saved", ready: "Ready to apply", applied: "Applied", interview: "Interview", offer: "Offer", rejected: "Rejected", dismissed: "Dismissed" };
export const STATUS_OPTIONS = Object.keys(STATUS_LABEL);

/** "react, next.js\nnode" -> ["react","next.js","node"] (deduped, trimmed). */
export function parseList(text = "") {
  return [...new Set(text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
}
export const listToText = (list = []) => list.join(", ");

export const severityClass = (sev) =>
  ({ high: "border-red-400/60 bg-red-500/10", medium: "border-amber-400/60 bg-amber-500/10", low: "border-line bg-surface", info: "border-sky-400/50 bg-sky-500/10" })[sev] || "border-line bg-surface";

export const wordCount = (text = "") => text.trim().split(/\s+/).filter(Boolean).length;

/** Blocking = anything the owner must look at before sending. */
export const highWarnings = (warnings = []) => warnings.filter((w) => w.severity === "high");
