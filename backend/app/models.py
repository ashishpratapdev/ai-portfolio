from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

STATUSES = ("draft", "published", "archived")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ContentMixin:
    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AdminUser(Base):
    __tablename__ = "admin_users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MediaAsset(Base):
    __tablename__ = "media_assets"
    id: Mapped[int] = mapped_column(primary_key=True)
    original_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(64), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    alt_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Profile(ContentMixin, Base):
    __tablename__ = "profile"
    full_name: Mapped[str] = mapped_column(String(120))
    headline: Mapped[str] = mapped_column(String(200))
    bio: Mapped[str] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(120), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    social_links: Mapped[list] = mapped_column(JSON, default=list)
    photo_media_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True)


class Skill(ContentMixin, Base):
    __tablename__ = "skills"
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(80))
    level: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Experience(ContentMixin, Base):
    __tablename__ = "experiences"
    company: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(120))
    location: Mapped[str | None] = mapped_column(String(120), nullable=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(Text)


class Project(ContentMixin, Base):
    __tablename__ = "projects"
    title: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    summary: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    tech: Mapped[list] = mapped_column(JSON, default=list)
    repo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    live_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_media_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True)


class Service(ContentMixin, Base):
    __tablename__ = "services"
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    price_note: Mapped[str | None] = mapped_column(String(120), nullable=True)


class SiteSetting(Base):
    __tablename__ = "site_settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(500), default="")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    entity: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    detail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ======================= Phase 2: blog, redirects, inquiries =======================
from sqlalchemy import Column, Float, Table  # noqa: E402
from sqlalchemy.orm import relationship  # noqa: E402

