import time
from datetime import datetime, timezone
from types import SimpleNamespace
from urllib.parse import urlparse

import pytest

from app.ai import runtime
from app.ai.provider import MockProvider
from app.ai.research import FetchError
from app.database import SessionLocal
from app.jobs import service
from app.models import AuditLog, JobListing, JobSearchRun

J = "/api/v1/admin/jobs"
WORKER = {"X-Worker-Token": "worker-secret-token"}


def _now_epoch(days=1):
    return int(time.time()) - days * 86400


def default_data():
    iso = datetime.now(timezone.utc).isoformat()
    return {
        "remoteok.com": [{"legal": "terms"},
                         {"id": "1", "slug": "react-developer", "position": "React Developer", "company": "Acme", "tags": ["react", "javascript", "node"],
                          "description": "We build UIs with React and Node.js. MongoDB a plus.", "location": "Worldwide", "epoch": _now_epoch(),
                          "url": "https://remoteok.com/remote-jobs/react-developer-1"},
                         {"id": "2", "position": "Senior Rust Engineer", "company": "Ferris", "tags": ["rust"], "description": "Rust", "epoch": _now_epoch()},
                         {"id": "3", "position": "Python Backend Developer", "company": "Snake", "tags": ["python", "fastapi"],
                          "description": "Python FastAPI PostgreSQL", "epoch": _now_epoch()},
                         {"id": "4", "position": "Underwater Basket Weaver", "company": "Weave", "tags": ["crafts"], "description": "weaving", "epoch": _now_epoch()}],
        "jobicy.com": {"jobs": [
            {"id": 11, "url": "https://jobicy.com/jobs/11-fullstack", "jobTitle": "Full Stack Developer", "companyName": "Beta", "jobGeo": "Anywhere",
             "jobIndustry": ["Engineering"], "jobType": ["full-time"], "jobDescription": "React Node.js MongoDB Express", "pubDate": iso},
            {"id": 12, "url": "https://jobicy.com/jobs/12-us", "jobTitle": "React Developer", "companyName": "UScorp", "jobGeo": "USA", "jobDescription": "React", "pubDate": iso},
            {"id": 13, "url": "https://jobicy.com/jobs/13-dup", "jobTitle": "React Developer", "companyName": "Acme", "jobGeo": "Anywhere", "jobDescription": "React", "pubDate": iso}]},
        "arbeitnow.com": {"data": [{"slug": "dev-berlin", "company_name": "Corp", "title": "Developer", "remote": False, "location": "Berlin",
                                    "url": "https://www.arbeitnow.com/jobs/dev-berlin", "tags": ["python"], "description": "python", "created_at": _now_epoch()}]},
        "boards-api.greenhouse.io": {"jobs": [
            {"id": 4001, "title": "Software Engineer, Frontend", "absolute_url": "https://boards.greenhouse.io/stripe/jobs/4001", "location": {"name": "Bengaluru, India"},
             "content": "&lt;p&gt;Build UIs with React, Node.js, JavaScript and MongoDB.&lt;/p&gt;", "departments": [{"name": "Engineering"}], "first_published": datetime.now(timezone.utc).isoformat()},
            {"id": 4002, "title": "Account Executive", "absolute_url": "https://boards.greenhouse.io/stripe/jobs/4002", "location": {"name": "San Francisco, CA"}, "content": "&lt;p&gt;Sales&lt;/p&gt;"}]},
        "api.lever.co": [{"id": "lv-1", "text": "Full Stack Engineer", "categories": {"location": "Hyderabad, India", "team": "Web"}, "hostedUrl": "https://jobs.lever.co/spotify/lv-1",
                          "descriptionPlain": "React Node.js Express.js MongoDB", "createdAt": _now_epoch() * 1000},
                         {"id": "lv-2", "text": "Backend Engineer", "categories": {"location": "Remote - USA"}, "workplaceType": "remote", "hostedUrl": "https://jobs.lever.co/spotify/lv-2",
                          "descriptionPlain": "Node.js", "createdAt": _now_epoch() * 1000}],
        "api.ashbyhq.com": {"jobs": []},
        "api.adzuna.com": {"results": [{"id": "A1", "title": "Full Stack Engineer", "description": "React and Node.js", "created": datetime.now(timezone.utc).isoformat(),
                                        "redirect_url": "https://www.adzuna.in/land/ad/A1", "company": {"display_name": "Zeta"}, "location": {"display_name": "Lucknow, India"}}]},
    }


