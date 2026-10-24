import test from "node:test";
import assert from "node:assert/strict";
import { formatDateRange, formatMonth, groupBy, initials, linksToText, parseLinks, splitBullets, splitTagline } from "../lib/format.js";

test("formatMonth handles ISO dates and bad input", () => {
  assert.equal(formatMonth("2022-03-01"), "Mar 2022");
  assert.equal(formatMonth(""), "");
  assert.equal(formatMonth("garbage"), "");
});

test("formatDateRange shows Present for open-ended roles", () => {
  assert.equal(formatDateRange("2021-01-01", null), "Jan 2021 – Present");
  assert.equal(formatDateRange("2021-01-01", "2022-06-30"), "Jan 2021 – Jun 2022");
});

test("groupBy groups by key", () => {
  const g = groupBy([{ c: "a", n: 1 }, { c: "b", n: 2 }, { c: "a", n: 3 }], "c");
  assert.deepEqual(Object.keys(g), ["a", "b"]);
  assert.equal(g.a.length, 2);
});

test("links round-trip", () => {
  const links = parseLinks("GitHub | https://github.com/x\n\nSite | https://a.b/?q=1|2");
  assert.equal(links.length, 2);
  assert.equal(links[1].url, "https://a.b/?q=1|2");
  assert.equal(parseLinks(linksToText(links)).length, 2);
});

test("year-only convention renders years, normal dates still show months", () => {
  assert.equal(formatDateRange("2017-01-01", "2024-12-31"), "2017 – 2024");
  assert.equal(formatDateRange("2024-03-01", "2024-09-30"), "Mar 2024 – Sep 2024");
  assert.equal(formatDateRange("2024-10-01", null), "Oct 2024 – Present");
});

test("splitBullets, splitTagline and initials", () => {
  const r = splitBullets("Intro line\n• one\n• two");
  assert.deepEqual(r, { intro: "Intro line", bullets: ["one", "two"] });
  assert.deepEqual(splitTagline("Full Stack Developer | React.js | Node.js"), { role: "Full Stack Developer", tech: ["React.js", "Node.js"] });
  assert.deepEqual(splitTagline(""), { role: "", tech: [] });
  assert.equal(initials("Ashish Pratap"), "AP");
  assert.equal(initials(""), "");
});
