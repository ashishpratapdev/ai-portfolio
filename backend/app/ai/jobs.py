"""Durable DB-backed job queue: idempotent enqueue, atomic claim, bounded retries with backoff, budgets,
cancellation, stale-job recovery. No in-memory state is relied on, so any process (web, cron, worker) can run it."""
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import AIConfig, AIJob, Topic, utcnow
from . import pipeline
from .provider import ProviderError

ACTIVE = ("queued", "running")
STALE_AFTER = timedelta(minutes=15)


class AIDisabled(Exception):
    pass


class BudgetExceeded(Exception):
    pass


def get_config(db: Session) -> AIConfig:
    cfg = db.scalar(select(AIConfig).limit(1))
    if cfg is None:
        cfg = AIConfig(enabled=False, frequency="manual", timezone="UTC", tone="clear, practical, friendly", categories=[],
                       feeds=[], allowed_domains=[], max_topics_per_run=5, daily_job_budget=10, monthly_token_budget=500_000,
                       stale_days=365)
        db.add(cfg)
        db.commit()
    return cfg


def enqueue(db: Session, kind: str, key: str, topic_id: Optional[int] = None, post_id: Optional[int] = None,
            now: Optional[datetime] = None) -> tuple[AIJob, bool]:
    if not get_config(db).enabled:
        raise AIDisabled()
    existing = db.scalar(select(AIJob).where(AIJob.idempotency_key == key))
    if existing:
        return existing, False
    if kind == "draft":  # one active draft job per topic/post
        q = select(AIJob).where(AIJob.kind == "draft", AIJob.state.in_(ACTIVE))
        q = q.where(AIJob.post_id == post_id) if post_id else q.where(AIJob.topic_id == topic_id)
        active = db.scalar(q.limit(1))
        if active:
            return active, False
    job = AIJob(kind=kind, topic_id=topic_id, post_id=post_id, idempotency_key=key, run_after=now or utcnow(), log=[])
    db.add(job)
    try:
        db.commit()
    except IntegrityError:  # lost a race with a concurrent enqueue of the same key
        db.rollback()
        return db.scalar(select(AIJob).where(AIJob.idempotency_key == key)), False
    return job, True


def day_start_utc(now: datetime, tz_name: str) -> datetime:
    local = now.astimezone(ZoneInfo(tz_name)).replace(hour=0, minute=0, second=0, microsecond=0)
    return local.astimezone(timezone.utc)


def usage_summary(db: Session, cfg: AIConfig, now: Optional[datetime] = None) -> dict:
    from ..config import get_settings
    now = now or utcnow()
    month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    jobs_today = db.scalar(select(func.count()).select_from(AIJob).where(AIJob.started_at >= day_start_utc(now, cfg.timezone))) or 0
    tokens = db.scalar(select(func.coalesce(func.sum(AIJob.tokens_in + AIJob.tokens_out), 0)).where(AIJob.started_at >= month)) or 0
    cost = db.scalar(select(func.coalesce(func.sum(AIJob.cost_estimate), 0.0)).where(AIJob.started_at >= month)) or 0.0
    s = get_settings()
    priced = s.ai_price_in_per_mtok > 0 or s.ai_price_out_per_mtok > 0
    return {"jobs_today": jobs_today, "daily_job_budget": cfg.daily_job_budget, "tokens_this_month": int(tokens),
            "monthly_token_budget": cfg.monthly_token_budget, "estimated_cost_usd": round(cost, 4) if priced else None,
            "cost_note": None if priced else "Set AI_PRICE_IN_PER_MTOK / AI_PRICE_OUT_PER_MTOK for a cost estimate.",
            "provider": s.ai_provider}


def check_budget(db: Session, cfg: AIConfig, now: datetime) -> None:
    u = usage_summary(db, cfg, now)
    if u["jobs_today"] > cfg.daily_job_budget:  # the current job is already counted
        raise BudgetExceeded(f"Daily job budget of {cfg.daily_job_budget} reached.")
    if u["tokens_this_month"] >= cfg.monthly_token_budget:
        raise BudgetExceeded(f"Monthly token budget of {cfg.monthly_token_budget} reached.")


def recover_stale(db: Session, now: datetime) -> int:
    res = db.execute(update(AIJob).where(AIJob.state == "running", AIJob.locked_at < now - STALE_AFTER)
                     .values(state="queued", locked_at=None, error="Recovered after a worker stopped unexpectedly"))
    db.commit()
    return res.rowcount or 0


def _backoff(attempts: int) -> timedelta:
    return timedelta(seconds=min(30 * 2 ** max(attempts - 1, 0), 900))


def _safe_error(e: Exception) -> str:
    return f"{type(e).__name__}: {e}"[:300]


