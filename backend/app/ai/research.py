"""Research layer: RSS/Atom discovery from an allow-list of domains. All retrieved text is UNTRUSTED data.

Safety: http(s) only, ports 80/443 only, every hop must be on an approved domain and resolve to public IPs
(basic SSRF guard), responses capped at 1 MB, XML parsed with defusedxml, robots.txt honoured for page fetches,
only short excerpts are stored (no full-text copying), and nothing here ever executes retrieved content.
"""
import hashlib
import html
import ipaddress
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime
from typing import Optional
from urllib import robotparser

from defusedxml import ElementTree as ET

USER_AGENT = "PortfolioResearchBot/1.0 (owner-run; honours robots.txt)"
MAX_BYTES = 1_000_000
EXCERPT_CHARS = 1500


class FetchError(Exception):
    pass


@dataclass
class FeedItem:
    title: str
    link: str
    summary: str
    published: Optional[datetime]


def host_of(url: str) -> str:
    return (urllib.parse.urlparse(url).hostname or "").lower()


def domain_allowed(url_or_host: str, allowed: list[str]) -> bool:
    host = host_of(url_or_host) if "://" in url_or_host else url_or_host.lower()
    return bool(host) and any(host == d.lower() or host.endswith("." + d.lower()) for d in allowed if d)


def normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", "", title.lower()).strip()


def dedupe_key(title: str) -> str:
    return hashlib.sha256(re.sub(r"\s+", " ", normalize_title(title)).encode()).hexdigest()


def similar(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize_title(a), normalize_title(b)).ratio()


def strip_html(text: str, limit: int = EXCERPT_CHARS) -> str:
    text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", text or "")
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()[:limit]


def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    s = s.strip()
    for parser in (parsedate_to_datetime, lambda v: datetime.fromisoformat(v.replace("Z", "+00:00"))):
        try:
            dt = parser(s)
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        except (TypeError, ValueError):
            continue
    return None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower() if isinstance(tag, str) else ""


def _child_text(el, *names) -> str:
    for c in el:
        if _local(c.tag) in names and (c.text or "").strip():
            return c.text.strip()
    return ""


def parse_feed(xml_bytes: bytes, max_items: int = 50) -> list[FeedItem]:
    try:
        root = ET.fromstring(xml_bytes)
    except Exception as e:  # malformed XML, entity expansion attempts etc.
        raise FetchError(f"Feed could not be parsed ({type(e).__name__})")
    items: list[FeedItem] = []
    for el in root.iter():
        kind = _local(el.tag)
        if kind not in ("item", "entry"):
            continue
        link = ""
        if kind == "item":
            link = _child_text(el, "link")
        else:
            for c in el:
                if _local(c.tag) == "link" and c.attrib.get("href") and c.attrib.get("rel", "alternate") == "alternate":
                    link = c.attrib["href"]
                    break
        title = strip_html(_child_text(el, "title"), 300)
        if not title or not re.match(r"^https?://", link or "", re.I):
            continue
        summary = strip_html(_child_text(el, "description", "summary", "encoded", "content"))
        published = _parse_date(_child_text(el, "pubdate", "published", "updated", "date"))
        items.append(FeedItem(title=title, link=link.strip(), summary=summary, published=published))
        if len(items) >= max_items:
            break
    return items


def _is_public_host(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    return bool(infos) and all(ipaddress.ip_address(i[4][0]).is_global for i in infos)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # we follow redirects manually so every hop is validated
        return None


_opener = urllib.request.build_opener(_NoRedirect)


class HttpFetcher:
    def __init__(self, allowed_domains: list[str]):
        self.allowed = list(allowed_domains)
        self._robots: dict[str, Optional[robotparser.RobotFileParser]] = {}

    def _validate(self, url: str) -> None:
        p = urllib.parse.urlparse(url)
        if p.scheme not in ("http", "https") or not p.hostname:
            raise FetchError("Only http(s) URLs are allowed")
        if p.port not in (None, 80, 443):
            raise FetchError("Non-standard ports are not allowed")
        if not domain_allowed(p.hostname, self.allowed):
            raise FetchError(f"Domain not on the approved list: {p.hostname}")
        if not _is_public_host(p.hostname):
            raise FetchError("Host does not resolve to a public address")

    def _get(self, url: str, accept: str = "*/*", max_redirects: int = 3) -> bytes:
        for _ in range(max_redirects + 1):
            self._validate(url)
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
            try:
                with _opener.open(req, timeout=10) as resp:
                    data = resp.read(MAX_BYTES + 1)
                    if len(data) > MAX_BYTES:
                        raise FetchError("Response too large")
                    return data
            except urllib.error.HTTPError as e:
                loc = e.headers.get("Location") if e.headers else None
                if e.code in (301, 302, 303, 307, 308) and loc:
                    url = urllib.parse.urljoin(url, loc)
                    continue
                raise FetchError(f"HTTP {e.code}")
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                raise FetchError(f"Network error ({type(e).__name__})")
        raise FetchError("Too many redirects")

    def fetch_feed(self, url: str) -> list[FeedItem]:
        return parse_feed(self._get(url, "application/rss+xml, application/atom+xml, application/xml, text/xml"))

    def _robots_ok(self, url: str) -> bool:
        p = urllib.parse.urlparse(url)
        if p.netloc not in self._robots:
            rp = robotparser.RobotFileParser()
            try:
                rp.parse(self._get(f"{p.scheme}://{p.netloc}/robots.txt").decode("utf-8", "ignore").splitlines())
                self._robots[p.netloc] = rp
            except FetchError as e:
                self._robots[p.netloc] = robotparser.RobotFileParser() if "HTTP 404" in str(e) else None
                if self._robots[p.netloc] is not None:
                    self._robots[p.netloc].parse([])  # no robots.txt -> allow
        rp = self._robots[p.netloc]
        return bool(rp and rp.can_fetch(USER_AGENT, url))

    def page_excerpt(self, url: str) -> Optional[str]:
        try:
            if not self._robots_ok(url):
                return None
            return strip_html(self._get(url, "text/html").decode("utf-8", "ignore")) or None
        except FetchError:
            return None