class FakeJobs:
    def __init__(self, data=None, fail=()):
        self.data, self.fail, self.calls = data or default_data(), set(fail), []

    def get_json(self, url, max_bytes=None):
        self.calls.append(url)
        host = urlparse(url).hostname
        if any(f in host for f in self.fail):
            raise FetchError("source is down")
        return self.data[next(k for k in self.data if host.endswith(k))]


@pytest.fixture
def env(client, auth, monkeypatch):
    fetcher, provider = FakeJobs(), MockProvider()
    monkeypatch.setattr("app.jobs.providers.SLEEP", lambda s: None)
    monkeypatch.setattr(runtime, "get_job_fetcher", lambda: fetcher)
    monkeypatch.setattr(runtime, "get_provider", lambda: provider)
    return SimpleNamespace(client=client, auth=auth, fetcher=fetcher, provider=provider)


def on(env):
    r = env.client.post(f"{J}/toggle", json={"enabled": True}, headers=env.auth)
    assert r.status_code == 200 and r.json()["enabled"] is True


def off(env):
    assert env.client.post(f"{J}/toggle", json={"enabled": False}, headers=env.auth).json()["enabled"] is False


def search(env):
    return env.client.post(f"{J}/search", headers=env.auth)


def reset_gap():
    with SessionLocal() as db:
        service.get_config(db).last_run_at = None
        db.query(JobSearchRun).delete()
        db.commit()


def titles(env, **params):
    return [j["title"] for j in env.client.get(J, params=params, headers=env.auth).json()]


# ------------------------------------------------------------------ the master switch
def test_jobs_routes_require_auth(client):
    for method, path in (("get", ""), ("get", "/config"), ("put", "/config"), ("post", "/toggle"), ("post", "/search"), ("get", "/runs"),
                         ("get", "/stats"), ("get", "/1"), ("patch", "/1"), ("post", "/1/prepare")):
        assert getattr(client, method)(f"{J}{path}").status_code == 401, path


def test_default_is_off_and_nothing_is_fetched_while_off(env):
    cfg = env.client.get(f"{J}/config", headers=env.auth).json()
    assert cfg["enabled"] is False
    r = search(env)
    assert r.status_code == 409 and "OFF" in r.json()["detail"]
    t = env.client.post("/api/v1/worker/tick", headers=WORKER).json()
    assert t["job_search"] is None
    assert env.fetcher.calls == [], "no job site may be contacted while the switch is OFF"


def test_turning_off_blocks_again_and_both_switches_are_audited(env):
    on(env)
    assert search(env).status_code == 202
    off(env)
    reset_gap()
    assert search(env).status_code == 409
    with SessionLocal() as db:
        assert {"job_search_on", "job_search_off"} <= {a.action for a in db.query(AuditLog).all()}


def test_config_validation_and_enabled_is_not_editable_through_config(env):
    good = {k: v for k, v in env.client.get(f"{J}/config", headers=env.auth).json().items() if k in
            ("keywords", "exclude_keywords", "locations", "remote_only", "sources", "min_fit_score", "max_new_per_run", "interval_hours", "my_years", "max_preps_per_day")}
    assert env.client.put(f"{J}/config", json=good, headers=env.auth).status_code == 200
    for bad in ({**good, "enabled": True}, {**good, "sources": ["linkedin"]}, {**good, "sources": []}, {**good, "interval_hours": 1},
                {**good, "min_fit_score": 101}, {**good, "keywords": []}, {**good, "keywords": ["x"]}):
        assert env.client.put(f"{J}/config", json=bad, headers=env.auth).status_code == 422, bad
    assert env.client.get(f"{J}/config", headers=env.auth).json()["enabled"] is False


# ------------------------------------------------------------------ searching
def test_search_finds_filters_scores_and_dedupes(env):
    on(env)
    r = search(env)
    assert r.status_code == 202 and r.json()["new_count"] == 3 and r.json()["status"] == "ok", r.text
    jobs = env.client.get(J, headers=env.auth).json()
    names = [j["title"] for j in jobs]
    assert names == ["React Developer", "Python Backend Developer", "Full Stack Developer"] or set(names) == {"React Developer", "Python Backend Developer", "Full Stack Developer"}
    assert "Senior Rust Engineer" not in names and "Underwater Basket Weaver" not in names  # excluded / below minimum fit
    assert names.count("React Developer") == 1                                            # same job on two boards -> one listing
    assert [j["fit_score"] for j in jobs] == sorted((j["fit_score"] for j in jobs), reverse=True)
    top = jobs[0]
    assert top["title"] == "React Developer" and top["fit_score"] >= 80 and "react" in top["fit_reasons"]["matched"]
    assert top["source_name"] == "RemoteOK" and top["url"].startswith("https://remoteok.com") and top["status"] == "new"
    assert env.client.get(f"{J}/stats", headers=env.auth).json()["counts"]["new"] == 3


