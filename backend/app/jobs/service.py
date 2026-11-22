"""Job-hunt engine. The master switch (JobSearchConfig.enabled) gates EVERYTHING that touches the outside world:
when it is OFF no job site is contacted, not by a manual click and not by the scheduler."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

from ..ai.provider import ProviderError
from ..ai.research import FetchError
from ..config import get_settings
from ..deps import audit
from ..models import AdminUser, Experience, JobListing, JobSearchConfig, JobSearchRun, Profile, SiteSetting, Skill, utcnow
from ..seed_resume import EXPERIENCE as SEED_EXPERIENCE
from ..seed_resume import PROFILE as SEED_PROFILE
from ..seed_resume import SETTINGS as SEED_SETTINGS
from ..seed_resume import SKILLS as SEED_SKILLS
from ..services.blog import as_utc
from . import apply_ai, matching, resume
from . import providers as pv
from .draft_schema import ApplicationDraft

STATUSES = ("new", "saved", "ready", "applied", "interview", "offer", "rejected", "dismissed")
MANUAL_GAP = timedelta(minutes=10)
SOURCE_GAP_MANUAL = timedelta(minutes=30)
SOURCE_GAP_SCHEDULED = timedelta(hours=3)
MAX_AGE_DAYS = 45
DEFAULTS = dict(
    keywords=["react", "next.js", "node.js", "full stack", "javascript", "python"],
    exclude_keywords=["senior", "lead", "principal", "staff", "manager", "director", "architect", "head of"],
    locations=["India", "Remote"], sources=["remoteok", "jobicy", "arbeitnow"],
)


class SearchDisabled(Exception):
    pass


class SearchTooSoon(Exception):
    def __init__(self, seconds: int):
        super().__init__(f"Please wait {seconds // 60 + 1} minute(s) before searching again.")
        self.seconds = seconds


class PrepLimit(Exception):
    pass


def get_config(db: Session) -> JobSearchConfig:
    cfg = db.scalar(select(JobSearchConfig).limit(1))
    if cfg is None:
        cfg = JobSearchConfig(enabled=False, remote_only=False, min_fit_score=35, max_new_per_run=40, interval_hours=12, my_years=2,
                              max_preps_per_day=20, company_boards=[], apply_goal=20, **{k: list(v) for k, v in DEFAULTS.items()})
        db.add(cfg)
        db.commit()
    return cfg


def set_enabled(db: Session, enabled: bool, admin: Optional[AdminUser]) -> JobSearchConfig:
    cfg = get_config(db)
    cfg.enabled = enabled
    cfg.enabled_at = utcnow() if enabled else cfg.enabled_at
    audit(db, admin, "job_search_on" if enabled else "job_search_off", "job_search")
    db.commit()
    return cfg


def owner_skill_names(db: Session, cfg: Optional[JobSearchConfig] = None) -> list[str]:
    """Skills from the portfolio (or the resume seed) PLUS everything detected in the uploaded resume."""
    names = [n for (n,) in db.execute(select(Skill.name).where(Skill.status == "published").order_by(Skill.sort_order))]
    names = names or [n for _, group in SEED_SKILLS for n in group]
    extra = list((cfg.resume_skills if cfg is not None else None) or [])
    return names + [x for x in extra if x not in names]


# ------------------------------ resume (the owner's own, private)
def resume_summary(cfg: JobSearchConfig) -> dict:
    if not cfg.resume_text:
        return {"uploaded": False}
    a = resume.analyze_resume(cfg.resume_text)
    return {"uploaded": True, "filename": cfg.resume_filename, "uploaded_at": cfg.resume_uploaded_at, "skills": a["skills"], "titles": a["titles"],
            "years": a["years"], "keywords": a["keywords"], "chars": a["chars"], "excerpt": cfg.resume_text[:300]}


def set_resume(db: Session, text: str, filename: str) -> dict:
    text = resume.clean(text)
    if len(text) < 80:
        raise resume.ResumeError("The resume text is too short to read. Paste more of it.")
    a = resume.analyze_resume(text)
    cfg = get_config(db)
    cfg.resume_text, cfg.resume_skills, cfg.resume_titles, cfg.resume_years = text, a["skills"], a["titles"], a["years"]
    cfg.resume_filename, cfg.resume_uploaded_at = filename[:255], utcnow()
    db.commit()
    return resume_summary(cfg)


def clear_resume(db: Session) -> None:
    cfg = get_config(db)
    cfg.resume_text = cfg.resume_skills = cfg.resume_titles = cfg.resume_years = cfg.resume_filename = cfg.resume_uploaded_at = None
    db.commit()


def use_resume_keywords(db: Session) -> JobSearchConfig:
    cfg = get_config(db)
    if not cfg.resume_text:
        raise resume.ResumeError("Upload or paste your resume first.")
    a = resume.analyze_resume(cfg.resume_text)
    if a["keywords"]:
        cfg.keywords = a["keywords"]
    if a["years"]:
        cfg.my_years = min(a["years"], 40)
    db.commit()
    return cfg


def _period(e) -> str:
    fmt = lambda d: d.strftime("%b %Y") if d else "Present"  # noqa: E731
    return f"{fmt(e['start_date'])} - {fmt(e['end_date'])}"


def owner_facts(db: Session, cfg: JobSearchConfig) -> dict:
    """The ONLY personal data the AI may use: the owner's own profile, with the resume seed as a fallback."""
    p = db.scalar(select(Profile).where(Profile.status == "published").limit(1))
    prof = ({"full_name": p.full_name, "headline": p.headline, "bio": p.bio, "location": p.location, "contact_email": p.contact_email}
            if p and not p.full_name.startswith("[PLACEHOLDER]") else SEED_PROFILE)
    rows = db.scalars(select(Experience).where(Experience.status == "published").order_by(Experience.sort_order)).all()
    exp = [{"role": r.role, "company": r.company, "start_date": r.start_date, "end_date": r.end_date, "description": r.description} for r in rows] or SEED_EXPERIENCE
    edu = db.get(SiteSetting, "education")
    return {
        "name": prof["full_name"], "headline": prof["headline"], "bio": prof["bio"], "location": prof.get("location"), "email": prof.get("contact_email"),
        "years_professional": cfg.my_years, "skills": owner_skill_names(db, cfg), "resume_excerpt": (cfg.resume_text or "")[:3500],
        "experience": [{"role": e["role"], "company": e["company"], "period": _period(e),
                        "highlights": [l.lstrip("• ").strip() for l in e["description"].split("\n") if l.strip()][:4]} for e in exp],
        "education": edu.value if edu else SEED_SETTINGS["education"],
    }


