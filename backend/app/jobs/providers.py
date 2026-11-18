"""Job sources. Only official, public, documented JSON APIs that allow programmatic access:
  RemoteOK  (remoteok.com/api)            no key; terms require a followed link back to the RemoteOK listing
  Jobicy    (jobicy.com/api/v2)           no key; low rate limit; apply links stay on Jobicy's page
  Arbeitnow (arbeitnow.com/api)           no key; mostly Europe
  Adzuna    (api.adzuna.com, India 'in')  free key (ADZUNA_APP_ID / ADZUNA_APP_KEY); covers local Indian jobs
Not used on purpose: LinkedIn, Naukri, Indeed (no public API; scraping/auto-apply breaks their terms) and Remotive/Himalayas
(their terms restrict passing listings to other boards/aggregators). The `url` of every job is the SOURCE's own listing page."""
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from ..ai.research import FetchError, strip_html

JOB_HOSTS = ["remoteok.com", "jobicy.com", "arbeitnow.com", "api.adzuna.com"]

SOURCE_INFO = {
    "remoteok": {"name": "RemoteOK", "home": "https://remoteok.com", "needs_key": False},
    "jobicy": {"name": "Jobicy", "home": "https://jobicy.com", "needs_key": False},
    "arbeitnow": {"name": "Arbeitnow", "home": "https://www.arbeitnow.com", "needs_key": False},
    "adzuna": {"name": "Adzuna (India)", "home": "https://www.adzuna.in", "needs_key": True},
}


class SourceUnavailable(Exception):
    """A source cannot run (for example, missing API keys). Reported per source, never fatal for the whole run."""


@dataclass
class RawJob:
    source: str
    external_id: str
    title: str
    company: str
    location: str
    remote: bool
    url: str
    apply_url: Optional[str] = None
    description: str = ""
    tags: list = field(default_factory=list)
    salary_text: Optional[str] = None
    posted_at: Optional[datetime] = None


def _http(u) -> Optional[str]:
    return u.strip() if isinstance(u, str) and re.match(r"^https?://\S+$", u.strip(), re.I) else None


def _dt(v) -> Optional[datetime]:
    if v in (None, "", 0):
        return None
    try:
        if isinstance(v, (int, float)) or (isinstance(v, str) and v.strip().isdigit()):
            return datetime.fromtimestamp(int(v), tz=timezone.utc)
        d = datetime.fromisoformat(str(v).strip().replace("Z", "+00:00").replace(" ", "T", 1) if " " in str(v) and "T" not in str(v) else str(v).strip().replace("Z", "+00:00"))
        return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)
    except (ValueError, OverflowError, OSError):
        return None


def _listify(v) -> list:
    if v is None or v == "":
        return []
    return [str(x).strip() for x in (v if isinstance(v, list) else [v]) if str(x).strip()]


def _salary(lo, hi, cur="", period="") -> Optional[str]:
    try:
        lo, hi = int(lo or 0), int(hi or 0)
    except (TypeError, ValueError):
        return None
    if not lo and not hi:
        return None
    rng = f"{lo:,}-{hi:,}" if lo and hi and lo != hi else f"{(hi or lo):,}"
    return " ".join(x for x in (rng, cur, f"/{period}" if period else "") if x)[:120]


def parse_remoteok(data) -> list[RawJob]:
    out = []
    for j in data if isinstance(data, list) else []:
        if not isinstance(j, dict) or not j.get("position"):  # the first element is a legal notice, not a job
            continue
        ident = str(j.get("id") or j.get("slug") or "")
        if not ident:
            continue
        url = _http(j.get("url")) or (f"https://remoteok.com/remote-jobs/{j['slug']}" if j.get("slug") else f"https://remoteok.com/remote-jobs/{ident}")
        out.append(RawJob("remoteok", ident, str(j["position"])[:300], str(j.get("company") or "Unknown")[:200],
                          str(j.get("location") or "Worldwide")[:200], True, url, _http(j.get("apply_url")),
                          strip_html(j.get("description") or "", 8000), _listify(j.get("tags")),
                          _salary(j.get("salary_min"), j.get("salary_max"), "USD", "yr"), _dt(j.get("epoch") or j.get("date"))))
    return out


