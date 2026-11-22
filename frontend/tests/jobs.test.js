import test from "node:test";
import assert from "node:assert/strict";
import { highWarnings, listToText, parseList, scoreTone, severityClass, timeAgo, wordCount } from "../lib/jobs.js";

test("scoreTone buckets", () => {
  assert.equal(scoreTone(90).label, "Strong match");
  assert.equal(scoreTone(60).label, "Good match");
  assert.equal(scoreTone(40).label, "Possible");
  assert.equal(scoreTone(10).label, "Weak");
  assert.equal(scoreTone(75).label, "Strong match");
});

test("timeAgo handles today, days, weeks, months and bad input", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  assert.equal(timeAgo("2026-11-10T01:00:00Z", now), "today");
  assert.equal(timeAgo("2026-11-09T01:00:00Z", now), "1 day ago");
  assert.equal(timeAgo("2026-11-05T12:00:00Z", now), "5 days ago");
  assert.equal(timeAgo("2026-10-20T12:00:00Z", now), "3 weeks ago");
  assert.equal(timeAgo("2026-05-10T12:00:00Z", now), "6 months ago");
  assert.equal(timeAgo(null, now), "");
  assert.equal(timeAgo("garbage", now), "");
});

test("parseList trims, splits on commas/newlines and dedupes", () => {
  assert.deepEqual(parseList(" react, next.js\nnode ,react,, "), ["react", "next.js", "node"]);
  assert.deepEqual(parseList(""), []);
  assert.equal(listToText(["a", "b"]), "a, b");
});

test("warning helpers", () => {
  assert.equal(highWarnings([{ severity: "high" }, { severity: "low" }, { severity: "high" }]).length, 2);
  assert.match(severityClass("high"), /red/);
  assert.match(severityClass("nonsense"), /border-line/);
  assert.equal(wordCount("  one two\nthree "), 3);
  assert.equal(wordCount(""), 0);
});

import { csvCell, groupSourceCounts, pctChange, searchLinks, toCsv } from "../lib/jobs.js";

test("pctChange covers growth, decline, flat and a zero baseline", () => {
  assert.deepEqual(pctChange(15, 10), { text: "+50%", dir: "up" });
  assert.deepEqual(pctChange(5, 10), { text: "-50%", dir: "down" });
  assert.deepEqual(pctChange(10, 10), { text: "0%", dir: "flat" });
  assert.deepEqual(pctChange(4, 0), { text: "new", dir: "up" });
  assert.deepEqual(pctChange(0, 0), { text: "0%", dir: "flat" });
});

test("groupSourceCounts folds ATS vendors into boards", () => {
  assert.deepEqual(groupSourceCounts({ remoteok: 3, greenhouse: 2, lever: 1, ashby: 4, adzuna: 5 }), { remoteok: 3, jobicy: 0, arbeitnow: 0, adzuna: 5, boards: 7 });
  assert.equal(groupSourceCounts({}).boards, 0);
});

test("searchLinks are well-formed, encoded and never include remote as the location", () => {
  const links = searchLinks(["full stack developer", "react"], ["Remote", "Lucknow"]);
  assert.equal(links.length, 8);
  for (const l of links) assert.match(l.url, /^https:\/\//);
  const li = links.find((l) => l.name === "LinkedIn").url;
  assert.match(li, /keywords=full%20stack%20developer/);
  assert.match(li, /location=Lucknow/);
  assert.equal(links.find((l) => l.name === "Naukri").url, "https://www.naukri.com/full-stack-developer-jobs-in-lucknow");
  assert.ok(links.some((l) => l.group === "MNC career sites" && l.name === "Amazon"));
  const fallback = searchLinks([], []);
  assert.match(fallback.find((l) => l.name === "Indeed India").url, /q=software%20developer&l=India/);
  assert.ok(!searchLinks(["a&b=c d"], []).some((l) => /keywords=a&b/.test(l.url)));        // user text cannot inject extra query params
});

test("CSV export escapes quotes/commas and defuses spreadsheet formulas", () => {
  assert.equal(csvCell('He said "hi", ok'), '"He said ""hi"", ok"');
  assert.equal(csvCell("=HYPERLINK(\"x\")"), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell(null), "");
  const csv = toCsv([{ title: "Dev, React", company: "=Evil", location: "India", source_name: "RemoteOK", fit_score: 80, status: "new", posted_at: "2026-11-01T10:00:00Z", applied_at: null, url: "https://x.com" }]);
  const [head, row] = csv.split("\r\n");
  assert.match(head, /^Title,Company/);
  assert.match(row, /^"Dev, React",'=Evil,India,RemoteOK,80,new,2026-11-01,,https:\/\/x\.com$/);
});