def _since_last(db: Session, name: str, now: datetime, gap: timedelta) -> bool:
    cutoff = now - gap
    for run in db.scalars(select(JobSearchRun).where(JobSearchRun.started_at >= cutoff).order_by(JobSearchRun.id.desc())):
        if (run.details or {}).get(name, {}).get("fetched", 0) > 0:
            return True
    return False


def run_search(db: Session, fetcher, trigger: str = "manual", now: Optional[datetime] = None) -> JobSearchRun:
    cfg = get_config(db)
    if not cfg.enabled:
        raise SearchDisabled()
    now = now or utcnow()
    gap = MANUAL_GAP if trigger == "manual" else timedelta(hours=cfg.interval_hours)
    if cfg.last_run_at is not None and now - as_utc(cfg.last_run_at) < gap:
        raise SearchTooSoon(int((gap - (now - as_utc(cfg.last_run_at))).total_seconds()))
    cfg.last_run_at = now  # claim the slot first so two callers cannot search at once
    run = JobSearchRun(trigger=trigger, started_at=now, status="running", details={})
    db.add(run)
    db.commit()

    skills = matching.user_skill_set(owner_skill_names(db, cfg))
    settings = get_settings()
    details: dict = {}
    new = seen = 0
    for name in cfg.sources:
        if name not in pv.FETCHERS:
            details[name] = {"error": "unknown source"}
            continue
        if _since_last(db, name, now, SOURCE_GAP_MANUAL if trigger == "manual" else SOURCE_GAP_SCHEDULED):
            details[name] = {"skipped": "fetched recently (respecting the source's rate limits)"}
            continue
        try:
            res = pv.FETCHERS[name](fetcher, cfg, settings)
            raw, notes = res if isinstance(res, tuple) else (res, [])
        except pv.SourceUnavailable as e:
            details[name] = {"skipped": str(e)}
            continue
        except FetchError as e:
            details[name] = {"error": str(e)[:200]}
            continue
        except Exception as e:  # one broken source must never abort the others
            details[name] = {"error": type(e).__name__}
            continue
        raw.sort(key=lambda j: as_utc(j.posted_at) or datetime(1970, 1, 1, tzinfo=timezone.utc), reverse=True)
        added = 0
        for j in raw:
            seen += 1
            if new >= cfg.max_new_per_run:
                break
            posted = as_utc(j.posted_at)
            if posted and now - posted > timedelta(days=MAX_AGE_DAYS):
                continue
            if matching.excluded(j.title, cfg.exclude_keywords) or not matching.location_ok(j, cfg):
                continue
            dk = matching.dedupe_key(j.company, j.title)
            if db.scalar(select(JobListing.id).where(or_(and_(JobListing.source == j.source, JobListing.external_id == j.external_id), JobListing.dedupe_key == dk)).limit(1)):
                continue
            score, reasons = matching.score_job(j, skills, cfg)
            if score < cfg.min_fit_score:
                continue
            db.add(JobListing(source=j.source, external_id=j.external_id, dedupe_key=dk, title=j.title, company=j.company, location=j.location, remote=j.remote,
                              url=j.url, apply_url=j.apply_url, description=j.description, tags=j.tags, salary_text=j.salary_text, posted_at=posted,
                              fetched_at=now, fit_score=score, fit_reasons=reasons, status="new", highlights=[], prep_warnings=[]))
            db.flush()
            new += 1
            added += 1
        details[name] = {"fetched": len(raw), "new": added, **({"notes": notes[:10]} if notes else {})}
        db.commit()
    errors = [d for d in details.values() if "error" in d]
    ok_sources = [d for d in details.values() if "error" not in d and "skipped" not in d]
    run.status = "ok" if not errors else ("partial" if ok_sources else "failed")
    run.new_count, run.seen_count, run.details, run.finished_at = new, seen, details, utcnow()
    db.execute(delete(JobListing).where(JobListing.status.in_(("new", "dismissed")), JobListing.fetched_at < now - timedelta(days=60)))
    audit(db, None, "job_search", "job_search", run.id, f"{trigger}: {new} new")
    db.commit()
    return run


