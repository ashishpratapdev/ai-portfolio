import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

async function load(handler) {
  let srv = null;
  let port = 1; // nothing listens on port 1: connection refused
  if (handler) {
    srv = http.createServer(handler);
    await new Promise((r) => srv.listen(0, r));
    port = srv.address().port;
  }
  process.env.API_URL = `http://127.0.0.1:${port}`;
  process.env.PUBLIC_API_TIMEOUT_MS = "800";
  const mod = await import(`../lib/api.js?v=${Math.random()}`); // fresh module = fresh circuit breaker
  return { ...mod, close: () => srv?.close() };
}
const json = (res, code, body) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(body)); };

test("API unreachable: every public page still gets real resume content, quickly", async () => {
  const api = await load(null);
  const t = Date.now();
  const [profile, skills, exp, projects, services, settings] = await Promise.all(["/profile", "/skills", "/experience", "/projects", "/services", "/settings"].map((p) => api.getPublic(p)));
  assert.equal(profile.full_name, "Ashish Pratap");
  assert.ok(skills.length >= 10 && exp.length === 4 && projects.length === 1 && services.length === 3);
  assert.match(settings.tagline, /Full Stack Developer/);
  assert.ok(Date.now() - t < 5000, "should not wait on a dead API");
  const t2 = Date.now();
  await api.getPublic("/skills");
  assert.ok(Date.now() - t2 < 100, "circuit breaker: next call is instant");
  assert.equal((await api.getPublic("/projects/it-solution-website")).title, "IT Solution Website");
  assert.equal(await api.getPublic("/projects/does-not-exist"), null);
  assert.deepEqual((await api.getPublic("/blog?page=1")).items, []);
  assert.equal(await api.resumeAvailable(), false);
});

test("API returns 500/502: falls back instead of throwing", async () => {
  for (const code of [500, 502, 429]) {
    const api = await load((req, res) => json(res, code, { detail: "boom" }));
    assert.equal((await api.getPublic("/profile")).full_name, "Ashish Pratap", `status ${code}`);
    api.close();
  }
});

test("healthy API wins over the built-in content", async () => {
  const api = await load((req, res) => (req.url.endsWith("/skills") ? json(res, 200, [{ id: 9, name: "Live skill" }]) : json(res, 404, {})));
  assert.equal((await api.getPublic("/skills"))[0].name, "Live skill");
  api.close();
});

test("404s: unpublished profile shows the built-in one; unknown project/post stay 404 (null)", async () => {
  const api = await load((req, res) => json(res, 404, { detail: "nope" }));
  assert.equal((await api.getPublic("/profile")).full_name, "Ashish Pratap");
  assert.equal(await api.getPublic("/projects/zzz"), null);
  assert.equal(await api.getPublic("/blog/some-post"), null);
  api.close();
});

test("STATIC_FALLBACK=0 restores strict behaviour", async () => {
  process.env.STATIC_FALLBACK = "0";
  const api = await load(null);
  await assert.rejects(() => api.getPublic("/profile"), /not responding/);
  delete process.env.STATIC_FALLBACK;
});

test("static content shape matches what the pages read", async () => {
  const { STATIC_CONTENT: S } = await import("../lib/static-content.js");
  assert.ok(S.profile.bio.length > 100 && S.profile.contact_email.includes("@"));
  for (const e of S.experience) assert.ok(e.company && e.role && /^\d{4}-\d{2}-\d{2}$/.test(e.start_date));
  assert.equal(S.experience[3].start_date, "2017-01-01");
  assert.equal(S.experience[3].end_date, "2024-12-31");
  assert.ok(new Set(S.skills.map((s) => s.id)).size === S.skills.length);
});
