from pydantic import BaseModel, Field


class Claim(BaseModel):
    text: str = Field(max_length=500)
    source_indices: list[int] = Field(default_factory=list)


class Faq(BaseModel):
    question: str = Field(max_length=300)
    answer: str = Field(max_length=1000)


class InternalLink(BaseModel):
    anchor: str = Field(max_length=100)
    path: str = Field(max_length=200)


class ArticleDraft(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug_suggestion: str = Field(default="", max_length=120)
    excerpt: str = Field(min_length=1, max_length=400)
    body_markdown: str = Field(min_length=1, max_length=60_000)
    seo_title: str = Field(default="", max_length=70)
    seo_description: str = Field(default="", max_length=170)
    headings: list[str] = Field(default_factory=list, max_length=40)
    faqs: list[Faq] = Field(default_factory=list, max_length=10)
    internal_links: list[InternalLink] = Field(default_factory=list, max_length=10)
    image_brief: str = Field(default="", max_length=600)
    claims: list[Claim] = Field(default_factory=list, max_length=60)
    uncertainty_notes: list[str] = Field(default_factory=list, max_length=20)


DRAFT_SCHEMA_HINT = """{
  "title": str (<=200), "slug_suggestion": str, "excerpt": str (<=400),
  "body_markdown": str (markdown; ## headings; no raw HTML),
  "seo_title": str (<=70), "seo_description": str (<=170),
  "headings": [str], "faqs": [{"question": str, "answer": str}],
  "internal_links": [{"anchor": str, "path": str}],
  "image_brief": str,
  "claims": [{"text": str, "source_indices": [int, ...]}],   // every factual claim, cited by source index
  "uncertainty_notes": [str]                                 // anything not fully supported by the sources
}"""
