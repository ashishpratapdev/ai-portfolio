from app.database import SessionLocal
from app.models import BlogPost, PostRevision
from app.services import blog as svc
from datetime import datetime, timedelta, timezone

from tests.helpers import A, P, approve_flow, create_post, in_future, payload, publish_post


def test_blog_admin_requires_auth(client):
    assert client.get(f"{A}/blog").status_code == 401
    assert client.post(f"{A}/blog", json=payload()).status_code == 401
    assert client.post(f"{A}/blog/1/approve", json={"revision_hash": "a" * 64}).status_code == 401
    assert client.post(f"{A}/blog/1/publish").status_code == 401


def test_create_validation(client, auth):
    assert client.post(f"{A}/blog", json=payload(cover_media_id=1), headers=auth).status_code == 422  # alt required
    assert client.post(f"{A}/blog", json=payload(canonical_url="javascript:1"), headers=auth).status_code == 422
    assert client.post(f"{A}/blog", json=payload(source_refs=[{"title": "x", "url": "ftp://x"}]), headers=auth).status_code == 422
    assert client.post(f"{A}/blog", json=payload(state="published"), headers=auth).status_code == 422
    assert client.post(f"{A}/blog", json=payload(seo_title="x" * 71), headers=auth).status_code == 422


def test_new_post_is_draft_with_unique_slug_and_revision(client, auth):
    a = create_post(client, auth)
    b = create_post(client, auth)
    assert a["state"] == "draft" and a["slug"] == "hello-world" and b["slug"] == "hello-world-2"
    revs = client.get(f"{A}/blog/{a['id']}/revisions", headers=auth).json()
    assert len(revs) == 1 and revs[0]["source"] == "admin"


def test_full_workflow_publishes_and_public_sees_it(client, auth):
    p = create_post(client, auth)
    assert client.get(f"{P}/blog/{p['slug']}").status_code == 404
    approve_flow(client, auth, p["id"])
    pub = client.post(f"{A}/blog/{p['id']}/publish", headers=auth).json()
    assert pub["state"] == "published" and pub["approved_by"] is not None and pub["approved_hash"] == pub["content_hash"]
    r = client.get(f"{P}/blog/{p['slug']}")
    assert r.status_code == 200 and r.json()["title"] == "Hello World"
    leaked = set(r.json()) & {"state", "approved_by", "approved_hash", "quality_warnings", "is_ai_generated", "rejection_reason", "id"}
    assert not leaked


def test_invalid_transitions_rejected(client, auth):
    p = create_post(client, auth)
    i = p["id"]
    assert client.post(f"{A}/blog/{i}/publish", headers=auth).status_code == 409  # draft -> published
    assert client.post(f"{A}/blog/{i}/approve", json={"revision_hash": p["content_hash"]}, headers=auth).status_code == 409
    assert client.post(f"{A}/blog/{i}/schedule", json={"publish_at": in_future()}, headers=auth).status_code == 409
    assert client.post(f"{A}/blog/{i}/review", headers=auth).status_code == 200
    assert client.post(f"{A}/blog/{i}/review", headers=auth).status_code == 409
    assert client.post(f"{A}/blog/{i}/publish", headers=auth).status_code == 409  # in_review -> published


def test_approve_requires_exact_current_hash(client, auth):
    p = create_post(client, auth)
    client.post(f"{A}/blog/{p['id']}/review", headers=auth)
    assert client.post(f"{A}/blog/{p['id']}/approve", json={"revision_hash": "0" * 64}, headers=auth).status_code == 409
    assert client.post(f"{A}/blog/{p['id']}/approve", json={"revision_hash": "nothex"}, headers=auth).status_code == 422
    stale = client.get(f"{A}/blog/{p['id']}", headers=auth).json()["content_hash"]
    client.patch(f"{A}/blog/{p['id']}", json={"body": "changed after the reviewer loaded it"}, headers=auth)
    assert client.post(f"{A}/blog/{p['id']}/approve", json={"revision_hash": stale}, headers=auth).status_code == 409


def test_content_change_after_approval_invalidates_it(client, auth):
    p = create_post(client, auth)
    approve_flow(client, auth, p["id"])
    r = client.patch(f"{A}/blog/{p['id']}", json={"title": "Sneaky edit"}, headers=auth).json()
    assert r["approval_invalidated"] is True and r["state"] == "draft" and r["approved_hash"] is None and r["approved_by"] is None
    assert client.post(f"{A}/blog/{p['id']}/publish", headers=auth).status_code == 409


