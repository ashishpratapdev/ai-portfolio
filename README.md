# AI Portfolio & Freelance Growth Platform

Next.js (App Router, JavaScript, Tailwind) + FastAPI + PostgreSQL (SQLAlchemy 2, Alembic).

| Phase | What | Report |
|---|---|---|
| 1 | Portfolio pages, secure admin CMS, media | `PHASE_1_REPORT.md` |
| 2 | Blog CMS, approval workflow, SEO, contact inquiries | `PHASE_2_REPORT.md` |
| 3 | AI topic discovery + drafting, durable jobs, human approval | `PHASE_3_REPORT.md` |

Also read: `docs/API.md`, `docs/SECURITY_AUDIT.md`, `docs/DEPLOYMENT.md`.

> **Status honesty:** this code was written in a sandbox with no internet, so the backend test suite, migrations on
> PostgreSQL and `next build` have **not been run yet**. Run the commands below first; the reports list exactly what was and was not verified.

## Prerequisites
Python 3.11+, Node 20+, PostgreSQL 14+ (or a hosted Postgres URL; check the provider's current free-tier limits).

## Setup
```bash
# 1. database
createdb portfolio

# 2. backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # set DATABASE_URL, SECRET_KEY (32+ chars), INTERNAL_API_KEY
alembic upgrade head            # applies 0001 (portfolio), 0002 (blog/SEO/inquiries), 0003 (AI)
python -m app.create_admin you@example.com
uvicorn app.main:app --reload --port 8000

# 3. frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local      # API_URL, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL, INTERNAL_API_KEY (same as backend)
npm run dev                     # http://localhost:3000   admin: /admin
```

## Tests
```bash
cd backend && pytest -v         # 95 test functions: auth, CRUD, blog workflow, approval safety, SEO, contact, AI jobs
cd frontend && npm test         # markdown safety, SEO helpers, formatters (node:test)
```

## Background work (scheduled publishing + AI queue)
```bash
python -m app.worker tick           # one pass: publish due posts, enqueue, run <=3 AI jobs (use from cron)
python -m app.worker publish-due    # only publish scheduled posts
python -m app.worker loop 60        # always-on worker (needs a host that keeps processes running)
# or, from an external scheduler:  POST /api/v1/worker/tick   header X-Worker-Token: $WORKER_TOKEN
```
See `docs/DEPLOYMENT.md` for free-tier-friendly scheduler options and their limits.

## Key safety rules (enforced in the backend, not the UI)
- Public endpoints read only `published` content; drafts, in-review, approved, scheduled, rejected and `noindex` posts never appear in lists, detail, sitemap, RSS or caches.
- Blog states: `draft → in_review → approved → scheduled/published`, `rejected`. Invalid transitions return 409.
- Approval is tied to a SHA-256 hash of the exact content. Any content change wipes it; publishing and scheduled publishing re-check it.
- Published posts are locked; unpublish first to edit.
- AI output is always created as `in_review`. No AI code path can approve or publish. There is no setting to turn approval off.
- Retrieved web content is untrusted data: wrapped in delimiters, scanned for injection phrases, never executed, and only short excerpts + URLs are stored.

## Troubleshooting
- `RuntimeError: SECRET_KEY must be set…` → fill `SECRET_KEY` in `backend/.env`.
- Contact form returns 403 → `Origin` must match the site host; open the site on the same host you configured.
- Contact rate limit hits everyone at once → `INTERNAL_API_KEY` differs between backend and frontend, so all visitors share the proxy IP.
- AI jobs stay `queued` → pipeline disabled, no worker/scheduler running, or backoff delay not elapsed. Use "Run queued jobs now".
- Drafts say `[MOCK]` → `AI_PROVIDER=mock`. Set `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `AI_MODEL` (you pay your provider).
- Scheduled post didn't publish → nothing called the worker. Set up a scheduler (see deployment guide) or press "Publish due" via `POST /api/v1/admin/blog/actions/publish-due`.
