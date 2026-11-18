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
