"""Factories (monkeypatched in tests) and the single `tick()` used by CLI workers and external schedulers."""
from ..models import utcnow
from ..services import blog as blog_svc
from . import jobs, research
from .provider import build_provider


def get_provider():
    return build_provider()


def get_fetcher(cfg):
    return research.HttpFetcher(cfg.allowed_domains)


def tick(db, max_jobs: int = 3, time_budget: float = 45) -> dict:
    now = utcnow()
    published = blog_svc.publish_due(db, now)
    cfg = jobs.get_config(db)
    enqueued, ran = [], []
    if cfg.enabled:
        enqueued = jobs.schedule_tick(db, now)
        ran = jobs.run_jobs(db, get_provider(), get_fetcher(cfg), max_jobs, time_budget)
    return {"published": published, "enqueued": enqueued, "ran": ran}
