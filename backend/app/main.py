from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .routers import admin, ai_admin, auth, blog_admin, blog_public, contact, media, public, worker
from .services.blog import BlogError

settings = get_settings()
app = FastAPI(title="Portfolio API", version="0.3.0",
              docs_url=None if settings.app_env == "production" else "/docs",
              redoc_url=None, openapi_url=None if settings.app_env == "production" else "/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Worker-Token", "X-Client-IP", "X-Internal-Key"],
    allow_credentials=False,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    if request.url.path.startswith("/api/v1/admin") or request.url.path.startswith("/api/v1/auth"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


@app.exception_handler(BlogError)
async def blog_error(_: Request, exc: BlogError):
    return JSONResponse({"detail": exc.message}, status_code=exc.status)


API = "/api/v1"
for r in (auth.router, public.router, blog_public.router, contact.public, admin.router, media.router,
          blog_admin.router, contact.admin, ai_admin.router, worker.router):
    app.include_router(r, prefix=API)


@app.get("/health")
def health():
    return {"status": "ok"}