def tick_search(db: Session, fetcher, now: Optional[datetime] = None) -> Optional[int]:
    """Called by the scheduler/worker. Does nothing at all unless the master switch is ON and a run is due."""
    cfg = get_config(db)
    if not cfg.enabled:
        return None
    try:
        return run_search(db, fetcher, "scheduled", now).id
    except (SearchDisabled, SearchTooSoon):
        return None


def prepare_application(db: Session, listing: JobListing, provider, now: Optional[datetime] = None) -> JobListing:
    """AI drafts a tailored cover letter + resume highlights from the owner's verified facts. Never submits anything."""
    cfg = get_config(db)
    now = now or utcnow()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    used = db.scalar(select(func.count()).select_from(JobListing).where(JobListing.prepared_at >= day_start)) or 0
    if used >= cfg.max_preps_per_day:
        raise PrepLimit(f"Daily limit of {cfg.max_preps_per_day} prepared applications reached.")
    facts = owner_facts(db, cfg)
    job = {"title": listing.title, "company": listing.company, "location": listing.location, "tags": listing.tags, "description": listing.description}
    system, user = apply_ai.build_prompt(facts, job)
    raw, usage = provider.complete_json(system, user, 2500)
    try:
        draft = ApplicationDraft.model_validate(raw)
    except Exception:
        raise ProviderError("The AI answer did not match the required format. Try again.", retryable=True)
    warnings = apply_ai.check_application(draft.model_dump(), facts, job)
    listing.cover_letter, listing.highlights, listing.prep_warnings = draft.cover_letter, draft.resume_highlights, warnings
    listing.prepared_at, listing.prep_tokens = now, listing.prep_tokens + usage.tokens_in + usage.tokens_out
    if listing.status in ("new", "saved"):
        listing.status = "ready"
    db.commit()
    return listing
