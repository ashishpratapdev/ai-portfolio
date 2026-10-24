const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2022-03-01" -> "Mar 2022" (no timezone shifts: parses the string directly). */
export function formatMonth(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Jan 1 -> Dec 31 means "years only" (the resume gives no months), so it renders as "2017 – 2024". */
export function formatDateRange(start, end) {
  if (start && end && /-01-01$/.test(start) && /-12-31$/.test(end)) return `${start.slice(0, 4)} – ${end.slice(0, 4)}`;
  const s = formatMonth(start);
  if (!s) return "";
  return `${s} – ${end ? formatMonth(end) : "Present"}`;
}

export function groupBy(items, key) {
  return items.reduce((acc, item) => {
    (acc[item[key]] ||= []).push(item);
    return acc;
  }, {});
}

/** Turns "Label | https://url" lines into [{label, url}] and back. */
export function parseLinks(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [label, ...rest] = l.split("|");
      return { label: label.trim(), url: rest.join("|").trim() };
    });
}
export const linksToText = (links = []) => links.map((l) => `${l.label} | ${l.url}`).join("\n");

/** Description text with "• " lines becomes {intro, bullets}. */
export function splitBullets(text = "") {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return { intro: lines.filter((l) => !l.startsWith("•")).join(" "), bullets: lines.filter((l) => l.startsWith("•")).map((l) => l.replace(/^•\s*/, "")) };
}

/** "Full Stack Developer | React.js | Node.js" -> {role, tech[]} */
export function splitTagline(tagline = "") {
  const [role, ...tech] = tagline.split("|").map((x) => x.trim()).filter(Boolean);
  return { role: role || "", tech };
}

export const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
