"""Blog business rules: hashing, revisions, approval, state machine, scheduled publishing.

Safety invariants (all enforced here, never in the UI):
  * Only `approve()` can set approval fields, and it needs an authenticated admin and the exact content hash.
  * Any content change on an approved/scheduled post wipes the approval. Published posts cannot be edited in place.
  * `publish()` / `publish_due()` re-validate that the approval still matches the current content.
  * Posts created by AI always start as `in_review`.
"""
import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..deps import audit
from ..models import AdminUser, BlogPost, Category, PostRevision, Redirect, Tag, utcnow

HASH_FIELDS = ("title", "slug", "excerpt", "body", "cover_media_id", "cover_alt", "author_name",
               "seo_title", "seo_description", "canonical_url", "noindex", "source_refs")
SCALAR_FIELDS = tuple(f for f in HASH_FIELDS if f != "slug")

TRANSITIONS = {
    "draft": {"in_review"},
    "in_review": {"draft", "approved", "rejected"},
    "approved": {"draft", "scheduled", "published", "rejected"},
    "scheduled": {"draft", "approved", "published"},
    "published": {"draft"},
    "rejected": {"draft"},
}


class BlogError(Exception):
    def __init__(self, message: str, status: int = 409):
        super().__init__(message)
        self.message, self.status = message, status


def as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def slugify(text: str, fallback: str = "post") -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:120] or fallback


def content_snapshot(post: BlogPost) -> dict:
    snap = {f: getattr(post, f) for f in HASH_FIELDS}
    snap["categories"] = sorted(c.name for c in post.categories)
    snap["tags"] = sorted(t.name for t in post.tags)
    return snap


