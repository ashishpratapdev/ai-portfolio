// Tiny, dependency-free Markdown parser. It outputs a node tree that React renders as elements, so raw HTML in the
// source is never interpreted (it is shown as text) and unsafe link schemes (javascript:, data:) are dropped.

export function safeHref(url) {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(url) ? url : null;
}

export function parseInline(src) {
  const nodes = [];
  let buf = "";
  let i = 0;
  const flush = () => { if (buf) { nodes.push({ type: "text", value: buf }); buf = ""; } };
  while (i < src.length) {
    const ch = src[i];
    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) { flush(); nodes.push({ type: "code", value: src.slice(i + 1, end) }); i = end + 1; continue; }
    }
    if (src.startsWith("**", i)) {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) { flush(); nodes.push({ type: "strong", children: parseInline(src.slice(i + 2, end)) }); i = end + 2; continue; }
    }
    if ((ch === "*" || ch === "_") && !(i > 0 && /\w/.test(src[i - 1]) && ch === "_")) {
      const end = src.indexOf(ch, i + 1);
      if (end > i + 1 && !/\s/.test(src[i + 1]) && !/\s/.test(src[end - 1])) {
        flush(); nodes.push({ type: "em", children: parseInline(src.slice(i + 1, end)) }); i = end + 1; continue;
      }
    }
    if (ch === "[") {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(src.slice(i));
      if (m) { flush(); nodes.push({ type: "link", href: safeHref(m[2]), children: parseInline(m[1]) }); i += m[0].length; continue; }
    }
    buf += ch;
    i++;
  }
  flush();
  return nodes;
}

const BLOCK_START = /^(#{1,6}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s|(-{3,}|\*{3,})\s*$)/;

export function parseMarkdown(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push({ type: "code", lang: fence[1], value: code.join("\n") });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ type: "heading", level: h[1].length, children: parseInline(h[2].trim()) }); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push({ type: "hr" }); i++; continue; }
    if (/^>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push({ type: "quote", children: parseMarkdown(q.join("\n")) });
      continue;
    }
    const ul = /^\s*[-*+]\s+/.test(line);
    const ol = /^\s*\d+[.)]\s+/.test(line);
    if (ul || ol) {
      const re = ul ? /^\s*[-*+]\s+(.*)$/ : /^\s*\d+[.)]\s+(.*)$/;
      const items = [];
      while (i < lines.length && re.test(lines[i])) items.push(parseInline(re.exec(lines[i++])[1]));
      blocks.push({ type: ul ? "ul" : "ol", items });
      continue;
    }
    const p = [lines[i++].trim()]; // always consume at least one line
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) p.push(lines[i++].trim());
    blocks.push({ type: "p", children: parseInline(p.join(" ")) });
  }
  return blocks;
}
