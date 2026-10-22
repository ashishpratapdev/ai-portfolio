from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_admin
from ..models import AdminUser, BlogPost, PostRevision
from ..schemas_blog import ApproveIn, PostIn, RejectIn, ScheduleIn
from ..services import blog as svc

router = APIRouter(prefix="/admin/blog", tags=["admin:blog"], dependencies=[Depends(get_current_admin)])


def _get(db: Session, post_id: int) -> BlogPost:
    p = db.get(BlogPost, post_id)
    if not p:
        raise HTTPException(404, "Post not found")
    return p


def _out(post: BlogPost, **extra) -> dict:
    return {**svc.post_to_dict(post, admin=True), **extra}


@router.get("")
def list_posts(state: Optional[str] = Query(None, pattern="^(draft|in_review|approved|scheduled|published|rejected)$"),
               ai: Optional[bool] = None, q: Optional[str] = Query(None, max_length=100), db: Session = Depends(get_db)):
    stmt = select(BlogPost).order_by(BlogPost.updated_at.desc())
    if state:
        stmt = stmt.where(BlogPost.state == state)
    if ai is not None:
        stmt = stmt.where(BlogPost.is_ai_generated == ai)
    if q:
        stmt = stmt.where(or_(BlogPost.title.icontains(q, autoescape=True), BlogPost.excerpt.icontains(q, autoescape=True)))
    return [{k: v for k, v in _out(p).items() if k != "body"} for p in db.scalars(stmt).all()]


@router.post("", status_code=201)
def create(body: PostIn, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    post = svc.create_post(db, body.model_dump(), admin)
    db.commit()
    return _out(post)


@router.get("/{post_id}")
def read(post_id: int, db: Session = Depends(get_db)):
    return _out(_get(db, post_id))


@router.patch("/{post_id}")
def update(post_id: int, patch: dict[str, Any], db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    post = _get(db, post_id)
    current = {f: getattr(post, f) for f in PostIn.model_fields if f not in ("categories", "tags")}
    current["categories"] = [c.name for c in post.categories]
    current["tags"] = [t.name for t in post.tags]
    try:
        merged = PostIn.model_validate({**current, **patch})
    except ValidationError as e:
        raise HTTPException(422, e.errors(include_url=False, include_context=False))
    invalidated = svc.apply_content(db, post, merged.model_dump(), admin.id)
    audit(db, admin, "update", "blog_post", post.id, ",".join(sorted(patch)))
    db.commit()
    return _out(post, approval_invalidated=invalidated)


@router.get("/{post_id}/revisions")
def revisions(post_id: int, db: Session = Depends(get_db)):
    _get(db, post_id)
    rows = db.scalars(select(PostRevision).where(PostRevision.post_id == post_id).order_by(PostRevision.revision_no.desc())).all()
    return [{"revision_no": r.revision_no, "content_hash": r.content_hash, "source": r.source, "created_by": r.created_by,
             "created_at": r.created_at, "snapshot": r.snapshot} for r in rows]


def _action(fn):
    def run(post_id: int, db: Session, admin: AdminUser, *args):
        post = _get(db, post_id)
        fn(db, post, admin, *args)
        db.commit()
        return _out(post)
    return run


@router.post("/{post_id}/review")
def review(post_id: int, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return _action(svc.request_review)(post_id, db, admin)


@router.post("/{post_id}/approve")
def approve(post_id: int, body: ApproveIn, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return _action(svc.approve)(post_id, db, admin, body.revision_hash)


@router.post("/{post_id}/reject")
def reject(post_id: int, body: RejectIn, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return _action(svc.reject)(post_id, db, admin, body.reason)


@router.post("/{post_id}/draft")
def draft(post_id: int, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return _action(svc.to_draft)(post_id, db, admin)


@router.post("/{post_id}/publish")
def publish(post_id: int, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return _action(svc.publish)(post_id, db, admin)


@router.post("/{post_id}/schedule")
def schedule(post_id: int, body: ScheduleIn, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return _action(svc.schedule)(post_id, db, admin, body.publish_at)


@router.post("/{post_id}/unschedule")
def unschedule(post_id: int, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return _action(svc.unschedule)(post_id, db, admin)


@router.delete("/{post_id}", status_code=204)
def delete(post_id: int, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    post = _get(db, post_id)
    if post.state not in ("draft", "rejected"):
        raise HTTPException(409, "Only drafts and rejected posts can be deleted. Unpublish or reject it first.")
    db.delete(post)
    audit(db, admin, "delete", "blog_post", post_id)
    db.commit()


@router.post("/actions/publish-due")
def publish_due(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    ids = svc.publish_due(db)
    audit(db, admin, "publish_due", "blog_post", detail=",".join(map(str, ids)))
    db.commit()
    return {"published": ids}
