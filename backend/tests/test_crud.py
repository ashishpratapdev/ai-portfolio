A = "/api/v1/admin"
P = "/api/v1/public"


def mk_skill(client, auth, name="Python", **kw):
    r = client.post(f"{A}/skills", json={"name": name, "category": "Backend", **kw}, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_defaults_to_draft_and_validates(client, auth):
    s = mk_skill(client, auth)
    assert s["status"] == "draft"
    assert client.post(f"{A}/skills", json={"name": ""}, headers=auth).status_code == 422
    assert client.post(f"{A}/skills", json={"name": "x", "level": 9}, headers=auth).status_code == 422
    assert client.post(f"{A}/skills", json={"name": "x", "status": "published"}, headers=auth).status_code == 422


def test_update_cannot_change_status_directly(client, auth):
    s = mk_skill(client, auth)
    assert client.patch(f"{A}/skills/{s['id']}", json={"status": "published"}, headers=auth).status_code == 422
    r = client.patch(f"{A}/skills/{s['id']}", json={"name": "Go"}, headers=auth)
    assert r.status_code == 200 and r.json()["name"] == "Go"


def test_lifecycle_publish_unpublish_archive_restore(client, auth):
    s = mk_skill(client, auth)
    i = s["id"]
    assert client.post(f"{A}/skills/{i}/publish", headers=auth).json()["status"] == "published"
    assert client.post(f"{A}/skills/{i}/publish", headers=auth).status_code == 409
    assert client.post(f"{A}/skills/{i}/unpublish", headers=auth).json()["status"] == "draft"
    assert client.post(f"{A}/skills/{i}/archive", headers=auth).json()["status"] == "archived"
    assert client.post(f"{A}/skills/{i}/publish", headers=auth).status_code == 409
    assert client.post(f"{A}/skills/{i}/restore", headers=auth).json()["status"] == "draft"
    assert client.get(f"{A}/skills/999", headers=auth).status_code == 404


def test_reorder(client, auth):
    ids = [mk_skill(client, auth, n)["id"] for n in ("A", "B", "C")]
    assert client.post(f"{A}/skills/reorder", json={"ids": ids[::-1]}, headers=auth).status_code == 204
    names = [x["name"] for x in client.get(f"{A}/skills", headers=auth).json()]
    assert names == ["C", "B", "A"]
    assert client.post(f"{A}/skills/reorder", json={"ids": [ids[0], ids[0]]}, headers=auth).status_code == 422
    assert client.post(f"{A}/skills/reorder", json={"ids": [9999]}, headers=auth).status_code == 404


def test_public_shows_only_published(client, auth):
    draft = mk_skill(client, auth, "Draft")
    pub = mk_skill(client, auth, "Pub")
    arch = mk_skill(client, auth, "Arch")
    client.post(f"{A}/skills/{pub['id']}/publish", headers=auth)
    client.post(f"{A}/skills/{arch['id']}/archive", headers=auth)
    names = [x["name"] for x in client.get(f"{P}/skills").json()]
    assert names == ["Pub"]
    assert draft["id"] not in [x["id"] for x in client.get(f"{P}/skills").json()]
    # admin edit appears on the public site
    client.patch(f"{A}/skills/{pub['id']}", json={"name": "Pub2"}, headers=auth)
    assert client.get(f"{P}/skills").json()[0]["name"] == "Pub2"


def test_project_slug_unique_and_public_detail_isolation(client, auth):
    body = {"title": "My App", "summary": "s", "description": "d", "tech": ["Python"],
            "repo_url": "https://github.com/x/y"}
    a = client.post(f"{A}/projects", json=body, headers=auth).json()
    b = client.post(f"{A}/projects", json=body, headers=auth).json()
    assert a["slug"] == "my-app" and b["slug"] == "my-app-2"
    assert client.get(f"{P}/projects/my-app").status_code == 404  # draft
    client.post(f"{A}/projects/{a['id']}/publish", headers=auth)
    assert client.get(f"{P}/projects/my-app").status_code == 200
    assert client.get(f"{P}/projects/my-app-2").status_code == 404
    client.post(f"{A}/projects/{a['id']}/archive", headers=auth)
    assert client.get(f"{P}/projects/my-app").status_code == 404


def test_project_rejects_javascript_urls(client, auth):
    body = {"title": "X", "summary": "s", "description": "d", "live_url": "javascript:alert(1)"}
    assert client.post(f"{A}/projects", json=body, headers=auth).status_code == 422


def test_experience_date_validation(client, auth):
    body = {"company": "[PLACEHOLDER]", "role": "r", "start_date": "2022-01-01", "end_date": "2021-01-01",
            "description": "d"}
    assert client.post(f"{A}/experience", json=body, headers=auth).status_code == 422
    body["end_date"] = "2023-01-01"
    r = client.post(f"{A}/experience", json=body, headers=auth)
    assert r.status_code == 201
    client.post(f"{A}/experience/{r.json()['id']}/publish", headers=auth)
    assert len(client.get(f"{P}/experience").json()) == 1


def test_profile_hidden_until_published(client, auth):
    assert client.get(f"{P}/profile").status_code == 404
    body = {"full_name": "Test", "headline": "h", "bio": "b", "social_links": [{"label": "GH", "url": "https://github.com/x"}]}
    assert client.put(f"{A}/profile", json=body, headers=auth).status_code == 200
    assert client.get(f"{P}/profile").status_code == 404
    client.post(f"{A}/profile/publish", headers=auth)
    assert client.get(f"{P}/profile").json()["full_name"] == "Test"
    bad = {**body, "social_links": [{"label": "x", "url": "javascript:1"}]}
    assert client.put(f"{A}/profile", json=bad, headers=auth).status_code == 422


def test_services_and_settings(client, auth):
    r = client.post(f"{A}/services", json={"title": "Web dev", "description": "d"}, headers=auth)
    client.post(f"{A}/services/{r.json()['id']}/publish", headers=auth)
    assert len(client.get(f"{P}/services").json()) == 1
    assert client.put(f"{A}/settings", json={"evil_key": "x"}, headers=auth).status_code == 422
    assert client.put(f"{A}/settings", json={"site_title": "Hi"}, headers=auth).status_code == 200
    assert client.get(f"{P}/settings").json() == {"site_title": "Hi"}


def test_audit_log_written(client, auth):
    from app.database import SessionLocal
    from app.models import AuditLog
    mk_skill(client, auth)
    with SessionLocal() as db:
        actions = {a.action for a in db.query(AuditLog).all()}
    assert {"login", "create"} <= actions
