import re
from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_admin
from ..models import AdminUser, Experience, Profile, Project, Service, SiteSetting, Skill
from ..schemas import (ALLOWED_SETTINGS, ExperienceIn, ExperienceOut, ProfileIn, ProfileOut, ProjectIn,
                       ProjectOut, ReorderIn, ServiceIn, ServiceOut, SkillIn, SkillOut)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "project"


def _unique_slug(db: Session, base: str, exclude_id: Optional[int]) -> str:
    slug, n = base, 2
    while True:
        q = select(Project.id).where(Project.slug == slug)
        found = db.scalar(q)
        if found is None or found == exclude_id:
            return slug
        slug, n = f"{base}-{n}", n + 1


def _project_hook(db: Session, data: dict, obj: Optional[Project]) -> dict:
    data["slug"] = _unique_slug(db, data.get("slug") or slugify(data["title"]), obj.id if obj else None)
    return data


def build_crud(prefix: str, Model, In: type[BaseModel], Out: type[BaseModel], hook: Callable | None = None):
    r = APIRouter(prefix=f"/{prefix}", tags=[f"admin:{prefix}"])

    def get_or_404(db: Session, item_id: int):
        obj = db.get(Model, item_id)
        if obj is None:
            raise HTTPException(404, f"{prefix} item not found")
        return obj

    @r.get("", response_model=list[Out])
    def list_items(status: Optional[str] = Query(None, pattern="^(draft|published|archived)$"), db: Session = Depends(get_db)):
        q = select(Model).order_by(Model.sort_order, Model.id)
        if status:
            q = q.where(Model.status == status)
        return db.scalars(q).all()

    @r.post("", response_model=Out, status_code=201)
    def create_item(body: In, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):  # type: ignore[valid-type]
        data = body.model_dump()
        if hook:
            data = hook(db, data, None)
        max_order = db.scalar(select(Model.sort_order).order_by(Model.sort_order.desc()).limit(1))
        obj = Model(**data, status="draft", sort_order=(max_order + 1) if max_order is not None else 0)
        db.add(obj)
        db.flush()
        audit(db, admin, "create", prefix, obj.id)
        db.commit()
        return obj

    @r.get("/{item_id}", response_model=Out)
    def read_item(item_id: int, db: Session = Depends(get_db)):
        return get_or_404(db, item_id)

    @r.patch("/{item_id}", response_model=Out)
    def update_item(item_id: int, patch: dict[str, Any], db: Session = Depends(get_db),
                    admin: AdminUser = Depends(get_current_admin)):
        obj = get_or_404(db, item_id)
        current = {k: getattr(obj, k) for k in In.model_fields}
        try:
            merged = In.model_validate({**current, **patch})
        except ValidationError as e:
            raise HTTPException(422, e.errors(include_url=False, include_context=False))
        data = merged.model_dump()
        if hook:
            data = hook(db, data, obj)
        for k, v in data.items():
            setattr(obj, k, v)
        audit(db, admin, "update", prefix, obj.id, ",".join(sorted(patch)))
        db.commit()
        return obj

    def set_status(item_id: int, new: str, action: str, db: Session, admin: AdminUser, allowed_from: tuple):
        obj = get_or_404(db, item_id)
        if obj.status not in allowed_from:
            raise HTTPException(409, f"Cannot {action} an item that is {obj.status}")
        obj.status = new
        audit(db, admin, action, prefix, obj.id)
        db.commit()
        return obj

    @r.post("/{item_id}/publish", response_model=Out)
    def publish(item_id: int, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
        return set_status(item_id, "published", "publish", db, admin, ("draft",))

    @r.post("/{item_id}/unpublish", response_model=Out)
    def unpublish(item_id: int, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
        return set_status(item_id, "draft", "unpublish", db, admin, ("published",))

    @r.post("/{item_id}/archive", response_model=Out)
    def archive(item_id: int, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
        return set_status(item_id, "archived", "archive", db, admin, ("draft", "published"))

    @r.post("/{item_id}/restore", response_model=Out)
    def restore(item_id: int, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
        # Restored items return as drafts so nothing reappears publicly by accident.
        return set_status(item_id, "draft", "restore", db, admin, ("archived",))

    @r.post("/reorder", status_code=204)
    def reorder(body: ReorderIn, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
        if len(set(body.ids)) != len(body.ids):
            raise HTTPException(422, "Duplicate ids")
        items = {o.id: o for o in db.scalars(select(Model).where(Model.id.in_(body.ids))).all()}
        if len(items) != len(body.ids):
            raise HTTPException(404, "One or more ids do not exist")
        for pos, item_id in enumerate(body.ids):
            items[item_id].sort_order = pos
        audit(db, admin, "reorder", prefix, detail=",".join(map(str, body.ids)))
        db.commit()

    return r


router.include_router(build_crud("skills", Skill, SkillIn, SkillOut))
router.include_router(build_crud("experience", Experience, ExperienceIn, ExperienceOut))
router.include_router(build_crud("projects", Project, ProjectIn, ProjectOut, hook=_project_hook))
router.include_router(build_crud("services", Service, ServiceIn, ServiceOut))


# ---- profile (single record)
def _profile(db: Session) -> Profile:
    p = db.scalar(select(Profile).limit(1))
    if p is None:
        p = Profile(full_name="[PLACEHOLDER] Your Name", headline="[PLACEHOLDER] Your headline",
                    bio="[PLACEHOLDER] Write your bio here.", social_links=[], status="draft")
        db.add(p)
        db.commit()
    return p


@router.get("/profile", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db)):
    return _profile(db)


@router.put("/profile", response_model=ProfileOut)
def put_profile(body: ProfileIn, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    p = _profile(db)
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    audit(db, admin, "update", "profile", p.id)
    db.commit()
    return p


@router.post("/profile/{action}", response_model=ProfileOut)
def profile_status(action: str, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    if action not in ("publish", "unpublish"):
        raise HTTPException(404, "Unknown action")
    p = _profile(db)
    p.status = "published" if action == "publish" else "draft"
    audit(db, admin, action, "profile", p.id)
    db.commit()
    return p


# ---- site settings (whitelisted keys only)
@router.get("/settings")
def get_settings_(db: Session = Depends(get_db)):
    return {s.key: s.value for s in db.scalars(select(SiteSetting)).all()}


@router.put("/settings")
def put_settings(body: dict[str, str], db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    bad = set(body) - ALLOWED_SETTINGS
    if bad:
        raise HTTPException(422, f"Unknown setting(s): {', '.join(sorted(bad))}")
    if any(len(v) > 500 for v in body.values()):
        raise HTTPException(422, "Setting values are limited to 500 characters")
    for k, v in body.items():
        row = db.get(SiteSetting, k)
        if row:
            row.value = v
        else:
            db.add(SiteSetting(key=k, value=v))
    audit(db, admin, "update", "settings", detail=",".join(sorted(body)))
    db.commit()
    return {s.key: s.value for s in db.scalars(select(SiteSetting)).all()}
