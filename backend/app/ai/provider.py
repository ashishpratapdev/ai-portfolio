"""Provider abstraction. Credentials come from server-side env only and are never logged or returned."""
import json
import re
import urllib.error
import urllib.request
from abc import ABC, abstractmethod
from dataclasses import dataclass

from ..config import get_settings


class ProviderError(Exception):
    def __init__(self, message: str, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


@dataclass
class Usage:
    tokens_in: int = 0
    tokens_out: int = 0


def extract_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ProviderError("Model did not return a JSON object", retryable=True)
    try:
        data = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        raise ProviderError("Model returned malformed JSON", retryable=True)
    if not isinstance(data, dict):
        raise ProviderError("Model JSON was not an object", retryable=True)
    return data


class AIProvider(ABC):
    name = "base"

    @abstractmethod
    def complete_json(self, system: str, user: str, max_tokens: int = 4000) -> tuple[dict, Usage]: ...


class AnthropicProvider(AIProvider):
    name = "anthropic"
    URL = "https://api.anthropic.com/v1/messages"

    def complete_json(self, system, user, max_tokens=4000):
        s = get_settings()
        if not s.anthropic_api_key or not s.ai_model:
            raise ProviderError("ANTHROPIC_API_KEY and AI_MODEL must be set on the server", retryable=False)
        payload = {"model": s.ai_model, "max_tokens": max_tokens, "system": system,
                   "messages": [{"role": "user", "content": user}]}
        req = urllib.request.Request(self.URL, data=json.dumps(payload).encode(), method="POST", headers={
            "content-type": "application/json", "x-api-key": s.anthropic_api_key, "anthropic-version": "2023-06-01"})
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read(5_000_000))
        except urllib.error.HTTPError as e:  # never include headers/body: they could echo secrets
            raise ProviderError(f"Provider returned HTTP {e.code}", retryable=e.code in (408, 409, 429) or e.code >= 500)
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as e:
            raise ProviderError(f"Provider request failed ({type(e).__name__})", retryable=True)
        text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
        u = data.get("usage", {})
        return extract_json(text), Usage(int(u.get("input_tokens", 0)), int(u.get("output_tokens", 0)))


class MockProvider(AIProvider):
    """Offline provider for local development/tests. Output is deliberately marked so it is never mistaken for research."""
    name = "mock"

    def __init__(self, response: dict | None = None, fail_times: int = 0, retryable: bool = True):
        self.response, self.fail_times, self.retryable, self.calls = response, fail_times, retryable, 0

    def complete_json(self, system, user, max_tokens=4000):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise ProviderError("mock provider failure", retryable=self.retryable)
        if self.response is not None:
            return dict(self.response), Usage(len(user) // 4, 800)
        m = re.search(r"^TOPIC: (.+)$", user, re.M)
        topic = (m.group(1) if m else "Untitled topic")[:150]
        n_sources = len(re.findall(r'<source index="\d+"', user))
        para = "This paragraph is placeholder text from the mock provider and contains no real research. " * 8
        body = f"> **MOCK PROVIDER OUTPUT. Not real research. Do not publish.**\n\n## Overview\n\n{para}\n\n## Details\n\n{para}\n\n## Takeaways\n\n{para}\n"
        body = body + "\n".join(["Filler sentence for length."] * 60)
        return {
            "title": f"[MOCK] {topic}"[:200], "slug_suggestion": "", "excerpt": f"Mock summary of {topic}"[:400],
            "body_markdown": body, "seo_title": f"{topic}"[:70], "seo_description": f"Mock description for {topic}"[:170],
            "headings": ["Overview", "Details", "Takeaways"], "faqs": [{"question": "Is this real?", "answer": "No, it is mock output."}],
            "internal_links": [{"anchor": "My projects", "path": "/projects"}], "image_brief": "Abstract illustration (mock).",
            "claims": [{"text": "Mock claim", "source_indices": [1] if n_sources else []}], "uncertainty_notes": [],
        }, Usage(len(user) // 4, 800)


def build_provider(name: str | None = None) -> AIProvider:
    name = name or get_settings().ai_provider
    if name == "anthropic":
        return AnthropicProvider()
    if name == "mock":
        return MockProvider()
    raise ProviderError(f"Unknown AI_PROVIDER '{name}'", retryable=False)
