// Pure helpers for the admin dashboard: everything is computed from real records, nothing is invented.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Last `n` calendar months ending at `now`, oldest first: [{key:"2026-06", label:"Jun"}, ...] (local time). */
export function lastMonths(n = 6, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTHS[d.getMonth()] });
  }
  return out;
}

export function monthKey(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Counts items per month. `pick(item)` may return a series name so you can split into several series. */
export function bucketByMonth(items, months, dateKey = "created_at", pick = () => "total") {
  const rows = months.map((m) => ({ ...m, counts: {} }));
  const index = Object.fromEntries(rows.map((r) => [r.key, r]));
  for (const it of items || []) {
    const row = index[monthKey(it[dateKey])];
    if (!row) continue;
    const s = pick(it);
    row.counts[s] = (row.counts[s] || 0) + 1;
  }
  return rows;
}

export function countBy(items, fn) {
  const out = {};
  for (const it of items || []) {
    const k = fn(it);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/** A tidy axis maximum: 0..4 -> 4, 7 -> 8, 13 -> 15, 0 -> 4 (so empty charts still draw a grid). */
export function niceMax(max) {
  if (max <= 4) return 4;
  const step = max <= 10 ? 2 : max <= 20 ? 5 : max <= 50 ? 10 : 25;
  return Math.ceil(max / step) * step;
}

/** Smooth SVG path through points (Catmull-Rom -> cubic Bezier), kept inside [minY, maxY]. */
export function smoothPath(pts, minY = -Infinity, maxY = Infinity) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const clamp = (v) => Math.min(maxY, Math.max(minY, v));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const t = 0.18;
    d += ` C${p1.x + (p2.x - p0.x) * t},${clamp(p1.y + (p2.y - p0.y) * t)} ${p2.x - (p3.x - p1.x) * t},${clamp(p2.y - (p3.y - p1.y) * t)} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Donut segments -> [{...seg, dash, offset, pct}] for stroke-dasharray rendering on a circle of circumference `c`. */
export function donutArcs(segments, c) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  return segments.map((s) => {
    const frac = total ? s.value / total : 0;
    const arc = { ...s, dash: frac * c, offset: -acc * c, pct: Math.round(frac * 100) };
    acc += frac;
    return arc;
  });
}

const PALETTE = ["#B8F34A", "#2DD4BF", "#5B7C99", "#F5C84B", "#8B8FF5"];
export const colorFor = (i) => PALETTE[i % PALETTE.length];

/** Deterministic avatar colour from a name. */
export function avatarColor(name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function summarise({ projects = [], blog = [], inquiries = [], skills = [], services = [], experience = [] }, now = new Date()) {
  const months = lastMonths(6, now);
  const handled = (i) => ["replied", "read", "archived"].includes(i.status) ? "handled" : "open";
  const real = inquiries.filter((i) => i.status !== "spam");
  const portfolio = [...projects, ...skills, ...services, ...experience];
  const status = {
    published: portfolio.filter((x) => x.status === "published").length + blog.filter((p) => p.state === "published").length,
    pending: portfolio.filter((x) => x.status === "draft").length + blog.filter((p) => ["draft", "in_review", "approved", "scheduled"].includes(p.state)).length,
    archived: portfolio.filter((x) => x.status === "archived").length + blog.filter((p) => p.state === "rejected").length,
  };
  return {
    cards: {
      projectsPublished: projects.filter((p) => p.status === "published").length,
      projectsTotal: projects.length,
      postsPublished: blog.filter((p) => p.state === "published").length,
      postsInReview: blog.filter((p) => p.state === "in_review").length,
      inquiriesNew: inquiries.filter((i) => i.status === "new").length,
      inquiriesTotal: real.length,
    },
    inquiryMonths: bucketByMonth(real, months, "created_at", handled),
    activityMonths: { inquiries: bucketByMonth(real, months), posts: bucketByMonth(blog, months) },
    status,
  };
}
