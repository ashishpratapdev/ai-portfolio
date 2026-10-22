import os
from dataclasses import dataclass

try:  # optional convenience: load backend/.env if python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str
    secret_key: str
    access_token_minutes: int
    cors_origins: list[str]
    upload_dir: str
    max_upload_bytes: int
    site_url: str
    internal_api_key: str
    worker_token: str
    ai_provider: str
    anthropic_api_key: str
    ai_model: str
    ai_price_in_per_mtok: float
    ai_price_out_per_mtok: float


def _normalise_db_url(url: str) -> str:
    """Hosts hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the psycopg3 driver named explicitly."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def get_settings() -> Settings:
    env = os.environ.get("APP_ENV", "development")
    secret = os.environ.get("SECRET_KEY", "")
    if env != "test" and (len(secret) < 32 or secret.startswith("CHANGE_ME")):
        raise RuntimeError("SECRET_KEY must be set to a random string of 32+ characters")
    origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    if "*" in origins:
        raise RuntimeError("CORS_ORIGINS must list explicit origins, not '*'")
    return Settings(
        app_env=env,
        database_url=_normalise_db_url(os.environ.get("DATABASE_URL", "sqlite:///./dev.db")),
        secret_key=secret,
        access_token_minutes=int(os.environ.get("ACCESS_TOKEN_MINUTES", "60")),
        cors_origins=origins,
        upload_dir=os.environ.get("UPLOAD_DIR", "./uploads"),
        max_upload_bytes=int(os.environ.get("MAX_UPLOAD_MB", "5")) * 1024 * 1024,
        site_url=os.environ.get("SITE_URL", "http://localhost:3000").rstrip("/"),
        internal_api_key=os.environ.get("INTERNAL_API_KEY", ""),
        worker_token=os.environ.get("WORKER_TOKEN", ""),
        ai_provider=os.environ.get("AI_PROVIDER", "mock"),
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
        ai_model=os.environ.get("AI_MODEL", ""),
        ai_price_in_per_mtok=float(os.environ.get("AI_PRICE_IN_PER_MTOK", "0")),
        ai_price_out_per_mtok=float(os.environ.get("AI_PRICE_OUT_PER_MTOK", "0")),
    )
