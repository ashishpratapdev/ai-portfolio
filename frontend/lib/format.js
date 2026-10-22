const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2022-03-01" -> "Mar 2022" (no timezone shifts: parses the string directly). */
export function formatMonth(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function formatDateRange(start, end) {
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
