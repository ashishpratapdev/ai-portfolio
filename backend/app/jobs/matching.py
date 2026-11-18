"""Explainable job-fit scoring against the owner's verified skills. No AI, no guessing: every point is traceable."""
import hashlib
import re

TECH_VOCAB = {
    "javascript", "typescript", "react", "next", "node", "express", "redux", "vue", "angular", "svelte", "html", "css", "tailwind", "bootstrap",
    "sass", "jquery", "webpack", "vite", "python", "django", "flask", "fastapi", "java", "spring", "kotlin", "swift", "go", "rust", "ruby", "rails",
    "php", "laravel", "wordpress", "c#", ".net", "c++", "mongodb", "mysql", "postgresql", "sql", "redis", "sqlite", "firebase", "graphql", "rest",
    "git", "github", "docker", "kubernetes", "aws", "azure", "gcp", "linux", "nginx", "cicd", "jest", "cypress", "figma", "flutter", "android", "ios",
    "react native", "supabase", "prisma", "nestjs", "elasticsearch", "kafka", "terraform", "jenkins", "microservices", "seo",
}
ALIASES = {"reactjs": "react", "react.js": "react", "nodejs": "node", "node.js": "node", "nextjs": "next", "next.js": "next", "expressjs": "express",
           "express.js": "express", "js": "javascript", "ts": "typescript", "mongo": "mongodb", "tailwindcss": "tailwind", "postgres": "postgresql",
           "html5": "html", "css3": "css", "redux.js": "redux", "vuejs": "vue", "vue.js": "vue", "golang": "go", "k8s": "kubernetes", "ci/cd": "cicd",
           "restful": "rest", "nest.js": "nestjs", "angularjs": "angular"}
FULL_NAMES = {"tailwind css": "tailwind", "react native": "react native", "node js": "node", "next js": "next", "react js": "react"}
TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#.\-/]*")
SENIOR_RE = re.compile(r"\b(senior|sr\.?|lead|principal|staff|head of|manager|director|architect|vp)\b", re.I)
JUNIOR_RE = re.compile(r"\b(junior|jr\.?|entry[- ]level|intern(ship)?|trainee|graduate|fresher|associate)\b", re.I)
YEARS_RE = re.compile(r"(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?)\b", re.I)


def norm(tok: str) -> str:
    t = tok.strip(".-/").lower()
    return ALIASES.get(t, t)


def tokens(text: str) -> set[str]:
    return {norm(t) for t in TOKEN_RE.findall((text or "").lower())}


def skill_key(name: str) -> str:
    n = " ".join(name.lower().split())
    return FULL_NAMES.get(n) or norm(n)


def user_skill_set(names) -> set[str]:
    """Only technology skills count for matching (soft skills like 'Team Management' are ignored)."""
    return {k for k in (skill_key(n) for n in names) if k in TECH_VOCAB}


def dedupe_key(company: str, title: str) -> str:
    clean = lambda s: re.sub(r"[^a-z0-9]+", "", s.lower())  # noqa: E731
    title = re.sub(r"\(.*?\)", "", title)
    return hashlib.sha256(f"{clean(company)}|{clean(title)}".encode()).hexdigest()


def years_required(text: str):
    nums = [int(n) for n in YEARS_RE.findall(text or "") if 0 < int(n) < 30]
    return max(nums) if nums else None


def excluded(title: str, exclude_keywords) -> bool:
    t = title.lower()
    return any(re.search(rf"(?<![a-z0-9]){re.escape(k.strip().lower())}(?![a-z0-9])", t) for k in (exclude_keywords or []) if k.strip())


def location_ok(job, cfg) -> bool:
    """Remote jobs restricted to a region we are not in (e.g. 'USA only') are dropped for an India-based search."""
    geo = (job.location or "").lower().strip()
    blob = f"{geo} {' '.join(job.tags).lower()}"
    wanted = [l.strip().lower() for l in (cfg.locations or []) if l.strip() and l.strip().lower() != "remote"]
    hit = any(w in blob for w in wanted)
    if cfg.remote_only and not job.remote:
        return False
    if job.remote:
        open_ = not geo or geo in ("remote", "anywhere") or any(w in geo for w in ("anywhere", "worldwide", "global", "apac", "asia", "india", "international"))
        return open_ or hit
    return hit if wanted else True


def score_job(job, skills: set, cfg) -> tuple[int, dict]:
    title_l, desc_l = job.title.lower(), (job.description or "")[:6000].lower()
    title_t, tag_t, desc_t = tokens(job.title), {norm(t.lower()) for t in job.tags}, tokens(desc_l)
    matched = {}
    for s in skills:
        w = 3 if s in title_t else 2 if s in tag_t else 1 if s in desc_t else 0
        if w:
            matched[s] = w
    job_tech = (title_t | tag_t | desc_t) & TECH_VOCAB
    prominent = (title_t | tag_t) & TECH_VOCAB
    missing = sorted(job_tech - skills, key=lambda x: (x not in prominent, x))[:8]
    demanded = max(3, min(len(job_tech), 8))
    total = min(60, round(60 * sum(matched.values()) / (demanded * 2)))
    notes = []
    kws = [k.strip().lower() for k in (cfg.keywords or []) if k.strip()]
    if any(k in title_l for k in kws):
        total += 20
        notes.append("Title matches one of your keywords")
    elif any(k in desc_l for k in kws):
        total += 8
    if location_ok(job, cfg):
        total += 10
    if SENIOR_RE.search(job.title):
        total -= 30
        notes.append(f"Senior-level title (you have about {cfg.my_years} years)")
    elif JUNIOR_RE.search(job.title):
        total += 8
        notes.append("Junior/entry-level friendly")
    yrs = years_required(job.description)
    if yrs and yrs > cfg.my_years + 2:
        total -= min(25, 6 * (yrs - cfg.my_years - 2))
        notes.append(f"Asks for {yrs}+ years of experience")
    return max(0, min(100, total)), {"matched": sorted(matched, key=lambda x: (-matched[x], x)), "missing": missing, "notes": notes, "years_required": yrs}
