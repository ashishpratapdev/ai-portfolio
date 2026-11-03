import test from "node:test";
import assert from "node:assert/strict";
import { avatarColor, bucketByMonth, countBy, donutArcs, lastMonths, niceMax, smoothPath, summarise } from "../lib/dashboard.js";

const NOW = new Date(2026, 10, 15); // 15 Nov 2026

test("lastMonths returns n months oldest-first across year boundaries", () => {
  assert.deepEqual(lastMonths(3, NOW).map((m) => m.key), ["2026-09", "2026-10", "2026-11"]);
  assert.deepEqual(lastMonths(3, new Date(2026, 0, 10)).map((m) => m.key), ["2025-11", "2025-12", "2026-01"]);
  assert.equal(lastMonths(6, NOW).length, 6);
});

test("bucketByMonth ignores out-of-range and bad dates, and splits series", () => {
  const months = lastMonths(3, NOW);
  const rows = bucketByMonth([
    { created_at: new Date(2026, 10, 2).toISOString(), status: "new" },
    { created_at: new Date(2026, 10, 9).toISOString(), status: "replied" },
    { created_at: new Date(2026, 8, 20).toISOString(), status: "new" },
    { created_at: new Date(2024, 0, 1).toISOString(), status: "new" },
    { created_at: "garbage", status: "new" },
  ], months, "created_at", (i) => i.status);
  assert.deepEqual(rows.map((r) => r.counts), [{ new: 1 }, {}, { new: 1, replied: 1 }]);
});

test("niceMax always gives a drawable axis", () => {
  assert.deepEqual([0, 3, 4, 5, 7, 11, 13, 40, 51].map(niceMax), [4, 4, 4, 6, 8, 15, 15, 40, 75]);
});

test("smoothPath handles 0, 1 and many points and respects clamping", () => {
  assert.equal(smoothPath([]), "");
  assert.equal(smoothPath([{ x: 1, y: 2 }]), "M1,2");
  const d = smoothPath([{ x: 0, y: 100 }, { x: 10, y: 0 }, { x: 20, y: 100 }], 0, 100);
  assert.match(d, /^M0,100 C/);
  for (const n of d.match(/-?\d+(\.\d+)?/g).map(Number)) assert.ok(n >= 0 && n <= 100, `out of range: ${n}`);
});

test("donutArcs sums to the circumference and handles empty data", () => {
  const arcs = donutArcs([{ value: 1 }, { value: 3 }], 100);
  assert.equal(arcs[0].dash + arcs[1].dash, 100);
  assert.deepEqual(arcs.map((a) => a.pct), [25, 75]);
  assert.equal(arcs[1].offset, -25);
  assert.deepEqual(donutArcs([{ value: 0 }], 100)[0].dash, 0);
});

test("countBy and avatarColor are stable", () => {
  assert.deepEqual(countBy([{ s: "a" }, { s: "b" }, { s: "a" }], (x) => x.s), { a: 2, b: 1 });
  assert.equal(avatarColor("Asha"), avatarColor("Asha"));
  assert.ok(/^#[0-9A-F]{6}$/i.test(avatarColor("")));
});

test("summarise counts real records only and excludes spam from inquiry stats", () => {
  const inq = (status, m = 10) => ({ status, created_at: new Date(2026, m, 3).toISOString() });
  const s = summarise({
    projects: [{ status: "published" }, { status: "draft" }],
    skills: [{ status: "published" }, { status: "archived" }],
    blog: [{ state: "published", created_at: new Date(2026, 10, 1).toISOString() }, { state: "in_review", created_at: new Date(2026, 9, 1).toISOString() }, { state: "rejected", created_at: new Date(2026, 9, 2).toISOString() }],
    inquiries: [inq("new"), inq("replied"), inq("spam"), inq("new", 9)],
  }, NOW);
  assert.deepEqual(s.cards, { projectsPublished: 1, projectsTotal: 2, postsPublished: 1, postsInReview: 1, inquiriesNew: 2, inquiriesTotal: 3 });
  assert.deepEqual(s.status, { published: 3, pending: 2, archived: 2 });
  const nov = s.inquiryMonths.find((m) => m.key === "2026-11");
  assert.deepEqual(nov.counts, { open: 1, handled: 1 });
  assert.equal(s.activityMonths.posts.find((m) => m.key === "2026-10").counts.total, 2);
  assert.deepEqual(summarise({}, NOW).cards.inquiriesTotal, 0); // empty account does not crash
});