def test_tag_change_also_invalidates_approval(client, auth):
    p = create_post(client, auth)
    approve_flow(client, auth, p["id"])
    r = client.patch(f"{A}/blog/{p['id']}", json={"tags": ["new-tag"]}, headers=auth).json()
    assert r["state"] == "draft"


def test_published_post_is_locked_until_unpublished(client, auth):
    p = publish_post(client, auth)
    assert client.patch(f"{A}/blog/{p['id']}", json={"title": "x"}, headers=auth).status_code == 409
    assert client.post(f"{A}/blog/{p['id']}/draft", headers=auth).json()["state"] == "draft"
    assert client.get(f"{P}/blog/{p['slug']}").status_code == 404
    assert client.patch(f"{A}/blog/{p['id']}", json={"title": "ok now"}, headers=auth).status_code == 200


def test_patch_cannot_set_state_or_approval_fields(client, auth):
    p = create_post(client, auth)
    for field, val in (("state", "published"), ("approved_hash", "a" * 64), ("approved_by", 1), ("is_ai_generated", False)):
        assert client.patch(f"{A}/blog/{p['id']}", json={field: val}, headers=auth).status_code == 422


def test_only_non_public_states_hidden_everywhere(client, auth):
    """draft, in_review, approved, scheduled, rejected must never reach public API or sitemap."""
    d = create_post(client, auth, title="Draft one")
    r = create_post(client, auth, title="Review one")
    client.post(f"{A}/blog/{r['id']}/review", headers=auth)
    a = create_post(client, auth, title="Approved one")
    approve_flow(client, auth, a["id"])
    s = create_post(client, auth, title="Scheduled one")
    approve_flow(client, auth, s["id"])
    assert client.post(f"{A}/blog/{s['id']}/schedule", json={"publish_at": in_future()}, headers=auth).status_code == 200
    j = create_post(client, auth, title="Rejected one")
    client.post(f"{A}/blog/{j['id']}/review", headers=auth)
    assert client.post(f"{A}/blog/{j['id']}/reject", json={"reason": "off topic"}, headers=auth).json()["state"] == "rejected"
    live = publish_post(client, auth, title="Live one")
    items = client.get(f"{P}/blog").json()["items"]
    assert [i["slug"] for i in items] == [live["slug"]]
    for p in (d, r, a, s, j):
        assert client.get(f"{P}/blog/{p['slug']}").status_code == 404
    paths = [e["path"] for e in client.get(f"{P}/sitemap").json()]
    assert f"/blog/{live['slug']}" in paths and not any(p["slug"] in x for p in (d, r, a, s, j) for x in paths)


def test_reject_requires_reason_and_clears_approval(client, auth):
    p = create_post(client, auth)
    approve_flow(client, auth, p["id"])
    assert client.post(f"{A}/blog/{p['id']}/reject", json={"reason": ""}, headers=auth).status_code == 422
    r = client.post(f"{A}/blog/{p['id']}/reject", json={"reason": "wrong tone"}, headers=auth).json()
    assert r["state"] == "rejected" and r["approved_hash"] is None and r["rejection_reason"] == "wrong tone"


def test_schedule_rules_and_due_publishing(client, auth):
    p = create_post(client, auth)
    approve_flow(client, auth, p["id"])
    assert client.post(f"{A}/blog/{p['id']}/schedule", json={"publish_at": "2030-01-01T00:00:00"}, headers=auth).status_code == 422  # no tz
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    assert client.post(f"{A}/blog/{p['id']}/schedule", json={"publish_at": past}, headers=auth).status_code == 422
    r = client.post(f"{A}/blog/{p['id']}/schedule", json={"publish_at": in_future(2)}, headers=auth)
    assert r.status_code == 200 and r.json()["state"] == "scheduled"
    with SessionLocal() as db:
        assert svc.publish_due(db) == []  # not due yet
        later = datetime.now(timezone.utc) + timedelta(hours=3)
        assert svc.publish_due(db, now=later) == [p["id"]]
        assert svc.publish_due(db, now=later) == []  # idempotent
    assert client.get(f"{P}/blog/{p['slug']}").status_code == 200


