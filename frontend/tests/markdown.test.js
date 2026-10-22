import test from "node:test";
import assert from "node:assert/strict";
import { parseInline, parseMarkdown, safeHref } from "../lib/markdown.js";
import { jsonLd, queryString, xmlEscape } from "../lib/seo.js";

test("headings, paragraphs, lists, quotes, code, hr", () => {
  const b = parseMarkdown("# T\n\nHello **bold** and *it*\nsecond line\n\n- a\n- b\n\n1. x\n2. y\n\n> quote\n\n```js\nlet x = 1;\n```\n\n---");
  assert.deepEqual(b.map((x) => x.type), ["heading", "p", "ul", "ol", "quote", "code", "hr"]);
  assert.equal(b[2].items.length, 2);
  assert.equal(b[5].value, "let x = 1;");
  assert.equal(b[1].children.find((n) => n.type === "strong").children[0].value, "bold");
});

test("javascript: and data: links are dropped, normal links kept", () => {
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("JaVaScRiPt:alert(1)"), null);
  assert.equal(safeHref("data:text/html,x"), null);
  assert.equal(safeHref("//evil.com"), null);
  assert.equal(safeHref("https://ok.com/a"), "https://ok.com/a");
  assert.equal(safeHref("/blog/x"), "/blog/x");
  const n = parseInline("[click](javascript:alert(1)) and [ok](https://a.com)");
  assert.equal(n.find((x) => x.type === "link" && x.children[0].value === "click").href, null);
});

test("raw HTML stays plain text (never becomes markup nodes)", () => {
  const b = parseMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
  for (const blk of b) assert.equal(blk.type, "p");
  assert.equal(b[0].children[0].type, "text");
  assert.match(b[0].children[0].value, /<script>/);
});

test("parser always terminates on odd input", () => {
  for (const s of ["-", "- ", "1)", ">", "```", "#", "# ", "**", "[", "[a](", "*", "_a", "\n\n\n", "a\n- b\n#c"]) {
    assert.ok(Array.isArray(parseMarkdown(s)), s);
  }
  assert.equal(parseMarkdown("snake_case_name stays").flatMap((b) => b.children).some((n) => n.type === "em"), false);
});

test("seo helpers", () => {
  assert.equal(xmlEscape(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
  assert.ok(!jsonLd({ headline: "</script><script>alert(1)" }).includes("<"));
  assert.equal(queryString({ a: 1, b: "", c: undefined, d: "x y" }), "?a=1&d=x+y");
  assert.equal(queryString({}), "");
});
