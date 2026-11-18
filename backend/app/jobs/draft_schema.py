from typing import Annotated

from pydantic import BaseModel, Field

Short = Annotated[str, Field(max_length=300)]


class ApplicationDraft(BaseModel):
    cover_letter: str = Field(min_length=40, max_length=5000)
    subject_line: str = Field(default="", max_length=200)
    resume_highlights: list[Short] = Field(default_factory=list, max_length=10)
    skills_to_emphasize: list[Short] = Field(default_factory=list, max_length=15)
    gaps: list[Short] = Field(default_factory=list, max_length=10)
