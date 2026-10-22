"""Deterministic quality checks on AI drafts. No model calls: these flag problems for the human reviewer."""
import re
from datetime import datetime, timedelta, timezone

from .research import similar

DUPLICATE_THRESHOLD = 0.85
INJECTION_RE = re.compile(
    r"(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions|prompts?|rules)"
    r"|you\s+are\s+now\b|\bsystem\s+prompt\b|reveal\s+your\s+(prompt|instructions)", re.I)
FIRST_PERSON_RE = re.compile(
    r"\b(I|we)\s+(have\s+)?(built|launched|led|worked|delivered|founded|shipped|managed|helped)\b"
    r"|\bmy\s+(clients?|customers?|company|team|employer|experience|projects?)\b"
    r"|\bin\s+my\s+(\w+\s+)?(career|experience|work)\b", re.I)
URL_RE = re.compile(r"https?://[^\s)\]>\"']+")


def _w(code: str, severity: str, message: str) -> dict:
    return {"code": code, "severity": severity, "message": message}


def _norm_url(u: str) -> str:
    return u.rstrip("/.,;").lower()


def injection_in(text: str) -> bool:
    return bool(INJECTION_RE.search(text or ""))


def check_draft(draft: dict, sources: list[dict], existing_titles: list[str], stale_days: int, now: datetime) -> list[dict]:
    out: list[dict] = []
    body = draft.get("body_markdown", "")
    if not sources:
        out.append(_w("missing_evidence", "high", "No sources were retrieved for this topic. Do not publish without adding evidence."))
    for i, s in enumerate(sources, 1):
        pub = s.get("published_at")
        if pub is not None:
            pub = pub if pub.tzinfo else pub.replace(tzinfo=timezone.utc)
            if now - pub > timedelta(days=stale_days):
                out.append(_w("stale_source", "medium", f"Source [{i}] is older than {stale_days} days; facts may be outdated."))
        else:
            out.append(_w("undated_source", "low", f"Source [{i}] has no publication date."))
        if injection_in(s.get("excerpt", "")) or injection_in(s.get("title", "")):
            out.append(_w("possible_prompt_injection", "high", f"Source [{i}] contains text that looks like instructions to an AI. It was treated as data only; inspect it."))
    claims = draft.get("claims") or []
    if not claims:
        out.append(_w("no_claims_listed", "medium", "The draft listed no cited claims; every factual statement needs manual verification."))
    for c in claims:
        idx = c.get("source_indices") or []
        if not idx:
            out.append(_w("unsupported_claim", "high", f"Claim without a source: \"{c.get('text', '')[:140]}\""))
        elif any(not isinstance(n, int) or n < 1 or n > len(sources) for n in idx):
            out.append(_w("invalid_citation", "high", f"Claim cites a source that does not exist: \"{c.get('text', '')[:140]}\""))
    for note in draft.get("uncertainty_notes") or []:
        out.append(_w("model_uncertainty", "medium", str(note)[:300]))
    allowed = {_norm_url(s["url"]) for s in sources}
    for u in dict.fromkeys(URL_RE.findall(body)):
        if _norm_url(u) not in allowed:
            out.append(_w("unlisted_link", "medium", f"Body links to a URL that is not one of the retrieved sources: {u[:120]}"))
    if FIRST_PERSON_RE.search(body):
        out.append(_w("unverified_first_person_claim", "high", "The draft makes first-person experience claims. The AI has no verified experience data beyond the profile; verify or rewrite."))
    if re.search(r"<\s*(script|iframe|object|embed)\b", body, re.I):
        out.append(_w("html_in_body", "high", "The body contains raw HTML tags that look unsafe."))
    words = len(re.findall(r"\w+", body))
    if words < 400:
        out.append(_w("thin_content", "medium", f"Only {words} words; this may be too thin to be useful."))
    title = draft.get("title", "")
    for t in existing_titles:
        if similar(title, t) >= DUPLICATE_THRESHOLD:
            out.append(_w("duplicate_topic", "high", f"Very similar to existing content: \"{t[:120]}\""))
            break
    return out


def has_blocking(warnings: list[dict]) -> bool:
    return any(w["severity"] == "high" for w in warnings)