def content_hash(post: BlogPost) -> str:
    raw = json.dumps(content_snapshot(post), sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def unique_slug(db: Session, base: str, exclude_id: Optional[int]) -> str:
    slug, n = base, 2
    while True:
        found = db.scalar(select(BlogPost.id).where(BlogPost.slug == slug))
        if found is None or found == exclude_id:
            return slug
        slug, n = f"{base}-{n}", n + 1


def _get_or_create(db: Session, Model, name: str):
    name = name.strip()
    obj = db.scalar(select(Model).where(Model.name == name))
    if obj:
        return obj
    base, n = slugify(name, "item"), 2
    slug = base
    while db.scalar(select(Model.id).where(Model.slug == slug)) is not None:
        slug, n = f"{base}-{n}", n + 1
    obj = Model(name=name, slug=slug)
    db.add(obj)
    db.flush()
    return obj


def record_revision(db: Session, post: BlogPost, source: str, admin_id: Optional[int]) -> None:
    h = content_hash(post)
    last = db.scalar(select(PostRevision).where(PostRevision.post_id == post.id).order_by(PostRevision.revision_no.desc()).limit(1))
    if last and last.content_hash == h:
        return
    db.add(PostRevision(post_id=post.id, revision_no=(last.revision_no + 1) if last else 1, content_hash=h,
                        snapshot=json.loads(json.dumps(content_snapshot(post), default=str)), source=source, created_by=admin_id))


def _clear_approval(post: BlogPost) -> None:
    post.approved_hash = post.approved_by = post.approved_at = None
    post.scheduled_at = None


def apply_content(db: Session, post: BlogPost, data: dict, admin_id: Optional[int], source: str = "admin") -> bool:
    """Apply content fields. Returns True if an existing approval was invalidated."""
    if post.state == "published":
        raise BlogError("Unpublish this post before editing it.")
    old_slug = post.slug
    for f in SCALAR_FIELDS:
        if f in data:
            setattr(post, f, data[f])
    if "slug" in data or not post.slug:
        post.slug = unique_slug(db, data.get("slug") or post.slug or slugify(post.title), post.id)
    if "categories" in data:
        post.categories = [_get_or_create(db, Category, n) for n in dict.fromkeys(data["categories"])]
    if "tags" in data:
        post.tags = [_get_or_create(db, Tag, n) for n in dict.fromkeys(data["tags"])]
    db.flush()
    if post.published_at and old_slug and old_slug != post.slug:
        db.query(Redirect).filter(Redirect.from_path == f"/blog/{post.slug}").delete()
        if not db.scalar(select(Redirect.id).where(Redirect.from_path == f"/blog/{old_slug}")):
            db.add(Redirect(from_path=f"/blog/{old_slug}", to_path=f"/blog/{post.slug}", status_code=301))
    invalidated = False
    if post.state in ("approved", "scheduled") and post.approved_hash != content_hash(post):
        post.state = "draft"
        _clear_approval(post)
        invalidated = True
    record_revision(db, post, source, admin_id)
    return invalidated


def create_post(db: Session, data: dict, admin: Optional[AdminUser], *, ai: bool = False,
                quality_warnings: Optional[list] = None, source_topic_id: Optional[int] = None) -> BlogPost:
    """Create a post. State is NOT a parameter: humans start in draft, AI always starts in review."""
    post = BlogPost(title=data["title"], slug="", excerpt=data["excerpt"], body=data["body"], author_name=data["author_name"],
                    source_refs=[], state="in_review" if ai else "draft", is_ai_generated=ai,
                    quality_warnings=quality_warnings or [], source_topic_id=source_topic_id)
    db.add(post)
    apply_content(db, post, data, admin.id if admin else None, "ai" if ai else "admin")
    audit(db, admin, "ai_create" if ai else "create", "blog_post", post.id)
    return post


def _require(post: BlogPost, new_state: str, action: str) -> None:
    if new_state not in TRANSITIONS.get(post.state, set()):
        raise BlogError(f"Cannot {action}: a post that is '{post.state}' cannot move to '{new_state}'.")


def approval_valid(post: BlogPost) -> bool:
    return bool(post.approved_hash and post.approved_by is not None and post.approved_hash == content_hash(post))


def request_review(db: Session, post: BlogPost, admin: AdminUser) -> None:
    _require(post, "in_review", "request review")
    post.state = "in_review"
    audit(db, admin, "request_review", "blog_post", post.id)


def approve(db: Session, post: BlogPost, admin: AdminUser, revision_hash: str) -> None:
    _require(post, "approved", "approve")
    if revision_hash != content_hash(post):
        raise BlogError("The post changed after you opened it. Reload and review the latest version before approving.")
    post.state, post.approved_hash, post.approved_by, post.approved_at = "approved", revision_hash, admin.id, utcnow()
    audit(db, admin, "approve", "blog_post", post.id, f"hash={revision_hash[:12]}")


def reject(db: Session, post: BlogPost, admin: AdminUser, reason: str) -> None:
    _require(post, "rejected", "reject")
    post.state, post.rejection_reason = "rejected", reason[:500]
    _clear_approval(post)
    audit(db, admin, "reject", "blog_post", post.id, reason)


def to_draft(db: Session, post: BlogPost, admin: AdminUser) -> None:
    _require(post, "draft", "return to draft")
    post.state = "draft"
    _clear_approval(post)
    audit(db, admin, "to_draft", "blog_post", post.id)


def publish(db: Session, post: BlogPost, admin: AdminUser) -> None:
    _require(post, "published", "publish")
    if not approval_valid(post):
        raise BlogError("Approval is missing or no longer matches the current content. Approve this exact revision first.")
    post.state, post.scheduled_at = "published", None
    post.published_at = post.published_at or utcnow()
    audit(db, admin, "publish", "blog_post", post.id, f"hash={post.approved_hash[:12]}")


def schedule(db: Session, post: BlogPost, admin: AdminUser, when: datetime) -> None:
    _require(post, "scheduled", "schedule")
    if not approval_valid(post):
        raise BlogError("Approval is missing or no longer matches the current content. Approve this exact revision first.")
    when = as_utc(when)
    if when <= utcnow():
        raise BlogError("Scheduled time must be in the future.", 422)
    post.state, post.scheduled_at = "scheduled", when
    audit(db, admin, "schedule", "blog_post", post.id, when.isoformat())


def unschedule(db: Session, post: BlogPost, admin: AdminUser) -> None:
    if post.state != "scheduled":
        raise BlogError("Only scheduled posts can be unscheduled.")
    post.state, post.scheduled_at = "approved", None
    audit(db, admin, "unschedule", "blog_post", post.id)


def publish_due(db: Session, now: Optional[datetime] = None) -> list[int]:
    """Publish scheduled posts whose time has come. Idempotent and safe to run concurrently:
    the UPDATE only succeeds while the row is still 'scheduled' with the approved hash."""
    now = now or utcnow()
    published: list[int] = []
    for post in db.scalars(select(BlogPost).where(BlogPost.state == "scheduled")).all():
        due = as_utc(post.scheduled_at)
        if due is None or due > now:
            continue
        if not approval_valid(post):
            post.state = "draft"
            _clear_approval(post)
            audit(db, None, "publish_blocked", "blog_post", post.id, "approval no longer valid")
            db.commit()
            continue
        res = db.execute(update(BlogPost).where(BlogPost.id == post.id, BlogPost.state == "scheduled",
                                                BlogPost.approved_hash == post.approved_hash)
                         .values(state="published", published_at=post.published_at or now, scheduled_at=None))
        if res.rowcount == 1:
            audit(db, None, "publish_scheduled", "blog_post", post.id, f"hash={post.approved_hash[:12]}")
            published.append(post.id)
        db.commit()
    return published


def post_to_dict(post: BlogPost, admin: bool = False) -> dict:
    d = {f: getattr(post, f) for f in ("id", "title", "slug", "excerpt", "body", "cover_media_id", "cover_alt", "author_name",
                                        "source_refs", "seo_title", "seo_description", "canonical_url", "noindex",
                                        "published_at", "updated_at")}
    d["categories"] = sorted(c.name for c in post.categories)
    d["tags"] = sorted(t.name for t in post.tags)
    if admin:
        for f in ("state", "scheduled_at", "approved_by", "approved_at", "approved_hash", "rejection_reason", "is_ai_generated",
                  "quality_warnings", "created_at", "source_topic_id"):
            d[f] = getattr(post, f)
        d["content_hash"] = content_hash(post)
        d["approval_valid"] = approval_valid(post)
    return d