def run_one(db: Session, provider, fetcher, now: Optional[datetime] = None) -> Optional[AIJob]:
    now = now or utcnow()
    cfg = get_config(db)
    if not cfg.enabled:
        return None
    recover_stale(db, now)
    job = db.scalar(select(AIJob).where(AIJob.state == "queued", AIJob.run_after <= now).order_by(AIJob.run_after, AIJob.id).limit(1))
    if job is None:
        return None
    job_id = job.id
    claimed = db.execute(update(AIJob).where(AIJob.id == job_id, AIJob.state == "queued")
                         .values(state="running", locked_at=now, started_at=now, attempts=AIJob.attempts + 1))
    db.commit()
    if claimed.rowcount != 1:  # another worker got it
        return None
    job = db.get(AIJob, job_id)
    retry = False
    try:
        if job.cancel_requested:
            raise pipeline.JobCancelled()
        check_budget(db, cfg, now)
        if job.kind == "discover":
            pipeline.run_discover(db, job, fetcher, cfg, now)
        else:
            pipeline.run_draft(db, job, provider, fetcher, cfg, now)
        db.commit()
        job = db.get(AIJob, job_id)
        job.state, job.error = "succeeded", None
    except pipeline.JobCancelled:
        db.rollback()
        job = db.get(AIJob, job_id)
        job.state, job.error = "cancelled", "Cancelled by admin"
    except (BudgetExceeded, pipeline.PermanentJobError) as e:
        db.rollback()
        job = db.get(AIJob, job_id)
        job.state, job.error = "failed", str(e)[:300]
    except ProviderError as e:
        retry = e.retryable
        db.rollback()
        job = db.get(AIJob, job_id)
        job.error = str(e)[:300]
    except Exception as e:  # unexpected: treat as transient but still bounded
        retry = True
        db.rollback()
        job = db.get(AIJob, job_id)
        job.error = _safe_error(e)
    if job.state == "running":
        if retry and job.attempts < job.max_attempts:
            job.state, job.run_after = "queued", now + _backoff(job.attempts)
        else:
            job.state = "failed"
    job.locked_at = None
    if job.state in ("succeeded", "failed", "cancelled"):
        job.finished_at = now
    if job.kind == "draft" and job.state != "succeeded":
        t = db.get(Topic, job.topic_id) if job.topic_id else None
        if t and t.status == "researching":
            t.status = "discovered" if job.state == "queued" else "failed"
    db.commit()
    return job


def run_jobs(db: Session, provider, fetcher, limit: int = 3, time_budget: float = 45) -> list[int]:
    started, done = time.monotonic(), []
    while len(done) < limit and time.monotonic() - started < time_budget:
        job = run_one(db, provider, fetcher)
        if job is None:
            break
        done.append(job.id)
    return done


def cancel(db: Session, job: AIJob) -> AIJob:
    if job.state == "queued":
        res = db.execute(update(AIJob).where(AIJob.id == job.id, AIJob.state == "queued")
                         .values(state="cancelled", finished_at=utcnow(), error="Cancelled by admin"))
        db.commit()
        db.refresh(job)
        if res.rowcount == 1:
            return job
    if job.state == "running":
        job.cancel_requested = True  # honoured between pipeline steps
        db.commit()
        return job
    raise ValueError(f"A job that is '{job.state}' cannot be cancelled.")


def retry_job(db: Session, job: AIJob) -> AIJob:
    if job.state not in ("failed", "cancelled"):
        raise ValueError(f"Only failed or cancelled jobs can be retried (this one is '{job.state}').")
    job.state, job.attempts, job.error, job.cancel_requested = "queued", 0, None, False
    job.run_after, job.finished_at = utcnow(), None
    db.commit()
    return job


def schedule_tick(db: Session, now: datetime) -> list[int]:
    """Enqueue the periodic discovery job (idempotent per period in the configured time zone) and draft jobs
    for newly discovered topics. Never publishes anything."""
    cfg = get_config(db)
    if not cfg.enabled or cfg.frequency == "manual":
        return []
    local = now.astimezone(ZoneInfo(cfg.timezone))
    period = local.date().isoformat() if cfg.frequency == "daily" else f"{local.isocalendar().year}-W{local.isocalendar().week:02d}"
    ids = []
    job, created = enqueue(db, "discover", f"discover:{cfg.frequency}:{period}", now=now)
    if created:
        ids.append(job.id)
    topics = db.scalars(select(Topic).where(Topic.status == "discovered").order_by(Topic.id).limit(cfg.max_topics_per_run)).all()
    for t in topics:
        job, created = enqueue(db, "draft", f"draft:{t.id}:{t.regen_count}", topic_id=t.id, now=now)
        if created:
            ids.append(job.id)
    return ids
