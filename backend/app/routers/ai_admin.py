from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import jobs, research, runtime
from ..ai.provider import ProviderError
from ..database import get_db
from ..deps import audit, get_current_admin
from ..models import AdminUser, AIJob, AuditLog, BlogPost, Source, Topic
from ..schemas import SafeUrl, Strict

router = APIRouter(prefix="/admin/ai", tags=["admin:ai"], dependencies=[Depends(get_current_admin)])

DomainName = str


class ConfigIn(Strict):
    enabled: bool
    frequency: str = Field(pattern="^(manual|daily|weekly)$")
    timezone: str = Field(min_length=1, max_length=64)
    tone: str = Field(min_length=1, max_length=120)
    categories: list[str] = Field(default_factory=list, max_length=20)
    feeds: list[SafeUrl] = Field(default_factory=list, max_length=20)
    allowed_domains: list[str] = Field(default_factory=list, max_length=50)
    max_topics_per_run: int = Field(ge=1, le=20)
    daily_job_budget: int = Field(ge=0, le=500)
    monthly_token_budget: int = Field(ge=0, le=50_000_000)
    stale_days: int = Field(ge=30, le=3650)

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v):
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Unknown time zone. Use an IANA name such as Asia/Kolkata or UTC.")
        return v

    @field_validator("categories")
    @classmethod
    def _cats(cls, v):
        if any(not c.strip() or len(c) > 60 for c in v):
            raise ValueError("Categories must be 1-60 characters")
        return [c.strip() for c in v]

    @field_validator("allowed_domains")
    @classmethod
    def _domains(cls, v):
        out = []
        for d in v:
            d = d.strip().lower()
            if not d or "/" in d or ":" in d or " " in d or "." not in d:
                raise ValueError(f"'{d}' is not a bare domain like example.com")
            out.append(d)
        return out


class TopicIn(Strict):
    title: str = Field(min_length=3, max_length=300, pattern=r"^[^\r\n]+$")
    url: Optional[SafeUrl] = None
    summary: Optional[str] = Field(None, max_length=1500)


class RejectIn(Strict):
    reason: str = Field(min_length=1, max_length=500)


def _job(j: AIJob) -> dict:
    return {c: getattr(j, c) for c in ("id", "kind", "topic_id", "post_id", "state", "attempts", "max_attempts", "run_after",
                                       "error", "tokens_in", "tokens_out", "cost_estimate", "cancel_requested", "created_at",
                                       "started_at", "finished_at", "log")}


def _topic(t: Topic, sources: bool = False, db: Session | None = None) -> dict:
    d = {c: getattr(t, c) for c in ("id", "title", "summary", "source_url", "status", "reject_reason", "post_id", "created_at")}
    if sources and db is not None:
        d["sources"] = [{"url": s.url, "title": s.title, "domain": s.domain, "published_at": s.published_at,
                         "retrieved_at": s.retrieved_at} for s in db.scalars(select(Source).where(Source.topic_id == t.id))]
    return d


def _enqueue(db, *args, **kwargs):
    try:
        return jobs.enqueue(db, *args, **kwargs)
    except jobs.AIDisabled:
        raise HTTPException(409, "The AI pipeline is disabled. Enable it in the AI settings first.")


@router.get("/config")
def get_config(db: Session = Depends(get_db)):
    c = jobs.get_config(db)
    return {k: getattr(c, k) for k in ConfigIn.model_fields}


