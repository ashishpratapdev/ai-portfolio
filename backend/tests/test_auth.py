import jwt
from app.models import AdminUser
from app.database import SessionLocal
from tests.conftest import PASSWORD

ADMIN_GETS = ["/api/v1/admin/skills", "/api/v1/admin/experience", "/api/v1/admin/projects",
              "/api/v1/admin/services", "/api/v1/admin/profile", "/api/v1/admin/settings", "/api/v1/admin/media"]


def test_login_success_and_me(client, auth):
    r = client.get("/api/v1/auth/me", headers=auth)
    assert r.status_code == 200 and r.json()["email"] == "admin@example.com"


def test_login_wrong_password_and_unknown_user(client):
    assert client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "nope"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "x@example.com", "password": "nope"}).status_code == 401


def test_login_rate_limited_after_repeated_failures(client):
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "bad"})
    r = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": PASSWORD})
    assert r.status_code == 429


def test_admin_endpoints_require_auth(client):
    for path in ADMIN_GETS:
        assert client.get(path).status_code == 401, path


def test_garbage_and_forged_tokens_rejected(client):
    assert client.get("/api/v1/admin/skills", headers={"Authorization": "Bearer abc"}).status_code == 401
    forged = jwt.encode({"sub": "1"}, "wrong-secret-wrong-secret-wrong-secret!!", algorithm="HS256")
    assert client.get("/api/v1/admin/skills", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_deactivated_admin_token_rejected(client, auth):
    with SessionLocal() as db:
        db.query(AdminUser).update({"is_active": False})
        db.commit()
    assert client.get("/api/v1/admin/skills", headers=auth).status_code == 401


def test_mutations_require_auth(client):
    assert client.post("/api/v1/admin/skills", json={"name": "x"}).status_code == 401
    assert client.patch("/api/v1/admin/skills/1", json={"name": "x"}).status_code == 401
    assert client.delete("/api/v1/admin/media/1").status_code == 401


def test_cors_rejects_unlisted_origin(client):
    r = client.options("/api/v1/public/skills", headers={"Origin": "https://evil.example",
                                                         "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers
