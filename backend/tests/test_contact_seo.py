from app.database import SessionLocal
from app.models import Inquiry

from tests.helpers import A, P, approve_flow, create_post, in_future, publish_post

C = f"{P}/contact"
GOOD = {"name": "Asha", "email": "asha@example.com", "subject": "Website", "message": "I need a portfolio website built."}


def test_contact_valid_is_saved_privately(client, auth):
    assert client.post(C, json=GOOD).status_code == 202
    rows = client.get(f"{A}/inquiries", headers=auth).json()
    assert len(rows) == 1 and rows[0]["status"] == "new" and "ip_hash" not in rows[0]
    with SessionLocal() as db:
        i = db.query(Inquiry).one()
        assert len(i.ip_hash) == 64 and "testclient" not in i.ip_hash and "127.0.0.1" not in i.ip_hash


def test_contact_validation(client):
    assert client.post(C, json={**GOOD, "email": "nope"}).status_code == 422
    assert client.post(C, json={**GOOD, "message": "short"}).status_code == 422
    assert client.post(C, json={**GOOD, "name": ""}).status_code == 422
    assert client.post(C, json={**GOOD, "message": "x" * 5001}).status_code == 422
    assert client.post(C, json={**GOOD, "status": "new"}).status_code == 422


def test_honeypot_pretends_success_but_stores_nothing(client, auth):
    assert client.post(C, json={**GOOD, "website": "http://spam.example"}).status_code == 202
    assert client.get(f"{A}/inquiries", headers=auth).json() == []


def test_link_heavy_messages_are_marked_spam(client, auth):
    msg = "Buy now http://a.example http://b.example http://c.example http://d.example please"
    assert client.post(C, json={**GOOD, "message": msg}).status_code == 202
    assert client.get(f"{A}/inquiries", params={"status": "spam"}, headers=auth).json()[0]["message"] == msg


def test_rate_limit_per_visitor(client):
    for _ in range(5):
        assert client.post(C, json=GOOD).status_code == 202
    assert client.post(C, json=GOOD).status_code == 429


def test_forwarded_ip_ignored_without_internal_key(client):
    for i in range(5):
        client.post(C, json=GOOD, headers={"X-Client-IP": f"9.9.9.{i}"})
    assert client.post(C, json=GOOD, headers={"X-Client-IP": "9.9.9.99"}).status_code == 429  # spoofing did not help


def test_forwarded_ip_used_with_internal_key(client):
    h = lambda ip: {"X-Client-IP": ip, "X-Internal-Key": "internal-secret-key"}  # noqa: E731
    for _ in range(5):
        assert client.post(C, json=GOOD, headers=h("1.1.1.1")).status_code == 202
    assert client.post(C, json=GOOD, headers=h("1.1.1.1")).status_code == 429
    assert client.post(C, json=GOOD, headers=h("2.2.2.2")).status_code == 202  # different visitor
    assert client.post(C, json=GOOD, headers={"X-Client-IP": "3.3.3.3", "X-Internal-Key": "wrong"}).status_code == 202


def test_inquiry_admin_requires_auth_and_manages_status(client, auth):
    client.post(C, json=GOOD)
    assert client.get(f"{A}/inquiries").status_code == 401
    assert client.patch(f"{A}/inquiries/1", json={"status": "read"}).status_code == 401
    assert client.patch(f"{A}/inquiries/1", json={"status": "bogus"}, headers=auth).status_code == 422
    assert client.patch(f"{A}/inquiries/1", json={"status": "replied"}, headers=auth).json()["status"] == "replied"
    assert client.delete(f"{A}/inquiries/1", headers=auth).status_code == 204
    assert client.get(f"{A}/inquiries", headers=auth).json() == []


def test_sitemap_contains_only_eligible_urls(client, auth):
    pr = client.post(f"{A}/projects", json={"title": "Shown", "summary": "s", "description": "d"}, headers=auth).json()
    client.post(f"{A}/projects/{pr['id']}/publish", headers=auth)
    client.post(f"{A}/projects", json={"title": "Hidden", "summary": "s", "description": "d"}, headers=auth)
    ok = publish_post(client, auth, title="Indexable")
    publish_post(client, auth, title="Private noindex", noindex=True)
    create_post(client, auth, title="Just a draft")
    sch = create_post(client, auth, title="Later")
    approve_flow(client, auth, sch["id"])
    client.post(f"{A}/blog/{sch['id']}/schedule", json={"publish_at": in_future()}, headers=auth)
    paths = [e["path"] for e in client.get(f"{P}/sitemap").json()]
    assert "/blog/indexable" in paths and "/projects/shown" in paths and "/" in paths and "/blog" in paths
    for bad in ("/projects/hidden", "/blog/private-noindex", "/blog/just-a-draft", "/blog/later"):
        assert bad not in paths
    assert not any(p.startswith("/admin") or p.startswith("/api") for p in paths)
    assert len(paths) == len(set(paths))
    assert ok["slug"] == "indexable"


def test_noindex_post_still_readable_but_flagged(client, auth):
    p = publish_post(client, auth, title="Quiet", noindex=True)
    assert client.get(f"{P}/blog/{p['slug']}").json()["noindex"] is True


def test_redirect_admin_validation(client, auth):
    ok = client.post(f"{A}/redirects", json={"from_path": "/old", "to_path": "/new"}, headers=auth)
    assert ok.status_code == 201
    assert client.post(f"{A}/redirects", json={"from_path": "/old", "to_path": "/other"}, headers=auth).status_code == 409
    assert client.post(f"{A}/redirects", json={"from_path": "/a", "to_path": "//evil.com"}, headers=auth).status_code == 422
    assert client.post(f"{A}/redirects", json={"from_path": "/a", "to_path": "https://evil.com"}, headers=auth).status_code == 422
    assert client.post(f"{A}/redirects", json={"from_path": "/a", "to_path": "/a"}, headers=auth).status_code == 422
    assert client.get(f"{P}/redirect", params={"path": "/old"}).json()["to_path"] == "/new"
    assert client.get(f"{A}/redirects").status_code == 401
    assert client.delete(f"{A}/redirects/{ok.json()['id']}", headers=auth).status_code == 204


def test_security_headers_and_no_store_on_admin(client, auth):
    r = client.get(f"{A}/skills", headers=auth)
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert r.headers["cache-control"] == "no-store"