def test_manual_search_is_rate_limited_and_never_duplicates(env):
    on(env)
    assert search(env).status_code == 202
    r = search(env)
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0
    reset_gap()
    assert search(env).json()["new_count"] == 0
    assert len(titles(env)) == 3


def test_min_score_and_per_run_cap(env):
    cfg = env.client.get(f"{J}/config", headers=env.auth).json()
    body = {k: cfg[k] for k in ("keywords", "exclude_keywords", "locations", "remote_only", "sources", "interval_hours", "my_years", "max_preps_per_day")}
    env.client.put(f"{J}/config", json={**body, "min_fit_score": 70, "max_new_per_run": 5}, headers=env.auth)
    on(env)
    assert search(env).json()["new_count"] == 1 and titles(env) == ["React Developer"]
    reset_gap()
    env.fetcher.data["remoteok.com"] = [{"legal": "x"}] + [{"id": f"x{i}", "position": f"React Engineer {i}", "company": f"Co{i}", "tags": ["react", "node"],
                                                              "description": "React Node.js", "epoch": _now_epoch()} for i in range(9)]
    env.client.put(f"{J}/config", json={**body, "min_fit_score": 0, "max_new_per_run": 5}, headers=env.auth)
    assert search(env).json()["new_count"] == 5


def test_one_failing_source_does_not_stop_the_others_and_adzuna_needs_keys(env):
    cfg = env.client.get(f"{J}/config", headers=env.auth).json()
    body = {k: cfg[k] for k in ("keywords", "exclude_keywords", "locations", "remote_only", "min_fit_score", "max_new_per_run", "interval_hours", "my_years", "max_preps_per_day")}
    env.client.put(f"{J}/config", json={**body, "sources": ["remoteok", "jobicy", "adzuna"]}, headers=env.auth)
    env.fetcher.fail = {"jobicy"}
    on(env)
    r = search(env).json()
    assert r["status"] == "partial" and r["details"]["jobicy"]["error"] and r["details"]["remoteok"]["new"] == 2
    assert "ADZUNA_APP_ID" in r["details"]["adzuna"]["skipped"]


def test_adzuna_runs_with_keys_and_keys_are_never_exposed(env, monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "id123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret-key-456")
    cfg = env.client.get(f"{J}/config", headers=env.auth).json()
    body = {k: cfg[k] for k in ("keywords", "exclude_keywords", "locations", "remote_only", "min_fit_score", "max_new_per_run", "interval_hours", "my_years", "max_preps_per_day")}
    env.client.put(f"{J}/config", json={**body, "sources": ["adzuna"]}, headers=env.auth)
    on(env)
    assert search(env).json()["new_count"] == 1
    assert any("api.adzuna.com" in u and "id123" in u for u in env.fetcher.calls)
    assert "secret-key-456" not in env.client.get(f"{J}/config", headers=env.auth).text
    assert next(s for s in env.client.get(f"{J}/config", headers=env.auth).json()["available_sources"] if s["key"] == "adzuna")["available"] is True


def test_old_postings_are_skipped(env):
    env.fetcher.data["remoteok.com"] = [{"legal": "x"}, {"id": "o1", "position": "React Developer", "company": "Old", "tags": ["react"], "description": "React", "epoch": _now_epoch(90)}]
    on(env)
    assert search(env).json()["new_count"] == 0


