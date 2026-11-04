"""The frontend ships a built-in copy of the resume content (frontend/lib/static-content.js) that is shown when the API is
asleep. It is generated from seed_resume.py; this test fails if someone edits the seed without regenerating it
(run `python scripts/gen_static_content.py` from the repo root)."""
import json
import pathlib

from app import seed_resume as seed

JS = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "lib" / "static-content.js"


def _static():
    text = JS.read_text()
    return json.loads(text.split("export const STATIC_CONTENT = ", 1)[1].rstrip().rstrip(";"))


def test_static_content_matches_seed():
    s = _static()
    assert s["profile"]["full_name"] == seed.PROFILE["full_name"]
    assert s["profile"]["bio"] == seed.PROFILE["bio"] and s["profile"]["contact_email"] == seed.PROFILE["contact_email"]
    assert [x["name"] for x in s["skills"]] == [n for _, names in seed.SKILLS for n in names]
    assert [(e["company"], e["role"], e["start_date"]) for e in s["experience"]] == [
        (e["company"], e["role"], e["start_date"].isoformat()) for e in seed.EXPERIENCE]
    assert [p["slug"] for p in s["projects"]] == [p["slug"] for p in seed.PROJECTS]
    assert [x["title"] for x in s["services"]] == [x["title"] for x in seed.SERVICES]
    assert s["settings"] == seed.SETTINGS
