"""Factories (monkeypatched in tests) and the single `tick()` used by CLI workers and external schedulers."""
from ..models import utcnow
from ..services import blog as blog_svc
from . import jobs, research
from ..jobs import providers as job_providers
from ..jobs import service as job_service
from .provider import build_provider


def get_provider():
    return build_provider()


def get_fetcher(cfg):
    return research.HttpFetcher(cfg.allowed_domains)


def get_job_fetcher():
    return research.HttpFetcher(job_providers.JOB_HOSTS)


def tick(db, max_jobs: int = 3, time_budget: float = 45) -> dict:
    now = utcnow()
    published = blog_svc.publish_due(db, now)
    cfg = jobs.get_config(db)
    enqueued, ran = [], []
    if cfg.enabled:
        enqueued = jobs.schedule_tick(db, now)
        ran = jobs.run_jobs(db, get_provider(), get_fetcher(cfg), max_jobs, time_budget)
    try:  # job hunt: does nothing unless its master switch is ON and a run is due
        job_run = job_service.tick_search(db, get_job_fetcher())
    except Exception:
        job_run = None
    return {"published": published, "enqueued": enqueued, "ran": ran, "job_search": job_run}
