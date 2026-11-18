from typing import Annotated, Literal, Optional

from pydantic import Field, field_validator

from .schemas import Strict

Word = Annotated[str, Field(min_length=2, max_length=60)]
SourceName = Literal["remoteok", "jobicy", "arbeitnow", "adzuna"]


class JobConfigIn(Strict):  # note: no `enabled` here. The ON/OFF switch has its own explicit endpoint.
    keywords: list[Word] = Field(min_length=1, max_length=15)
    exclude_keywords: list[Word] = Field(default_factory=list, max_length=20)
    locations: list[Word] = Field(default_factory=list, max_length=10)
    remote_only: bool = False
    sources: list[SourceName] = Field(min_length=1, max_length=4)
    min_fit_score: int = Field(ge=0, le=100)
    max_new_per_run: int = Field(ge=5, le=100)
    interval_hours: int = Field(ge=6, le=168)
    my_years: int = Field(ge=0, le=40)
    max_preps_per_day: int = Field(ge=1, le=100)

    @field_validator("sources")
    @classmethod
    def _unique(cls, v):
        return list(dict.fromkeys(v))


class ToggleIn(Strict):
    enabled: bool


class JobPatch(Strict):
    status: Optional[Literal["new", "saved", "ready", "applied", "interview", "offer", "rejected", "dismissed"]] = None
    notes: Optional[str] = Field(None, max_length=5000)
    cover_letter: Optional[str] = Field(None, max_length=5000)
