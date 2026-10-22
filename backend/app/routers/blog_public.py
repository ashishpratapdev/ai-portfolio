import math
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BlogPost, Category, Project, Redirect, Tag, post_categories, post_tags, utcnow
from ..schemas_blog import PostPage, PublicPost, PublicPostSummary
from ..services.blog import post_to_dict

router = APIRouter(prefix="/public", tags=["public"])

STATIC_PATHS = ["/", "/about", "/experience", "/projects", "/services", "/resume", "/contact", "/blog"]


def _live():
    """The ONLY definition of 'publicly visible post'. Every public query goes through it."""
    return and_(BlogPost.state == "published", BlogPost.published_at <= utcnow())


@router.get("/blog", response_model=PostPage)
def list_posts(page: int = Query(1, ge=1, le=10_000), page_size: int = Query(10, ge=1, le=50),
               category: Optional[str] = Query(None, max_length=80), tag: Optional[str] = Query(None, max_length=80),
               q: Optional[str] = Query(None, max_length=100), db: Session = Depends(get_db)):
    where = [_live()]
    if category:
        where.append(BlogPost.id.in_(select(post_categories.c.post_id).join(Category, Category.id == post_categories.c.category_id).where(Category.slug == category)))
    if tag:
        where.append(BlogPost.id.in_(select(post_tags.c.post_id).join(Tag, Tag.id == post_tags.c.tag_id).where(Tag.slug == tag)))
    if q:
        where.append(or_(BlogPost.title.icontains(q, autoescape=True), BlogPost.excerpt.icontains(q, autoescape=True)))
    total = db.scalar(select(func.count()).select_from(BlogPost).where(*where)) or 0
    rows = db.scalars(select(BlogPost).where(*where).order_by(BlogPost.published_at.desc(), BlogPost.id.desc())
                      .limit(page_size).offset((page - 1) * page_size)).all()
    return {"items": [post_to_dict(p) for p in rows], "total": total, "page": page, "page_size": page_size,
            "pages": max(1, math.ceil(total / page_size))}


@router.get("/blog-filters")
def filters(db: Session = Depends(get_db)):
    live_ids = select(BlogPost.id).where(_live())
    cats = db.scalars(select(Category).where(Category.id.in_(select(post_categories.c.category_id).where(post_categories.c.post_id.in_(live_ids)))).order_by(Category.name)).all()
    tags = db.scalars(select(Tag).where(Tag.id.in_(select(post_tags.c.tag_id).where(post_tags.c.post_id.in_(live_ids)))).order_by(Tag.name)).all()
    return {"categories": [{"name": c.name, "slug": c.slug} for c in cats], "tags": [{"name": t.name, "slug": t.slug} for t in tags]}


@router.get("/blog/{slug}", response_model=PublicPost)
def read_post(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(BlogPost).where(BlogPost.slug == slug, _live()))
    if not p:
        raise HTTPException(404, "Post not found")
    d = post_to_dict(p)
    tag_ids = [t.id for t in p.tags]
    cat_ids = [c.id for c in p.categories]
    related: list[BlogPost] = []
    if tag_ids or cat_ids:
        cond = []
        if tag_ids:
            cond.append(BlogPost.id.in_(select(post_tags.c.post_id).where(post_tags.c.tag_id.in_(tag_ids))))
        if cat_ids:
            cond.append(BlogPost.id.in_(select(post_categories.c.post_id).where(post_categories.c.category_id.in_(cat_ids))))
        related = db.scalars(select(BlogPost).where(_live(), BlogPost.id != p.id, or_(*cond))
                             .order_by(BlogPost.published_at.desc()).limit(3)).all()
    d["related"] = [post_to_dict(r) for r in related]
    return d


@router.get("/sitemap")
def sitemap(db: Session = Depends(get_db)):
    """Only URLs that are public AND indexable. Drafts, scheduled, in-review and noindex posts never appear."""
    out = [{"path": p, "lastmod": None} for p in STATIC_PATHS]
    for pr in db.scalars(select(Project).where(Project.status == "published").order_by(Project.id)).all():
        out.append({"path": f"/projects/{pr.slug}", "lastmod": pr.updated_at})
    for p in db.scalars(select(BlogPost).where(_live(), BlogPost.noindex.is_(False)).order_by(BlogPost.published_at.desc())).all():
        out.append({"path": f"/blog/{p.slug}", "lastmod": p.updated_at})
    return out


@router.get("/redirect")
def redirect(path: str = Query(..., max_length=300), db: Session = Depends(get_db)):
    if not re.fullmatch(r"/[A-Za-z0-9._~/\-]*", path):
        raise HTTPException(404, "No redirect")
    r = db.scalar(select(Redirect).where(Redirect.from_path == path))
    if not r:
        raise HTTPException(404, "No redirect")
    return {"to_path": r.to_path, "status_code": r.status_code}