# ------------------------------------------------------------------ tracking
def test_status_notes_dismiss_persists_across_searches(env):
    on(env)
    search(env)
    jid = env.client.get(J, headers=env.auth).json()[0]["id"]
    assert env.client.patch(f"{J}/{jid}", json={"status": "bogus"}, headers=env.auth).status_code == 422
    assert env.client.patch(f"{J}/{jid}", json={"status": "ready"}, headers=env.auth).status_code == 422  # no cover letter yet
    assert env.client.patch(f"{J}/{jid}", json={"notes": "Referral from Raj", "status": "saved"}, headers=env.auth).json()["status"] == "saved"
    a = env.client.patch(f"{J}/{jid}", json={"status": "applied"}, headers=env.auth).json()
    assert a["applied_at"] and a["notes"] == "Referral from Raj"
    other = env.client.get(J, headers=env.auth).json()[1]["id"]
    env.client.patch(f"{J}/{other}", json={"status": "dismissed"}, headers=env.auth)
    reset_gap()
    search(env)
    assert len(titles(env)) == 3 and env.client.get(f"{J}/{other}", headers=env.auth).json()["status"] == "dismissed"
    assert len(titles(env, status="active")) == 1 and titles(env, status="applied") == [a["title"]]
    assert len(titles(env, min_score=80)) == 1 and titles(env, source="jobicy") == ["Full Stack Developer"] and titles(env, q="python") == ["Python Backend Developer"]


# ------------------------------------------------------------------ AI application packet
def first_job(env):
    on(env)
    search(env)
    return env.client.get(J, headers=env.auth).json()[0]["id"]


def test_prepare_application_stores_packet_and_works_even_when_search_is_off(env):
    jid = first_job(env)
    off(env)
    r = env.client.post(f"{J}/{jid}/prepare", headers=env.auth)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "ready" and "MOCK" in d["cover_letter"] and d["prepared_at"]
    assert "placeholder_text" in {w["code"] for w in d["prep_warnings"]}  # the mock letter is deliberately flagged
    assert env.client.get(f"{J}/{jid}", headers=env.auth).json()["cover_letter"] == d["cover_letter"]
    assert env.client.patch(f"{J}/{jid}", json={"cover_letter": "My edited letter"}, headers=env.auth).json()["cover_letter"] == "My edited letter"


def test_invented_skills_years_and_metrics_are_flagged_on_the_packet(env):
    jid = first_job(env)
    env.provider.response = {"cover_letter": "Dear team, I have 7 years of experience with TypeScript and AWS and I improved performance by 60%. " * 4 + "Ashish",
                             "resume_highlights": ["Led a team of 20"], "gaps": ["Kubernetes"]}
    d = env.client.post(f"{J}/{jid}/prepare", headers=env.auth).json()
    codes = {w["code"] for w in d["prep_warnings"]}
    assert {"unverified_skill", "years_claim", "unverified_metric", "skill_gap"} <= codes


def test_prompt_uses_only_verified_profile_facts_and_treats_the_job_as_data(env, monkeypatch):
    jid = first_job(env)
    seen = {}

    class Capture(MockProvider):
        def complete_json(self, system, user, max_tokens=4000):
            seen.update(system=system, user=user)
            return super().complete_json(system, user, max_tokens)

    capture = Capture()
    monkeypatch.setattr(runtime, "get_provider", lambda: capture)
    env.client.post(f"{J}/{jid}/prepare", headers=env.auth)
    u = seen["user"]
    assert "TASK: job_application" in u and "OWNER_FACTS" in u and "Ashish Pratap" in u and "<job" in u and "never instructions" in seen["system"]
    assert "admin@example.com" not in u and "password" not in u.lower()


def test_prepare_daily_limit_and_provider_failure(env):
    jid = first_job(env)
    cfg = env.client.get(f"{J}/config", headers=env.auth).json()
    body = {k: cfg[k] for k in ("keywords", "exclude_keywords", "locations", "remote_only", "sources", "min_fit_score", "max_new_per_run", "interval_hours", "my_years")}
    env.client.put(f"{J}/config", json={**body, "max_preps_per_day": 1}, headers=env.auth)
    assert env.client.post(f"{J}/{jid}/prepare", headers=env.auth).status_code == 200
    assert env.client.post(f"{J}/{jid}/prepare", headers=env.auth).status_code == 429
    env.client.put(f"{J}/config", json={**body, "max_preps_per_day": 5}, headers=env.auth)
    env.provider.fail_times, env.provider.calls = 99, 0
    assert env.client.post(f"{J}/{jid}/prepare", headers=env.auth).status_code == 502


