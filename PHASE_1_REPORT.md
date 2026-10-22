# Phase 1 Report

## Implemented
- **Backend (FastAPI, /api/v1):** JWT admin auth (bcrypt), failed-login limiter, admin CRUD for skills / experience /
  projects / services, single-record profile, whitelisted site settings, media upload/list/patch/delete, public read API
  (published only), audit log for important actions, explicit CORS, input validation (URL scheme checks, date ordering, length limits).
- **Database:** SQLAlchemy 2 models + hand-written Alembic migration `0001_initial` (+ a test that fails if models and migration drift).
- **Frontend:** Home, About, Experience, Projects, Project details, Services, Resume, Contact, 404, loading and error states;
  admin login, dashboard, generic resource manager (create, edit, reorder, publish/unpublish, archive/restore), profile, media, settings.
- **Security design:** httpOnly SameSite=Strict cookie + same-origin proxy; backend authorization on every admin route;
  private-by-default uploads; resume private unless explicitly public; status changes only via dedicated endpoints.

## Commands actually run (in the authoring sandbox, which has NO internet)
| Check | Result |
|---|---|
| `python -m py_compile` on all backend modules, migration and tests | passed |
| `tsc` syntax check (JSX) over all frontend files | no syntax errors |
| `node --test "tests/**/*.test.js"` (frontend helpers) | **4 / 4 passed** |
| `pytest` (backend) | **NOT RUN** — FastAPI/SQLAlchemy/Alembic could not be installed offline |
| `alembic upgrade head` on PostgreSQL | **NOT RUN** |
| `npm install` / `next build` / `next dev` | **NOT RUN** |
| Manual browser checks (mobile + desktop) | **NOT RUN** |

## Tests written but not yet executed
`backend/tests`: test_auth.py (login, bad/forged/deactivated tokens, rate limit, protected routes, CORS),
test_crud.py (validation, lifecycle, reorder, public isolation, slug uniqueness, profile, settings, audit),
test_media.py (type/magic-byte/size checks, private-by-default, resume rules, delete),
test_migrations.py (migration vs models). **Expect to fix small first-run failures.**

## Known issues / risks
- Everything backend-side and all Next.js build behaviour is unverified until you run the commands in README.
- Next.js 15 / React 19 APIs (`await params`, `await cookies()`) were used from knowledge, not verified against an install.
- Fonts (Bricolage Grotesque, Public Sans) load via `next/font/google` and need network at build time.
- No frontend component/E2E tests yet (only helper unit tests).
- In-memory login limiter; local-disk uploads (see README).

## Manual verification checklist for you
1. `pytest -v` → all green (send me failures if any). 2. `alembic upgrade head` on Postgres succeeds.
3. Log in, create + publish a project → appears at /projects. 4. Unpublish → disappears.
5. Upload a PDF → private; set as resume in Settings + make public → /resume shows Download.
6. Check pages at 375px width and desktop. 7. Tab through admin with keyboard only.