post_tags = Table(
    "post_tags", Base.metadata,
    Column("post_id", ForeignKey("blog_posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)
post_categories = Table(
    "post_categories", Base.metadata,
    Column("post_id", ForeignKey("blog_posts.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)


class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)


POST_STATES = ("draft", "in_review", "approved", "scheduled", "published", "rejected")


class BlogPost(Base):
    __tablename__ = "blog_posts"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    excerpt: Mapped[str] = mapped_column(String(400))
    body: Mapped[str] = mapped_column(Text)
    cover_media_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True)
    cover_alt: Mapped[str | None] = mapped_column(String(300), nullable=True)
    author_name: Mapped[str] = mapped_column(String(120))
    source_refs: Mapped[list] = mapped_column(JSON, default=list)
    seo_title: Mapped[str | None] = mapped_column(String(70), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(170), nullable=True)
    canonical_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    noindex: Mapped[bool] = mapped_column(Boolean, default=False)
    state: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approved_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    quality_warnings: Mapped[list] = mapped_column(JSON, default=list)
    source_topic_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    categories = relationship("Category", secondary=post_categories, lazy="selectin")
    tags = relationship("Tag", secondary=post_tags, lazy="selectin")


class PostRevision(Base):
    __tablename__ = "post_revisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("blog_posts.id", ondelete="CASCADE"), index=True)
    revision_no: Mapped[int] = mapped_column(Integer)
    content_hash: Mapped[str] = mapped_column(String(64))
    snapshot: Mapped[dict] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(16))  # "admin" | "ai"
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Redirect(Base):
    __tablename__ = "redirects"
    id: Mapped[int] = mapped_column(primary_key=True)
    from_path: Mapped[str] = mapped_column(String(300), unique=True)
    to_path: Mapped[str] = mapped_column(String(300))
    status_code: Mapped[int] = mapped_column(Integer, default=301)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Inquiry(Base):
    __tablename__ = "inquiries"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254))
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="new", index=True)
    ip_hash: Mapped[str] = mapped_column(String(64), index=True)  # salted hash, raw IP is never stored
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ======================= Phase 3: AI pipeline =======================
class AIConfig(Base):
    __tablename__ = "ai_config"
    id: Mapped[int] = mapped_column(primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    frequency: Mapped[str] = mapped_column(String(16), default="manual")  # manual | daily | weekly
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    tone: Mapped[str] = mapped_column(String(120), default="clear, practical, friendly")
    categories: Mapped[list] = mapped_column(JSON, default=list)  # also used as relevance keywords
    feeds: Mapped[list] = mapped_column(JSON, default=list)
    allowed_domains: Mapped[list] = mapped_column(JSON, default=list)
    max_topics_per_run: Mapped[int] = mapped_column(Integer, default=5)
    daily_job_budget: Mapped[int] = mapped_column(Integer, default=10)
    monthly_token_budget: Mapped[int] = mapped_column(Integer, default=500000)
    stale_days: Mapped[int] = mapped_column(Integer, default=365)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    # discovered | researching | drafted | rejected | failed | duplicate
    status: Mapped[str] = mapped_column(String(16), default="discovered", index=True)
    dedupe_key: Mapped[str] = mapped_column(String(64), unique=True)
    reject_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    post_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    regen_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Source(Base):
    __tablename__ = "sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(1000))
    title: Mapped[str] = mapped_column(String(300))
    domain: Mapped[str] = mapped_column(String(255))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    excerpt: Mapped[str] = mapped_column(Text)  # UNTRUSTED text, short excerpt only
    content_hash: Mapped[str] = mapped_column(String(64))


class AIJob(Base):
    __tablename__ = "ai_jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(16))  # discover | draft
    topic_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    post_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    state: Mapped[str] = mapped_column(String(16), default="queued", index=True)  # queued|running|succeeded|failed|cancelled
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    run_after: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    idempotency_key: Mapped[str] = mapped_column(String(120), unique=True)
    error: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    cost_estimate: Mapped[float] = mapped_column(Float, default=0.0)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    log: Mapped[list] = mapped_column(JSON, default=list)


# ======================= Phase 4: job hunt =======================
from sqlalchemy import UniqueConstraint  # noqa: E402


class JobSearchConfig(Base):
    __tablename__ = "job_search_config"
    id: Mapped[int] = mapped_column(primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)  # master switch: OFF = nothing is ever fetched
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    exclude_keywords: Mapped[list] = mapped_column(JSON, default=list)
    locations: Mapped[list] = mapped_column(JSON, default=list)
    remote_only: Mapped[bool] = mapped_column(Boolean, default=False)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    min_fit_score: Mapped[int] = mapped_column(Integer, default=35)
    max_new_per_run: Mapped[int] = mapped_column(Integer, default=40)
    interval_hours: Mapped[int] = mapped_column(Integer, default=12)
    my_years: Mapped[int] = mapped_column(Integer, default=2)
    max_preps_per_day: Mapped[int] = mapped_column(Integer, default=20)
    company_boards: Mapped[list | None] = mapped_column(JSON, nullable=True)       # ["greenhouse:stripe", "lever:spotify", ...]
    apply_goal: Mapped[int | None] = mapped_column(Integer, nullable=True)          # monthly application goal
    resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)            # the owner's own resume text (private)
    resume_skills: Mapped[list | None] = mapped_column(JSON, nullable=True)
    resume_titles: Mapped[list | None] = mapped_column(JSON, nullable=True)
    resume_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resume_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class JobListing(Base):
    __tablename__ = "job_listings"
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_job_source_external"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(20))
    external_id: Mapped[str] = mapped_column(String(120))
    dedupe_key: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(300))
    company: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200), default="")
    remote: Mapped[bool] = mapped_column(Boolean, default=True)
    url: Mapped[str] = mapped_column(String(1000))          # the source's own listing page (always the primary link)
    apply_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    description: Mapped[str] = mapped_column(Text)          # UNTRUSTED plain text, truncated
    tags: Mapped[list] = mapped_column(JSON, default=list)
    salary_text: Mapped[str | None] = mapped_column(String(120), nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    fit_score: Mapped[int] = mapped_column(Integer, default=0, index=True)
    fit_reasons: Mapped[dict] = mapped_column(JSON, default=dict)
    # new | saved | ready | applied | interview | offer | rejected | dismissed
    status: Mapped[str] = mapped_column(String(16), default="new", index=True)
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    highlights: Mapped[list] = mapped_column(JSON, default=list)
    prep_warnings: Mapped[list] = mapped_column(JSON, default=list)
    prepared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    prep_tokens: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class JobSearchRun(Base):
    __tablename__ = "job_search_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trigger: Mapped[str] = mapped_column(String(16))  # manual | scheduled
    status: Mapped[str] = mapped_column(String(16), default="running")  # running | ok | partial | failed
    new_count: Mapped[int] = mapped_column(Integer, default=0)
    seen_count: Mapped[int] = mapped_column(Integer, default=0)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