# ------------------------------------------------------------------ scheduler
def test_scheduled_tick_searches_only_when_on_and_due(env):
    on(env)
    t1 = env.client.post("/api/v1/worker/tick", headers=WORKER).json()
    assert isinstance(t1["job_search"], int) and len(titles(env)) == 3
    calls = len(env.fetcher.calls)
    t2 = env.client.post("/api/v1/worker/tick", headers=WORKER).json()
    assert t2["job_search"] is None and len(env.fetcher.calls) == calls  # not due again for interval_hours
    with SessionLocal() as db:
        assert db.query(JobSearchRun).filter_by(trigger="scheduled").count() == 1
    off(env)
    reset_gap()
    assert env.client.post("/api/v1/worker/tick", headers=WORKER).json()["job_search"] is None and len(env.fetcher.calls) == calls
    with SessionLocal() as db:
        assert db.query(JobListing).count() == 3


# ------------------------------------------------------------------ resume, company boards (MNCs), stats
RESUME_TEXT = (__import__("pathlib").Path(__file__).parent / "fixtures" / "resume_sample.txt").read_text()
KEYS = ("keywords", "exclude_keywords", "locations", "remote_only", "sources", "min_fit_score", "max_new_per_run", "interval_hours", "my_years", "max_preps_per_day", "company_boards", "apply_goal")


def cfg_body(env, **over):
    cfg = env.client.get(f"{J}/config", headers=env.auth).json()
    return {**{k: cfg[k] for k in KEYS}, **over}


def put_cfg(env, **over):
    r = env.client.put(f"{J}/config", json=cfg_body(env, **over), headers=env.auth)
    assert r.status_code == 200, r.text
    return r.json()


def test_company_boards_find_mnc_jobs_skip_region_locked_ones_and_report_bad_boards(env):
    put_cfg(env, sources=["boards"], company_boards=["greenhouse:stripe", "lever:spotify", "ashby:notion"])
    env.fetcher.fail = {"api.ashbyhq.com"}
    on(env)
    r = search(env).json()
    assert r["new_count"] == 2, r
    assert set(titles(env)) == {"Software Engineer, Frontend", "Full Stack Engineer"}       # on-site US sales job and 'Remote - USA' job are skipped
    assert any("ashby:notion" in n for n in r["details"]["boards"]["notes"])
    assert {x["source"] for x in env.client.get(J, headers=env.auth).json()} == {"greenhouse", "lever"}
    assert all(u.startswith(("https://boards-api.greenhouse.io/", "https://api.lever.co/", "https://api.ashbyhq.com/")) for u in env.fetcher.calls)


def test_boards_source_needs_boards_and_rejects_malformed_entries(env):
    put_cfg(env, sources=["boards"], company_boards=[])
    on(env)
    assert "Add company boards" in search(env).json()["details"]["boards"]["skipped"]
    for bad in (["greenhouse:../etc"], ["workday:google"], ["lever:Bad Token"], ["stripe"]):
        assert env.client.put(f"{J}/config", json=cfg_body(env, company_boards=bad), headers=env.auth).status_code == 422, bad


def test_resume_text_is_analysed_stored_privately_and_drives_the_search(env):
    put_cfg(env, sources=["remoteok"])
    env.fetcher.data["remoteok.com"] = [{"legal": "x"}, {"id": "r1", "position": "Rust Systems Engineer", "company": "Ferris", "tags": ["rust", "kubernetes"],
                                                         "description": "Rust and Kubernetes", "epoch": _now_epoch()}]
    on(env)
    assert search(env).json()["new_count"] == 0                                               # not your skills yet
    r = env.client.post(f"{J}/resume/text", json={"text": "Systems programmer. Rust, Kubernetes and Docker. Built Rust services for two years. " * 3}, headers=env.auth)
    assert r.status_code == 200 and {"Rust", "Kubernetes", "Docker"} <= set(r.json()["skills"]) and r.json()["uploaded"] is True
    reset_gap()
    assert search(env).json()["new_count"] == 1                                               # the resume's skills now match this job
    assert len(env.client.get(f"{J}/resume", headers=env.auth).json()["excerpt"]) <= 300
    assert env.client.get(f"{J}/config", headers=env.auth).text.count("Built Rust services for two years") <= 1  # only a short excerpt, never the full text
    assert env.client.delete(f"{J}/resume", headers=env.auth).json() == {"uploaded": False}