@router.put("/config")
def put_config(body: ConfigIn, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    c = jobs.get_config(db)
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    audit(db, me, "update", "ai_config", c.id)
    db.commit()
    return {k: getattr(c, k) for k in ConfigIn.model_fields}


@router.get("/usage")
def usage(db: Session = Depends(get_db)):
    return jobs.usage_summary(db, jobs.get_config(db))


@router.get("/topics")
def topics(status: Optional[str] = Query(None, pattern="^(discovered|researching|drafted|rejected|failed|duplicate)$"),
           db: Session = Depends(get_db)):
    q = select(Topic).order_by(Topic.id.desc()).limit(200)
    if status:
        q = q.where(Topic.status == status)
    return [_topic(t, True, db) for t in db.scalars(q).all()]


@router.post("/topics", status_code=201)
def add_topic(body: TopicIn, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    key = research.dedupe_key(body.title)
    if db.scalar(select(Topic.id).where(Topic.dedupe_key == key)):
        raise HTTPException(409, "A topic with this title already exists")
    t = Topic(title=body.title, summary=body.summary, source_url=body.url, status="discovered", dedupe_key=key)
    db.add(t)
    db.flush()
    if body.url:  # manual sources must be on an approved domain too
        cfg = jobs.get_config(db)
        if not research.domain_allowed(body.url, cfg.allowed_domains):
            raise HTTPException(422, "That URL's domain is not on the approved list")
        db.add(Source(topic_id=t.id, url=body.url, title=body.title, domain=research.host_of(body.url), published_at=None,
                      excerpt=(body.summary or "")[:1500], content_hash=""))
    audit(db, me, "create", "ai_topic", t.id)
    db.commit()
    return _topic(t, True, db)


@router.post("/topics/{topic_id}/reject")
def reject_topic(topic_id: int, body: RejectIn, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    t = db.get(Topic, topic_id)
    if not t:
        raise HTTPException(404, "Topic not found")
    if t.status not in ("discovered", "failed", "duplicate"):
        raise HTTPException(409, f"A topic that is '{t.status}' cannot be rejected")
    t.status, t.reject_reason = "rejected", body.reason
    audit(db, me, "reject", "ai_topic", t.id, body.reason)
    db.commit()
    return _topic(t)


@router.post("/topics/{topic_id}/draft", status_code=202)
def draft_topic(topic_id: int, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    t = db.get(Topic, topic_id)
    if not t:
        raise HTTPException(404, "Topic not found")
    if t.status not in ("discovered", "failed"):
        raise HTTPException(409, f"A topic that is '{t.status}' cannot be drafted")
    job, created = _enqueue(db, "draft", f"draft:{t.id}:{t.regen_count}", topic_id=t.id)
    audit(db, me, "enqueue", "ai_job", job.id, f"draft topic {t.id}")
    db.commit()
    return {**_job(job), "already_queued": not created}


@router.post("/posts/{post_id}/regenerate", status_code=202)
def regenerate(post_id: int, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    p = db.get(BlogPost, post_id)
    if not p or not p.is_ai_generated or not p.source_topic_id:
        raise HTTPException(404, "AI draft not found")
    if p.state not in ("draft", "in_review", "rejected"):
        raise HTTPException(409, "Return the post to draft before regenerating it")
    t = db.get(Topic, p.source_topic_id)
    t.regen_count += 1
    job, created = _enqueue(db, "draft", f"regen:{p.id}:{t.regen_count}", topic_id=t.id, post_id=p.id)
    audit(db, me, "enqueue", "ai_job", job.id, f"regenerate post {p.id}")
    db.commit()
    return {**_job(job), "already_queued": not created}


@router.post("/discover", status_code=202)
def discover(db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    from ..models import utcnow
    now = utcnow()
    job, created = _enqueue(db, "discover", f"discover:manual:{now:%Y%m%d%H}", now=now)  # one manual run per hour
    audit(db, me, "enqueue", "ai_job", job.id, "discover")
    db.commit()
    return {**_job(job), "already_queued": not created}


@router.post("/run")
def run_now(db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    cfg = jobs.get_config(db)
    if not cfg.enabled:
        raise HTTPException(409, "The AI pipeline is disabled.")
    try:
        provider = runtime.get_provider()
    except ProviderError as e:
        raise HTTPException(500, str(e))
    ids = jobs.run_jobs(db, provider, runtime.get_fetcher(cfg), limit=2, time_budget=40)
    audit(db, me, "run_jobs", "ai_job", detail=",".join(map(str, ids)))
    db.commit()
    return {"ran": ids}


@router.get("/jobs")
def list_jobs(state: Optional[str] = Query(None, pattern="^(queued|running|succeeded|failed|cancelled)$"), db: Session = Depends(get_db)):
    q = select(AIJob).order_by(AIJob.id.desc()).limit(100)
    if state:
        q = q.where(AIJob.state == state)
    return [_job(j) for j in db.scalars(q).all()]


def _job_or_404(db, job_id) -> AIJob:
    j = db.get(AIJob, job_id)
    if not j:
        raise HTTPException(404, "Job not found")
    return j


@router.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    return _job(_job_or_404(db, job_id))


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: int, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    try:
        j = jobs.cancel(db, _job_or_404(db, job_id))
    except ValueError as e:
        raise HTTPException(409, str(e))
    audit(db, me, "cancel", "ai_job", j.id)
    db.commit()
    return _job(j)


@router.post("/jobs/{job_id}/retry")
def retry_job(job_id: int, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    if not jobs.get_config(db).enabled:
        raise HTTPException(409, "The AI pipeline is disabled.")
    try:
        j = jobs.retry_job(db, _job_or_404(db, job_id))
    except ValueError as e:
        raise HTTPException(409, str(e))
    audit(db, me, "retry", "ai_job", j.id)
    db.commit()
    return _job(j)


@router.get("/review-queue")
def review_queue(db: Session = Depends(get_db)):
    from ..services.blog import post_to_dict
    rows = db.scalars(select(BlogPost).where(BlogPost.is_ai_generated.is_(True), BlogPost.state == "in_review")
                      .order_by(BlogPost.updated_at.desc())).all()
    return [{k: v for k, v in post_to_dict(p, admin=True).items() if k != "body"} for p in rows]


@router.get("/history")
def history(db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditLog).where(AuditLog.entity.in_(("ai_job", "ai_topic", "ai_config", "blog_post")))
                      .order_by(AuditLog.id.desc()).limit(100)).all()
    return [{"id": a.id, "admin_id": a.admin_id, "action": a.action, "entity": a.entity, "entity_id": a.entity_id,
             "detail": a.detail, "created_at": a.created_at} for a in rows]
