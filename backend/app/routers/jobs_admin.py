import os
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..ai import runtime
from ..ai.provider import ProviderError
from ..config import get_settings
from ..database import get_db
from ..deps import audit, get_current_admin
from ..jobs import providers as pv
from ..jobs import resume as resume_mod
from ..jobs import service
from ..models import AdminUser, JobListing, JobSearchRun, utcnow
from ..schemas_jobs import JobConfigIn, JobPatch, ResumeTextIn, ToggleIn
from ..services.blog import as_utc

router = APIRouter(prefix="/admin/jobs", tags=["admin:jobs"], dependencies=[Depends(get_current_admin)])

CONFIG_FIELDS = list(JobConfigIn.model_fields)


def _config(db: Session) -> dict:
    c = service.get_config(db)
    s = get_settings()
    sources = [{"key": k, "name": v["name"], "home": v["home"], "needs_key": v["needs_key"],
               "available": (not v["needs_key"]) or bool(s.adzuna_app_id and s.adzuna_app_key)} for k, v in pv.SOURCE_INFO.items()]
    values = {k: getattr(c, k) for k in CONFIG_FIELDS}
    values["company_boards"] = values["company_boards"] or []
    values["apply_goal"] = values["apply_goal"] or 20
    return {"enabled": c.enabled, "enabled_at": c.enabled_at, "last_run_at": c.last_run_at, **values, "available_sources": sources, "resume": service.resume_summary(c)}


def _row(j: JobListing, full: bool = False) -> dict:
    d = {k: getattr(j, k) for k in ("id", "source", "title", "company", "location", "remote", "url", "apply_url", "tags", "salary_text", "posted_at", "fetched_at",
                                    "fit_score", "fit_reasons", "status", "prepared_at", "applied_at", "notes")}
    d["source_name"] = pv.SOURCE_INFO.get(j.source, {}).get("name", j.source)
    d["has_cover_letter"] = bool(j.cover_letter)
    if full:
        d.update(description=j.description, cover_letter=j.cover_letter, highlights=j.highlights, prep_warnings=j.prep_warnings, prep_tokens=j.prep_tokens)
    return d


def _get(db: Session, job_id: int) -> JobListing:
    j = db.get(JobListing, job_id)
    if not j:
        raise HTTPException(404, "Job not found")
    return j


@router.get("/config")
def get_config(db: Session = Depends(get_db)):
    return _config(db)