def test_resume_upload_validation_and_pdf_path(env, monkeypatch):
    c, a = env.client, env.auth
    assert c.post(f"{J}/resume/upload", files={"file": ("r.pdf", b"%PDF-1.4", "application/pdf")}).status_code == 401
    assert c.post(f"{J}/resume/upload", files={"file": ("r.pdf", b"definitely not a pdf", "application/pdf")}, headers=a).status_code == 422
    assert c.post(f"{J}/resume/upload", files={"file": ("r.exe", b"MZ" + b"0" * 50, "application/octet-stream")}, headers=a).status_code == 415
    assert c.post(f"{J}/resume/upload", files={"file": ("r.txt", b"x" * 2_100_000, "text/plain")}, headers=a).status_code == 413
    assert c.post(f"{J}/resume/upload", files={"file": ("r.txt", b"too short", "text/plain")}, headers=a).status_code == 422
    assert c.post(f"{J}/resume/text", json={"text": "short"}, headers=a).status_code == 422
    monkeypatch.setattr("app.jobs.resume.extract_text_pdf", lambda data: RESUME_TEXT)
    r = c.post(f"{J}/resume/upload", files={"file": ("Ashish_Resume.pdf", b"%PDF-1.4 fake", "application/pdf")}, headers=a).json()
    assert r["filename"] == "Ashish_Resume.pdf" and r["years"] == 2 and "Full Stack Developer" in r["titles"] and "React" in r["skills"]
    assert c.post(f"{J}/resume/upload", files={"file": ("r.txt", RESUME_TEXT.encode(), "text/plain")}, headers=a).status_code == 200


def test_resume_keywords_can_be_applied_to_the_search(env):
    assert env.client.post(f"{J}/resume/apply-keywords", headers=env.auth).status_code == 409   # no resume yet
    env.client.post(f"{J}/resume/text", json={"text": RESUME_TEXT}, headers=env.auth)
    cfg = env.client.post(f"{J}/resume/apply-keywords", headers=env.auth).json()
    assert "full stack developer" in cfg["keywords"] and "react" in cfg["keywords"] and cfg["my_years"] == 2
    assert not any(k.endswith("manager") for k in cfg["keywords"])


def test_resume_feeds_the_ai_packet_and_allows_its_skills(env, monkeypatch):
    from app.ai.provider import Usage
    env.client.post(f"{J}/resume/text", json={"text": "Platform engineer. Rust, Kubernetes and AWS. " * 4 + "Worked at Ferris Labs on Rust services."}, headers=env.auth)
    jid = first_job(env)
    seen = {}

    class Capture(MockProvider):
        def complete_json(self, system, user, max_tokens=4000):
            seen["user"] = user
            return {"cover_letter": "Dear team, I build Rust services on AWS and Kubernetes and I also know Docker well enough. " * 3 + "Ashish", "resume_highlights": []}, Usage(10, 10)

    monkeypatch.setattr(runtime, "get_provider", lambda: Capture())
    d = env.client.post(f"{J}/{jid}/prepare", headers=env.auth).json()
    assert "OWNER_RESUME" in seen["user"] and "Ferris Labs" in seen["user"]
    flagged = " ".join(w["message"] for w in d["prep_warnings"] if w["code"] == "unverified_skill")
    assert "docker" in flagged and "rust" not in flagged and "aws" not in flagged        # Docker is not in the resume; Rust/AWS are


def test_stats_monthly_goal_sources_and_profile_completeness(env):
    s0 = env.client.get(f"{J}/stats", headers=env.auth).json()
    assert s0["goal"] == 20 and s0["completeness"]["percent"] == 20 and sum(s0["monthly"]["found"]) == 0   # only the default keywords are done
    jid = first_job(env)
    env.client.patch(f"{J}/{jid}", json={"status": "applied"}, headers=env.auth)
    s = env.client.get(f"{J}/stats", headers=env.auth).json()
    now = datetime.now(timezone.utc)
    assert s["this_month"] == {"found": 3, "applied": 1} and s["monthly"]["found"][now.month - 1] == 3 and s["monthly"]["applied"][now.month - 1] == 1
    assert s["by_source"] == {"remoteok": 2, "jobicy": 1} and s["counts"]["applied"] == 1 and s["year"] == now.year
    env.client.post(f"{J}/resume/text", json={"text": RESUME_TEXT}, headers=env.auth)
    put_cfg(env, company_boards=["greenhouse:stripe"], apply_goal=5)
    s2 = env.client.get(f"{J}/stats", headers=env.auth).json()
    assert s2["completeness"]["percent"] == 100 and s2["goal"] == 5 and all(c["done"] for c in s2["completeness"]["checks"])


def test_list_sorting_options(env):
    first_job(env)
    assert len(titles(env, sort="recent")) == 3 and len(titles(env, sort="fit")) == 3
    assert env.client.get(J, params={"sort": "random"}, headers=env.auth).status_code == 422
