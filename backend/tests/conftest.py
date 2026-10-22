import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ.update(APP_ENV="test", SECRET_KEY="t" * 48, DATABASE_URL="sqlite://", UPLOAD_DIR=_tmp,
                  CORS_ORIGINS="http://localhost:3000", WORKER_TOKEN="worker-secret-token", INTERNAL_API_KEY="internal-secret-key",
                  AI_PROVIDER="mock", SITE_URL="http://localhost:3000")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AdminUser  # noqa: E402
from app.security import hash_password, login_limiter  # noqa: E402

PASSWORD = "correct-horse-battery"


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    login_limiter.reset()
    with SessionLocal() as db:
        db.add(AdminUser(email="admin@example.com", password_hash=hash_password(PASSWORD)))
        db.commit()
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth(client):
    r = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
