import re
from datetime import date, datetime
from typing import Annotated, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _http_url(v: str) -> str:
    v = v.strip()
    if not re.match(r"^https?://[^\s]+$", v, re.I):
        raise ValueError("URL must start with http:// or https://")
    return v


def _email(v: str) -> str:
    v = v.strip()
    if not EMAIL_RE.match(v):
        raise ValueError("Invalid email address")
    return v.lower()


SafeUrl = Annotated[str, Field(max_length=500), AfterValidator(_http_url)]
Email = Annotated[str, Field(max_length=254), AfterValidator(_email)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Out(BaseModel):
    """Mixin for response schemas."""
    model_config = ConfigDict(from_attributes=True, extra="ignore")
    id: int
    status: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


# ---- auth
class LoginIn(Strict):
    email: Email
    password: str = Field(min_length=1, max_length=200)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str


# ---- content
class SocialLink(Strict):
    label: str = Field(min_length=1, max_length=40)
    url: SafeUrl


class ProfileIn(Strict):
    full_name: str = Field(min_length=1, max_length=120)
    headline: str = Field(min_length=1, max_length=200)
    bio: str = Field(min_length=1, max_length=5000)
    location: Optional[str] = Field(None, max_length=120)
    contact_email: Optional[Email] = None
    social_links: list[SocialLink] = Field(default_factory=list, max_length=12)
    photo_media_id: Optional[int] = None


class ProfileOut(ProfileIn, Out):
    model_config = ConfigDict(from_attributes=True, extra="ignore")


class SkillIn(Strict):
    name: str = Field(min_length=1, max_length=80)
    category: str = Field("General", min_length=1, max_length=80)
    level: Optional[int] = Field(None, ge=1, le=5)


class SkillOut(SkillIn, Out):
    model_config = ConfigDict(from_attributes=True, extra="ignore")


class ExperienceIn(Strict):
    company: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=120)
    location: Optional[str] = Field(None, max_length=120)
    start_date: date
    end_date: Optional[date] = None
    description: str = Field(min_length=1, max_length=5000)

    @model_validator(mode="after")
    def _dates(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class ExperienceOut(ExperienceIn, Out):
    model_config = ConfigDict(from_attributes=True, extra="ignore")


class ProjectIn(Strict):
    title: str = Field(min_length=1, max_length=160)
    slug: Optional[str] = Field(None, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    summary: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1, max_length=20000)
    tech: list[Annotated[str, Field(min_length=1, max_length=40)]] = Field(default_factory=list, max_length=30)
    repo_url: Optional[SafeUrl] = None
    live_url: Optional[SafeUrl] = None
    cover_media_id: Optional[int] = None


class ProjectOut(ProjectIn, Out):
    model_config = ConfigDict(from_attributes=True, extra="ignore")
    slug: str


class ServiceIn(Strict):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=5000)
    price_note: Optional[str] = Field(None, max_length=120)


class ServiceOut(ServiceIn, Out):
    model_config = ConfigDict(from_attributes=True, extra="ignore")


class ReorderIn(Strict):
    ids: list[int] = Field(min_length=1, max_length=500)


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    original_name: str
    content_type: str
    size_bytes: int
    alt_text: Optional[str]
    is_public: bool
    created_at: datetime


class MediaPatch(Strict):
    alt_text: Optional[str] = Field(None, max_length=300)
    is_public: Optional[bool] = None


ALLOWED_SETTINGS = {"site_title", "tagline", "footer_text", "resume_media_id"}
