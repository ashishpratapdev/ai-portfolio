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

/** "+12%" / "-3%" / "new" for a month-over-month change. dir: "up" | "down" | "flat". */
export function pctChange(now = 0, prev = 0) {
  if (!prev) return now > 0 ? { text: "new", dir: "up" } : { text: "0%", dir: "flat" };
  const p = Math.round(((now - prev) / prev) * 100);
  return { text: `${p > 0 ? "+" : ""}${p}%`, dir: p > 0 ? "up" : p < 0 ? "down" : "flat" };
}

/** Per-source counts with the three company-board ATS vendors folded into "boards". */
export function groupSourceCounts(by = {}) {
  const out = { remoteok: 0, jobicy: 0, arbeitnow: 0, adzuna: 0, boards: 0 };
  for (const [k, v] of Object.entries(by)) out[["greenhouse", "lever", "ashby"].includes(k) ? "boards" : k] = (out[["greenhouse", "lever", "ashby"].includes(k) ? "boards" : k] || 0) + v;
  return out;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** One-click searches on other platforms, pre-filled from your keywords. These only OPEN each site's own search page;
 *  nothing is scraped and nothing is submitted. */
export function searchLinks(keywords = [], locations = []) {
  const kw = (keywords.find((k) => k && k.trim()) || "software developer").trim();
  const loc = (locations.find((l) => l && l.trim() && l.trim().toLowerCase() !== "remote") || "India").trim();
  const k = encodeURIComponent(kw), l = encodeURIComponent(loc);
  return [
    { group: "Job platforms", name: "LinkedIn", url: `https://www.linkedin.com/jobs/search/?keywords=${k}&location=${l}` },
    { group: "Job platforms", name: "Naukri", url: `https://www.naukri.com/${slug(kw)}-jobs-in-${slug(loc)}` },
    { group: "Job platforms", name: "Indeed India", url: `https://in.indeed.com/jobs?q=${k}&l=${l}` },
    { group: "Job platforms", name: "Google Jobs", url: `https://www.google.com/search?q=${encodeURIComponent(`${kw} jobs ${loc}`)}&ibp=htl;jobs` },
    { group: "MNC career sites", name: "Google", url: `https://www.google.com/about/careers/applications/jobs/results/?q=${k}&location=${l}` },
    { group: "MNC career sites", name: "Microsoft", url: `https://jobs.careers.microsoft.com/global/en/search?q=${k}&lc=${l}` },
    { group: "MNC career sites", name: "Amazon", url: `https://www.amazon.jobs/en/search?base_query=${k}&loc_query=${l}` },
    { group: "MNC career sites", name: "Accenture", url: `https://www.accenture.com/in-en/careers/jobsearch?jk=${k}&sb=1&vs=true` },
  ];
}

/** CSV cell with spreadsheet-formula protection (=, +, -, @ get a leading apostrophe). */
export function csvCell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(jobs = []) {
  const head = ["Title", "Company", "Location", "Source", "Fit score", "Status", "Posted", "Applied", "Link"];
  const rows = jobs.map((j) => [j.title, j.company, j.location, j.source_name || j.source, j.fit_score, j.status, (j.posted_at || "").slice(0, 10), (j.applied_at || "").slice(0, 10), j.url]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
