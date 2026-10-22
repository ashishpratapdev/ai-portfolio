import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Request

from .config import get_settings

ALGO = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except ValueError:
        return False


def create_token(admin_id: int) -> str:
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=s.access_token_minutes)
    return jwt.encode({"sub": str(admin_id), "exp": exp}, s.secret_key, algorithm=ALGO)


def decode_token(token: str) -> int | None:
    try:
        data = jwt.decode(token, get_settings().secret_key, algorithms=[ALGO])
        return int(data["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


class LoginLimiter:
    """In-memory failed-login limiter. Single-process only: use Redis/DB if you scale out."""

    def __init__(self, max_fails: int = 5, window: int = 900):
        self.max_fails, self.window = max_fails, window
        self._fails: dict[str, list[float]] = {}

    def _prune(self, key: str) -> list[float]:
        now = time.time()
        self._fails[key] = [t for t in self._fails.get(key, []) if now - t < self.window]
        return self._fails[key]

    def blocked(self, key: str) -> bool:
        return len(self._prune(key)) >= self.max_fails

    def fail(self, key: str) -> None:
        self._prune(key).append(time.time())

    def reset(self) -> None:
        self._fails.clear()


login_limiter = LoginLimiter()


def client_key(request: Request) -> str:
    """Salted hash identifying the visitor. The raw IP is never stored. The Next.js server forwards the real visitor
    IP in X-Client-IP, trusted only when it also presents the shared INTERNAL_API_KEY (otherwise it is ignored)."""
    s = get_settings()
    ip = request.client.host if request.client else "unknown"
    fwd, key = request.headers.get("x-client-ip"), request.headers.get("x-internal-key", "")
    if s.internal_api_key and fwd and hmac.compare_digest(key.encode(), s.internal_api_key.encode()):
        ip = fwd.strip()[:64]
    return hashlib.sha256(f"{s.secret_key}:{ip}".encode()).hexdigest()