@router.put("/config")
def put_config(body: JobConfigIn, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    c = service.get_config(db)
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    audit(db, me, "update", "job_search_config", c.id)
    db.commit()
    return _config(db)


@router.post("/toggle")
def toggle(body: ToggleIn, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    service.set_enabled(db, body.enabled, me)
    return _config(db)


@router.post("/search", status_code=202)
def search(db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    try:
        run = service.run_search(db, runtime.get_job_fetcher(), "manual")
    except service.SearchDisabled:
        raise HTTPException(409, "Job search is switched OFF. Turn it on first; nothing is fetched while it is off.")
    except service.SearchTooSoon as e:
        raise HTTPException(429, str(e), headers={"Retry-After": str(e.seconds)})
    audit(db, me, "job_search_manual", "job_search", run.id)
    db.commit()
    return {"id": run.id, "status": run.status, "new_count": run.new_count, "seen_count": run.seen_count, "details": run.details}


@router.get("/runs")
def runs(db: Session = Depends(get_db)):
    return [{"id": r.id, "trigger": r.trigger, "status": r.status, "new_count": r.new_count, "seen_count": r.seen_count, "details": r.details,
             "started_at": r.started_at, "finished_at": r.finished_at} for r in db.scalars(select(JobSearchRun).order_by(JobSearchRun.id.desc()).limit(20))]


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    c = service.get_config(db)
    now = utcnow()
    counts = dict(db.execute(select(JobListing.status, func.count()).group_by(JobListing.status)).all())
    found, applied, by_source = {}, {}, {}
    for fetched, applied_at, source in db.execute(select(JobListing.fetched_at, JobListing.applied_at, JobListing.source)).all():
        f, a = as_utc(fetched), as_utc(applied_at)
        if f:
            found[(f.year, f.month)] = found.get((f.year, f.month), 0) + 1
        if a:
            applied[(a.year, a.month)] = applied.get((a.year, a.month), 0) + 1
        by_source[source] = by_source.get(source, 0) + 1
    this, last = (now.year, now.month), ((now.year, now.month - 1) if now.month > 1 else (now.year - 1, 12))
    checks = [("Resume uploaded", bool(c.resume_text), 40), ("5+ skills detected", len(c.resume_skills or []) >= 5, 20),
              ("3+ search keywords", len(c.keywords or []) >= 3, 20), ("Company boards added", bool(c.company_boards), 20)]
    return {
        "enabled": c.enabled, "last_run_at": c.last_run_at, "counts": {s: counts.get(s, 0) for s in service.STATUSES},
        "year": now.year, "monthly": {"found": [found.get((now.year, m), 0) for m in range(1, 13)], "applied": [applied.get((now.year, m), 0) for m in range(1, 13)]},
        "this_month": {"found": found.get(this, 0), "applied": applied.get(this, 0)}, "last_month": {"found": found.get(last, 0), "applied": applied.get(last, 0)},
        "goal": c.apply_goal or 20, "by_source": by_source,
        "completeness": {"percent": sum(w for _, ok, w in checks if ok), "checks": [{"label": l, "done": ok} for l, ok, _ in checks]},
    }


@router.get("/resume")
def get_resume(db: Session = Depends(get_db)):
    return service.resume_summary(service.get_config(db))


def _store_resume(db: Session, text: str, name: str, me: AdminUser) -> dict:
    try:
        summary = service.set_resume(db, text, name)
    except resume_mod.ResumeError as e:
        raise HTTPException(422, str(e))
    audit(db, me, "resume_update", "job_search", detail=name)
    db.commit()
    return summary


@router.post("/resume/upload")
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    data = await file.read(2_000_001)
    if len(data) > 2_000_000:
        raise HTTPException(413, "The file is larger than 2 MB.")
    name = os.path.basename(file.filename or "resume")[:255]
    if name.lower().endswith((".txt", ".md")):
        text = data.decode("utf-8", "replace")
    elif name.lower().endswith(".pdf") or data.startswith(b"%PDF-"):
        try:
            text = resume_mod.extract_text_pdf(data)
        except resume_mod.ResumeError as e:
            raise HTTPException(422, str(e))
    else:
        raise HTTPException(415, "Upload a PDF or a .txt file, or paste your resume text.")
    return _store_resume(db, text, name, me)


@router.post("/resume/text")
def paste_resume(body: ResumeTextIn, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    return _store_resume(db, body.text, "pasted text", me)


@router.delete("/resume")
def delete_resume(db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    service.clear_resume(db)
    audit(db, me, "resume_delete", "job_search")
    db.commit()
    return {"uploaded": False}


@router.post("/resume/apply-keywords")
def apply_resume_keywords(db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    try:
        service.use_resume_keywords(db)
    except resume_mod.ResumeError as e:
        raise HTTPException(409, str(e))
    audit(db, me, "update", "job_search_config", detail="keywords from resume")
    db.commit()
    return _config(db)


@router.get("")
def list_jobs(status: Optional[str] = Query(None, pattern="^(new|saved|ready|applied|interview|offer|rejected|dismissed|active)$"),
              min_score: int = Query(0, ge=0, le=100), source: Optional[str] = Query(None, max_length=20), q: Optional[str] = Query(None, max_length=100),
              sort: str = Query("fit", pattern="^(fit|recent)$"), limit: int = Query(100, ge=1, le=200), db: Session = Depends(get_db)):
    stmt = select(JobListing)
    if status == "active":
        stmt = stmt.where(JobListing.status.in_(("new", "saved", "ready")))
    elif status:
        stmt = stmt.where(JobListing.status == status)
    if min_score:
        stmt = stmt.where(JobListing.fit_score >= min_score)
    if source:
        stmt = stmt.where(JobListing.source == source)
    if q:
        stmt = stmt.where(or_(JobListing.title.icontains(q, autoescape=True), JobListing.company.icontains(q, autoescape=True)))
    order = (JobListing.fetched_at.desc(), JobListing.id.desc()) if sort == "recent" else (JobListing.fit_score.desc(), JobListing.posted_at.desc().nullslast(), JobListing.id.desc())
    stmt = stmt.order_by(*order).limit(limit)
    return [_row(j) for j in db.scalars(stmt).all()]


@router.get("/{job_id}")
def read(job_id: int, db: Session = Depends(get_db)):
    return _row(_get(db, job_id), full=True)


@router.patch("/{job_id}")
def patch(job_id: int, body: JobPatch, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    j = _get(db, job_id)
    sent = body.model_fields_set
    if "cover_letter" in sent:
        j.cover_letter = body.cover_letter or None
    if "notes" in sent:
        j.notes = body.notes or None
    if body.status is not None:
        if body.status == "ready" and not j.cover_letter:
            raise HTTPException(422, "Prepare or write a cover letter before marking a job ready.")
        j.status = body.status
        if body.status == "applied" and j.applied_at is None:
            j.applied_at = utcnow()
    audit(db, me, "update", "job_listing", j.id, body.status or "")
    db.commit()
    return _row(j, full=True)


@router.post("/{job_id}/prepare")
def prepare(job_id: int, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    j = _get(db, job_id)
    try:
        provider = runtime.get_provider()
        service.prepare_application(db, j, provider)
    except service.PrepLimit as e:
        raise HTTPException(429, str(e))
    except ProviderError as e:
        raise HTTPException(502, str(e))
    audit(db, me, "job_prepare", "job_listing", j.id)
    db.commit()
    return _row(j, full=True)
