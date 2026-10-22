from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Experience, MediaAsset, Profile, Project, Service, SiteSetting, Skill
from ..routers.media import upload_path
from ..schemas import ExperienceOut, ProfileOut, ProjectOut, ServiceOut, SkillOut

router = APIRouter(prefix="/public", tags=["public"])
PUBLIC_SETTINGS = ("site_title", "tagline", "footer_text")


def _published(db: Session, Model):
    return db.scalars(select(Model).where(Model.status == "published").order_by(Model.sort_order, Model.id)).all()


@router.get("/profile", response_model=ProfileOut)
def profile(db: Session = Depends(get_db)):
    p = db.scalar(select(Profile).where(Profile.status == "published").limit(1))
    if not p:
        raise HTTPException(404, "Profile not published")
    return p


@router.get("/skills", response_model=list[SkillOut])
def skills(db: Session = Depends(get_db)):
    return _published(db, Skill)


@router.get("/experience", response_model=list[ExperienceOut])
def experience(db: Session = Depends(get_db)):
    return _published(db, Experience)


@router.get("/services", response_model=list[ServiceOut])
def services(db: Session = Depends(get_db)):
    return _published(db, Service)


@router.get("/projects", response_model=list[ProjectOut])
def projects(db: Session = Depends(get_db)):
    return _published(db, Project)


@router.get("/projects/{slug}", response_model=ProjectOut)
def project(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(Project).where(Project.slug == slug, Project.status == "published"))
    if not p:
        raise HTTPException(404, "Project not found")
    return p


@router.get("/settings")
def settings(db: Session = Depends(get_db)):
    rows = db.scalars(select(SiteSetting).where(SiteSetting.key.in_(PUBLIC_SETTINGS))).all()
    return {r.key: r.value for r in rows}


def _serve(a: MediaAsset, disposition: str):
    return FileResponse(upload_path(a.stored_name), media_type=a.content_type,
                        headers={"X-Content-Type-Options": "nosniff", "Content-Disposition": disposition})


@router.get("/media/{media_id}")
def public_media(media_id: int, db: Session = Depends(get_db)):
    a = db.get(MediaAsset, media_id)
    if not a or not a.is_public:
        raise HTTPException(404, "Not found")
    return _serve(a, "inline" if a.content_type.startswith("image/") else "attachment")


@router.get("/resume")
def resume(db: Session = Depends(get_db)):
    """Serves the resume only if one is configured AND explicitly marked public."""
    row = db.get(SiteSetting, "resume_media_id")
    if not row or not row.value.isdigit():
        raise HTTPException(404, "No resume available")
    a = db.get(MediaAsset, int(row.value))
    if not a or not a.is_public or a.content_type != "application/pdf":
        raise HTTPException(404, "No resume available")
    return _serve(a, 'attachment; filename="resume.pdf"')
