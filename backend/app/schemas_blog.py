from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .schemas import Email, SafeUrl, Strict


class SourceRef(Strict):
    title: str = Field(min_length=1, max_length=300)
    url: SafeUrl


Name = Annotated[str, Field(min_length=1, max_length=60)]


class PostIn(Strict):
    title: str = Field(min_length=1, max_length=200)
    slug: Optional[str] = Field(None, max_length=200, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    excerpt: str = Field(min_length=1, max_length=400)
    body: str = Field(min_length=1, max_length=100_000)
    cover_media_id: Optional[int] = None
    cover_alt: Optional[str] = Field(None, max_length=300)
    author_name: str = Field(min_length=1, max_length=120)
    categories: list[Name] = Field(default_factory=list, max_length=10)
    tags: list[Name] = Field(default_factory=list, max_length=20)
    source_refs: list[SourceRef] = Field(default_factory=list, max_length=50)
    seo_title: Optional[str] = Field(None, max_length=70)
    seo_description: Optional[str] = Field(None, max_length=170)
    canonical_url: Optional[SafeUrl] = None
    noindex: bool = False

    @model_validator(mode="after")
    def _alt_required(self):
        if self.cover_media_id and not (self.cover_alt or "").strip():
            raise ValueError("cover_alt is required when a cover image is set")
        return self


class ApproveIn(Strict):
    revision_hash: str = Field(min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$")


class RejectIn(Strict):
    reason: str = Field(min_length=1, max_length=500)


class ScheduleIn(Strict):
    publish_at: datetime

    @field_validator("publish_at")
    @classmethod
    def _tz(cls, v: datetime):
        if v.tzinfo is None:
            raise ValueError("publish_at must include a timezone offset, e.g. 2026-11-01T09:00:00+05:30")
        return v


class PublicPostSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str
    slug: str
    excerpt: str
    cover_media_id: Optional[int] = None
    cover_alt: Optional[str] = None
    author_name: str
    categories: list[str]
    tags: list[str]
    published_at: datetime


class PublicPost(PublicPostSummary):
    body: str
    source_refs: list[SourceRef]
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    canonical_url: Optional[str] = None
    noindex: bool = False
    updated_at: datetime
    related: list[PublicPostSummary] = []


class PostPage(BaseModel):
    items: list[PublicPostSummary]
    total: int
    page: int
    page_size: int
    pages: int


class ContactIn(Strict):
    name: str = Field(min_length=1, max_length=120)
    email: Email
    subject: Optional[str] = Field(None, max_length=200)
    message: str = Field(min_length=10, max_length=5000)
    website: Optional[str] = Field(None, max_length=200)  # honeypot: humans never see or fill this


INQUIRY_STATUSES = ("new", "read", "replied", "spam", "archived")


class InquiryPatch(Strict):
    status: str = Field(pattern="^(new|read|replied|spam|archived)$")


class InquiryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    subject: Optional[str]
    message: str
    status: str
    created_at: datetime


class RedirectIn(Strict):
    from_path: str = Field(min_length=2, max_length=300, pattern=r"^/[A-Za-z0-9._~/\-]*$")
    to_path: str = Field(min_length=1, max_length=300, pattern=r"^/[A-Za-z0-9._~/\-]*$")
    status_code: int = Field(301, ge=301, le=308)

    @model_validator(mode="after")
    def _no_loop(self):
        if self.from_path == self.to_path:
            raise ValueError("from_path and to_path must differ")
        if self.from_path.startswith("//") or self.to_path.startswith("//"):
            raise ValueError("Paths must be site-relative")
        return self


class RedirectOut(RedirectIn):
    model_config = ConfigDict(from_attributes=True, extra="ignore")
    id: int
