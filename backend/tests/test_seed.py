from app.database import SessionLocal
from app.models import Experience, Profile, Project, Service, SiteSetting, Skill
from app.seed_resume import SKILLS, seed

P = "/api/v1/public"


def test_seed_publishes_resume_content_once(client):
    with SessionLocal() as db:
        assert seed(db) is True
        assert seed(db) is False  # marker: never runs twice
        assert db.query(Experience).count() == 4 and db.query(Project).count() == 1 and db.query(Service).count() == 3
        assert db.query(Skill).count() == sum(len(n) for _, n in SKILLS)
    assert client.get(f"{P}/profile").json()["full_name"] == "Ashish Pratap"
    assert [e["role"] for e in client.get(f"{P}/experience").json()][:2] == ["Full Stack Developer", "Web Developer and IT Manager"]
    assert client.get(f"{P}/projects/it-solution-website").status_code == 200
    s = client.get(f"{P}/settings").json()
    assert s["site_title"] == "Ashish Pratap" and "Buddha Institute" in s["education"]
    assert "seed_resume_done" not in s


def test_seed_does_not_resurrect_deleted_content_or_overwrite_real_profile(client):
    with SessionLocal() as db:
        db.add(Profile(full_name="Someone Else", headline="h", bio="b", status="published", social_links=[]))
        db.commit()
        seed(db)
        assert db.query(Profile).one().full_name == "Someone Else"  # only the untouched placeholder is replaced
        db.query(Skill).delete()
        db.commit()
        assert seed(db) is False and db.query(Skill).count() == 0


def test_seed_can_be_disabled(client, monkeypatch):
    monkeypatch.setenv("SEED_RESUME", "0")
    with SessionLocal() as db:
        assert seed(db) is False and db.query(Skill).count() == 0 and db.get(SiteSetting, "seed_resume_done") is None


def test_education_setting_is_editable_and_public(client, auth):
    assert client.put("/api/v1/admin/settings", json={"education": "B.Tech"}, headers=auth).status_code == 200
    assert client.get(f"{P}/settings").json()["education"] == "B.Tech"


def test_reseed_token_repairs_an_empty_site_but_never_touches_existing_rows(client, monkeypatch):
    from app.models import Profile
    with SessionLocal() as db:
        assert seed(db) is True
        db.query(Profile).delete()          # simulate a site that came up without its profile
        db.query(Service).delete()
        db.commit()
        assert seed(db) is False            # same token ("1"): the marker says done, nothing happens
        monkeypatch.setenv("SEED_RESUME", "reseed-1")
        assert seed(db) is True             # a new token repairs what is missing
        assert db.query(Profile).one().status == "published" and db.query(Service).count() == 3
        assert db.query(Experience).count() == 4  # tables that had rows were not duplicated
        assert seed(db) is False            # and the new token is now spent
        db.query(Skill).delete()
        db.commit()
        assert seed(db) is False and db.query(Skill).count() == 0