def parse_jobicy(data) -> list[RawJob]:
    out = []
    for j in (data or {}).get("jobs", []) if isinstance(data, dict) else []:
        url = _http(j.get("url"))
        if not url or not j.get("jobTitle") or j.get("id") is None:
            continue
        geo = ", ".join(_listify(j.get("jobGeo"))) or "Anywhere"
        out.append(RawJob("jobicy", str(j["id"]), str(j["jobTitle"])[:300], str(j.get("companyName") or "Unknown")[:200], geo[:200], True, url, None,
                          strip_html(j.get("jobDescription") or j.get("jobExcerpt") or "", 8000), _listify(j.get("jobIndustry")) + _listify(j.get("jobType")),
                          _salary(j.get("salaryMin"), j.get("salaryMax"), j.get("salaryCurrency") or "", j.get("salaryPeriod") or ""), _dt(j.get("pubDate"))))
    return out


def parse_arbeitnow(data) -> list[RawJob]:
    out = []
    for j in (data or {}).get("data", []) if isinstance(data, dict) else []:
        url = _http(j.get("url"))
        if not url or not j.get("title") or not j.get("slug"):
            continue
        out.append(RawJob("arbeitnow", str(j["slug"])[:120], str(j["title"])[:300], str(j.get("company_name") or "Unknown")[:200],
                          str(j.get("location") or "")[:200], bool(j.get("remote")), url, None, strip_html(j.get("description") or "", 8000),
                          _listify(j.get("tags")) + _listify(j.get("job_types")), None, _dt(j.get("created_at"))))
    return out


def parse_adzuna(data, country: str = "in") -> list[RawJob]:
    cur = {"in": "INR", "gb": "GBP", "us": "USD"}.get(country, "")
    out = []
    for j in (data or {}).get("results", []) if isinstance(data, dict) else []:
        url = _http(j.get("redirect_url"))
        if not url or j.get("id") is None or not j.get("title"):
            continue
        loc = str((j.get("location") or {}).get("display_name") or "")
        blob = f"{j['title']} {loc} {j.get('description', '')}".lower()
        out.append(RawJob("adzuna", str(j["id"]), strip_html(str(j["title"]), 300), str((j.get("company") or {}).get("display_name") or "Unknown")[:200],
                          loc[:200], "remote" in blob or "work from home" in blob, url, None, strip_html(j.get("description") or "", 8000),
                          _listify((j.get("category") or {}).get("label")), _salary(j.get("salary_min"), j.get("salary_max"), cur, "yr"), _dt(j.get("created"))))
    return out


# ------------------------------ fetchers: (fetcher, cfg, settings) -> list[RawJob] ------------------------------
def _terms(cfg, n=2):
    return [k.strip() for k in (cfg.keywords or []) if len(k.strip()) >= 3][:n]


def fetch_remoteok(f, cfg, s):
    return parse_remoteok(f.get_json("https://remoteok.com/api"))


def fetch_jobicy(f, cfg, s):
    jobs = []
    for kw in _terms(cfg) or [None]:  # Jobicy asks for a low request rate: at most 2 calls
        jobs += parse_jobicy(f.get_json("https://jobicy.com/api/v2/remote-jobs?count=50" + (f"&tag={quote(kw)}" if kw else "")))
    return jobs


def fetch_arbeitnow(f, cfg, s):
    return parse_arbeitnow(f.get_json("https://www.arbeitnow.com/api/job-board-api"))


def fetch_adzuna(f, cfg, s):
    if not (s.adzuna_app_id and s.adzuna_app_key):
        raise SourceUnavailable("Adzuna needs ADZUNA_APP_ID and ADZUNA_APP_KEY on the server (free at developer.adzuna.com)")
    where = next((l for l in (cfg.locations or []) if l.strip().lower() != "remote"), "")
    jobs = []
    for kw in _terms(cfg) or [None]:
        q = f"app_id={quote(s.adzuna_app_id)}&app_key={quote(s.adzuna_app_key)}&results_per_page=50&content-type=application/json"
        q += (f"&what={quote(kw)}" if kw else "") + (f"&where={quote(where)}" if where else "")
        jobs += parse_adzuna(f.get_json(f"https://api.adzuna.com/v1/api/jobs/in/search/1?{q}"), "in")
    return jobs


FETCHERS = {"remoteok": fetch_remoteok, "jobicy": fetch_jobicy, "arbeitnow": fetch_arbeitnow, "adzuna": fetch_adzuna}
