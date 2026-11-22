"""Reads the owner's OWN resume (PDF or pasted text) and extracts skills, role titles and years of experience.
Pure functions, no network. The text is stored only in the owner's database and is never exposed publicly."""
import io
import re
from collections import Counter

from .matching import TOKEN_RE, norm, tech_in

MAX_TEXT = 20000

DISPLAY = {
    "javascript": "JavaScript", "typescript": "TypeScript", "react": "React", "next": "Next.js", "node": "Node.js", "express": "Express.js", "redux": "Redux",
    "vue": "Vue", "angular": "Angular", "svelte": "Svelte", "html": "HTML", "css": "CSS", "tailwind": "Tailwind CSS", "bootstrap": "Bootstrap", "sass": "Sass",
    "jquery": "jQuery", "webpack": "Webpack", "vite": "Vite", "python": "Python", "django": "Django", "flask": "Flask", "fastapi": "FastAPI", "java": "Java",
    "spring": "Spring", "kotlin": "Kotlin", "swift": "Swift", "go": "Go", "rust": "Rust", "ruby": "Ruby", "rails": "Rails", "php": "PHP", "laravel": "Laravel",
    "wordpress": "WordPress", "c#": "C#", ".net": ".NET", "c++": "C++", "mongodb": "MongoDB", "mysql": "MySQL", "postgresql": "PostgreSQL", "sql": "SQL",
    "redis": "Redis", "sqlite": "SQLite", "firebase": "Firebase", "graphql": "GraphQL", "rest": "REST", "git": "Git", "github": "GitHub", "docker": "Docker",
    "kubernetes": "Kubernetes", "aws": "AWS", "azure": "Azure", "gcp": "GCP", "linux": "Linux", "nginx": "Nginx", "cicd": "CI/CD", "jest": "Jest",
    "cypress": "Cypress", "figma": "Figma", "flutter": "Flutter", "android": "Android", "ios": "iOS", "supabase": "Supabase", "prisma": "Prisma",
    "nestjs": "NestJS", "elasticsearch": "Elasticsearch", "kafka": "Kafka", "terraform": "Terraform", "jenkins": "Jenkins", "microservices": "Microservices", "seo": "SEO",
}
ROLE_WORDS = r"(?:developer|engineer|designer|analyst|intern|internship|trainee|consultant|architect|administrator|programmer|specialist|manager|lead)"
MONTH = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?"
DATE_RANGE = re.compile(rf"\s*\b(?:{MONTH}\s+)?(?:19|20)\d{{2}}\s*[-–—]\s*(?:present|current|(?:{MONTH}\s+)?(?:19|20)\d{{2}})\b.*$", re.I)
YEARS_RE = re.compile(r"(\d{1,2})\s*\+?\s*years?\s+of\s+(?:professional\s+|hands-on\s+)?experience", re.I)
SEARCH_SKIP = {"html", "css", "git", "github", "sql", "rest", "seo", "jquery", "sass", "bootstrap", "wordpress"}  # too generic to search jobs by
DROP_WORDS = {"internship", "trainee", "freelance", "self-employed", "senior", "junior", "lead"}


class ResumeError(Exception):
    pass


def clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\u00a0", " ")
    return re.sub(r"[ \t]+", " ", re.sub(r"\n{3,}", "\n\n", text)).strip()[:MAX_TEXT]


def extract_text_pdf(data: bytes) -> str:
    if not data.startswith(b"%PDF-"):
        raise ResumeError("That file is not a PDF.")
    try:
        from pypdf import PdfReader
    except ImportError:
        raise ResumeError("PDF reading is not installed on the server (pypdf). Paste your resume text instead.")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ResumeError("Password-protected PDFs are not supported. Paste the text instead.")
        text = clean("\n".join((page.extract_text() or "") for page in reader.pages[:10]))
    except ResumeError:
        raise
    except Exception:
        raise ResumeError("Could not read this PDF. Paste the text instead.")
    if len(text) < 80:
        raise ResumeError("No readable text found (is it a scanned image?). Paste the text instead.")
    return text


def extract_titles(text: str) -> list[str]:
    out: list[str] = []
    for raw in text.split("\n"):
        line = raw.strip(" \t•-*·")
        if not line or len(line) > 110 or line.endswith("."):
            continue
        line = DATE_RANGE.sub("", line).strip(" -–—|,")
        if "|" in line:
            line = line.split("|")[0].strip()
        if 3 <= len(line) <= 70 and re.search(rf"\b{ROLE_WORDS}\b", line, re.I) and not re.search(r"\b(at|with|using|built|develop|manage|oversee|support|deliver)\b", line, re.I):
            if line.lower() not in {t.lower() for t in out}:
                out.append(line)
    return out[:6]


def keywords_from(titles: list[str], skills: list[str]) -> list[str]:
    kws: list[str] = []
    for t in titles:
        for part in re.split(r"\s+and\s+|\s+-\s+|,|/", t):
            words = [w for w in part.lower().split() if w not in DROP_WORDS]
            cand = " ".join(words).strip()
            if cand and re.search(rf"\b{ROLE_WORDS}\b", cand) and not cand.endswith(("manager", "lead")) and cand not in kws:
                kws.append(cand)
    for s in [x for x in skills if x.lower() not in SEARCH_SKIP][:6]:
        if s.lower() not in kws:
            kws.append(s.lower())
    return kws[:15]


def analyze_resume(text: str) -> dict:
    text = clean(text)
    freq = Counter(norm(t) for t in TOKEN_RE.findall(text.lower()))  # how often each technology is mentioned
    keys = tech_in(text)
    ordered = sorted(keys, key=lambda k: (-freq.get(k, 1), k))
    skills = [DISPLAY.get(k, k.capitalize()) for k in ordered]
    titles = extract_titles(text)
    years = next((int(m) for m in YEARS_RE.findall(text) if 0 < int(m) < 40), None)
    return {"skills": skills, "titles": titles, "years": years, "keywords": keywords_from(titles, skills), "chars": len(text)}
