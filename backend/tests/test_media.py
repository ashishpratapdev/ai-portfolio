from tests.conftest import PNG

A = "/api/v1/admin"
P = "/api/v1/public"


def up(client, auth, data=PNG, name="a.png", ctype="image/png"):
    return client.post(f"{A}/media", files={"file": (name, data, ctype)}, headers=auth)


def test_upload_requires_auth(client):
    assert client.post(f"{A}/media", files={"file": ("a.png", PNG, "image/png")}).status_code == 401


def test_upload_valid_image_is_private_by_default(client, auth):
    r = up(client, auth)
    assert r.status_code == 201 and r.json()["is_public"] is False
    assert client.get(f"{P}/media/{r.json()['id']}").status_code == 404
    client.patch(f"{A}/media/{r.json()['id']}", json={"is_public": True}, headers=auth)
    pub = client.get(f"{P}/media/{r.json()['id']}")
    assert pub.status_code == 200 and pub.headers["x-content-type-options"] == "nosniff"


def test_upload_rejects_bad_type_fake_content_and_oversize(client, auth):
    assert up(client, auth, b"<script>", "a.html", "text/html").status_code == 415
    assert up(client, auth, b"not really a png", "a.png", "image/png").status_code == 415
    assert up(client, auth, b"MZ" + b"\x00" * 50, "a.pdf", "application/pdf").status_code == 415
    big = PNG + b"\x00" * (5 * 1024 * 1024 + 10)
    assert up(client, auth, big).status_code == 413


def test_path_traversal_filename_is_not_used_for_storage(client, auth):
    r = up(client, auth, name="../../etc/passwd.png")
    assert r.status_code == 201 and "/" not in r.json()["original_name"]


def test_resume_private_unless_public_and_configured(client, auth):
    pdf = b"%PDF-1.4\n" + b"0" * 30
    m = up(client, auth, pdf, "cv.pdf", "application/pdf").json()
    assert client.get(f"{P}/resume").status_code == 404
    client.put(f"{A}/settings", json={"resume_media_id": str(m["id"])}, headers=auth)
    assert client.get(f"{P}/resume").status_code == 404  # configured but still private
    assert client.get(f"{P}/media/{m['id']}").status_code == 404
    client.patch(f"{A}/media/{m['id']}", json={"is_public": True}, headers=auth)
    assert client.get(f"{P}/resume").status_code == 200
    assert client.get(f"{A}/media/{m['id']}/file").status_code == 401  # admin file route needs auth


def test_delete_media(client, auth):
    m = up(client, auth).json()
    assert client.delete(f"{A}/media/{m['id']}", headers=auth).status_code == 204
    assert client.get(f"{A}/media", headers=auth).json() == []
