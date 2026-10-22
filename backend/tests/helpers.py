from datetime import datetime, timedelta, timezone

A = "/api/v1/admin"
P = "/api/v1/public"


def payload(**kw):
    d = dict(title="Hello World", excerpt="An excerpt", body="## Hi\n\nBody text here.", author_name="Owner",
             categories=["Python"], tags=["fastapi"])
    d.update(kw)
    return d


def create_post(client, auth, **kw):
    r = client.post(f"{A}/blog", json=payload(**kw), headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def approve_flow(client, auth, pid):
    r = client.post(f"{A}/blog/{pid}/review", headers=auth)
    assert r.status_code == 200, r.text
    r = client.post(f"{A}/blog/{pid}/approve", json={"revision_hash": r.json()["content_hash"]}, headers=auth)
    assert r.status_code == 200, r.text
    return r.json()


def publish_post(client, auth, **kw):
    p = create_post(client, auth, **kw)
    approve_flow(client, auth, p["id"])
    r = client.post(f"{A}/blog/{p['id']}/publish", headers=auth)
    assert r.status_code == 200, r.text
    return r.json()


def in_future(hours=1):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()