def test_unschedule_returns_to_approved(client, auth):
    p = create_post(client, auth)
    approve_flow(client, auth, p["id"])
    client.post(f"{A}/blog/{p['id']}/schedule", json={"publish_at": in_future()}, headers=auth)
    r = client.post(f"{A}/blog/{p['id']}/unschedule", headers=auth).json()
    assert r["state"] == "approved" and r["scheduled_at"] is None and r["approval_valid"] is True


def test_due_publish_revalidates_approval_even_if_content_tampered(client, auth):
    """Simulates a bypass (direct DB edit after scheduling): the worker must refuse to publish."""
    p = create_post(client, auth)
    approve_flow(client, auth, p["id"])
    client.post(f"{A}/blog/{p['id']}/schedule", json={"publish_at": in_future()}, headers=auth)
    with SessionLocal() as db:
        db.get(BlogPost, p["id"]).body = "TAMPERED CONTENT"
        db.commit()
        assert svc.publish_due(db, now=datetime.now(timezone.utc) + timedelta(hours=2)) == []
        post = db.get(BlogPost, p["id"])
        assert post.state == "draft" and post.approved_hash is None
    assert client.get(f"{P}/blog/{p['slug']}").status_code == 404


def test_slug_change_creates_redirect(client, auth):
    p = publish_post(client, auth)
    client.post(f"{A}/blog/{p['id']}/draft", headers=auth)
    r = client.patch(f"{A}/blog/{p['id']}", json={"slug": "new-url"}, headers=auth)
    assert r.json()["slug"] == "new-url"
    red = client.get(f"{P}/redirect", params={"path": "/blog/hello-world"})
    assert red.status_code == 200 and red.json() == {"to_path": "/blog/new-url", "status_code": 301}
    assert client.get(f"{P}/redirect", params={"path": "/blog/nothing"}).status_code == 404
    assert client.get(f"{P}/redirect", params={"path": "//evil.com"}).status_code == 404


def test_revisions_track_changes_not_noops(client, auth):
    p = create_post(client, auth)
    client.patch(f"{A}/blog/{p['id']}", json={"title": "Hello World"}, headers=auth)  # no real change
    client.patch(f"{A}/blog/{p['id']}", json={"body": "new body"}, headers=auth)
    revs = client.get(f"{A}/blog/{p['id']}/revisions", headers=auth).json()
    assert [r["revision_no"] for r in revs] == [2, 1] and revs[0]["content_hash"] != revs[1]["content_hash"]


def test_public_list_pagination_filters_search_related(client, auth):
    for i in range(5):
        publish_post(client, auth, title=f"Post number {i}", tags=["fastapi"] if i < 3 else ["other"], categories=["Python"])
    d = client.get(f"{P}/blog", params={"page_size": 2}).json()
    assert d["total"] == 5 and d["pages"] == 3 and len(d["items"]) == 2
    assert len(client.get(f"{P}/blog", params={"page_size": 2, "page": 3}).json()["items"]) == 1
    assert client.get(f"{P}/blog", params={"tag": "fastapi"}).json()["total"] == 3
    assert client.get(f"{P}/blog", params={"category": "python"}).json()["total"] == 5
    assert client.get(f"{P}/blog", params={"q": "number 4"}).json()["total"] == 1
    assert client.get(f"{P}/blog", params={"q": "%"}).json()["total"] == 0  # wildcard is escaped
    assert client.get(f"{P}/blog", params={"page_size": 100}).status_code == 422
    detail = client.get(f"{P}/blog/post-number-0").json()
    assert 0 < len(detail["related"]) <= 3 and all(x["slug"] != "post-number-0" for x in detail["related"])
    filters = client.get(f"{P}/blog-filters").json()
    assert {"name": "Python", "slug": "python"} in filters["categories"]


def test_delete_only_draft_or_rejected(client, auth):
    p = publish_post(client, auth)
    assert client.delete(f"{A}/blog/{p['id']}", headers=auth).status_code == 409
    d = create_post(client, auth, title="Disposable")
    assert client.delete(f"{A}/blog/{d['id']}", headers=auth).status_code == 204
    assert client.get(f"{A}/blog/{d['id']}", headers=auth).status_code == 404
