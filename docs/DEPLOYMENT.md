# Deployment, backup, monitoring and recovery

**Free-tier rule:** prefer free tiers, but quotas, cold starts, schedulers, storage, bandwidth, email and AI API access change.
Check each provider's *current* pricing page before you commit. Nothing here promises permanent zero cost; the AI provider is a paid API.

## 1. Architecture to deploy
| Part | Needs | Typical hosting shape |
|---|---|---|
| Next.js frontend | Node runtime (server components + route handlers) | a Node/serverless host that supports Next.js |
| FastAPI backend | long-lived Python web process | container/PaaS web service |
| PostgreSQL | managed or self-hosted | managed Postgres with a free tier, or your own |
| Uploads | persistent disk **or** object storage | local-disk uploads are lost on ephemeral hosts |
| Scheduler | something that calls `/api/v1/worker/tick` | external cron (see §4) |

Things to verify per provider: idle spin-down/cold-start delay (first request may take tens of seconds), monthly hours/bandwidth,
database size and connection limits, whether a persistent disk exists on the free plan, and whether cron jobs are included.

## 2. Environment variables
**Backend (`backend/.env` or host secrets):**
| Var | Required | Notes |
|---|---|---|
| `APP_ENV` | yes | `production` hides `/docs` and `/openapi.json` |
| `DATABASE_URL` | yes | `postgresql+psycopg://user:pass@host:5432/db` (add `?sslmode=require` if the host needs TLS) |
| `SECRET_KEY` | yes | 32+ random chars; rotating it logs everyone out |
| `CORS_ORIGINS` | yes | your site origin(s), comma separated, no `*` |
| `INTERNAL_API_KEY` | yes | must equal the frontend's value |
| `SITE_URL` | yes | public site origin |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | no | point `UPLOAD_DIR` at a persistent volume |
| `WORKER_TOKEN` | for external scheduler | long random string; empty disables `/worker/tick` |
| `AI_PROVIDER` | no | `mock` (default, fake drafts) or `anthropic` |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | for real AI | model id from your Anthropic account; billed per token |
| `AI_PRICE_IN_PER_MTOK`, `AI_PRICE_OUT_PER_MTOK` | no | enables the dashboard cost estimate |

**Frontend:** `API_URL` (server-side backend URL), `NEXT_PUBLIC_API_URL` (browser-reachable backend URL, used only for public media),
`NEXT_PUBLIC_SITE_URL`, `INTERNAL_API_KEY`, optional `GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.

## 3. First deploy and updates
```bash
# backend release step (run on every deploy BEFORE starting the new version)
alembic upgrade head
# start command
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
# first admin (once, via the host's shell)
python -m app.create_admin you@example.com
```
- Take a database backup **before** running migrations in production (§5). Never run `drop_all` or reset production data.
- `alembic downgrade -1` exists for each revision but drops tables/data created by it; prefer restoring a backup.
- Use one worker process unless you move the login limiter out of memory.
- After deploy: open `/health`, log in at `/admin`, publish the profile, create a test post, check `/sitemap.xml`, `/robots.txt`, `/blog/rss.xml`.
- Put the frontend and backend behind HTTPS. The admin cookie is `Secure` when `NODE_ENV=production`.

## 4. Scheduling (scheduled publishing + AI queue)
The backend never relies on an in-memory timer: all work is in the database, and `tick` can be called by anything.
Pick one:
1. **External cron hitting HTTP** (works on sleeping free hosts): any service that can send a `POST` every 5-15 minutes with header
   `X-Worker-Token: <WORKER_TOKEN>` to `https://<backend>/api/v1/worker/tick` (e.g. a hosted cron service or a GitHub Actions `schedule:` workflow).
   Check that service's current limits: minimum interval and whether scheduled workflows pause on inactive repos.
   Each call is bounded (≤3 AI jobs, ≈45 s), and a call that wakes a cold host may need a longer timeout.
2. **Host cron job** running `python -m app.worker tick` (if your host offers cron on your plan).
3. **Always-on worker** `python -m app.worker loop 60` (needs a host that keeps a second process alive).
4. **Manual only:** leave schedule at "Manual", use the AI dashboard buttons and `POST /api/v1/admin/blog/actions/publish-due`.

Behaviour to document for yourself: scheduled posts publish at the next tick after their time (so up to one interval late);
a stuck job is re-queued after 15 minutes; failed jobs retry up to 3 attempts with 30 s → 60 s backoff, then wait for a manual retry;
daily job and monthly token budgets stop work and mark the job failed with a clear message; time zone for schedules and budgets is the one set in AI settings (default UTC).

## 5. Backups and restore
Back up **both** the database and the uploads directory.
```bash
# backup (schedule daily; store off the server; keep several generations)
pg_dump --format=custom --no-owner "$DATABASE_URL_PLAIN" -f backup-$(date +%F).dump
tar czf uploads-$(date +%F).tar.gz -C backend uploads

# restore into an EMPTY database (test this on a scratch DB before you need it)
createdb portfolio_restore
pg_restore --no-owner --dbname portfolio_restore backup-YYYY-MM-DD.dump
tar xzf uploads-YYYY-MM-DD.tar.gz -C backend
# point DATABASE_URL at portfolio_restore, run `alembic current` (should be 0003), start the app
```
(`DATABASE_URL_PLAIN` = the same URL without the `+psycopg` driver suffix.) Managed providers often offer their own backups: check retention on your plan and still keep an independent copy.
Restore drill: do it once before launch, and record how long it took.

## 6. Monitoring
- Uptime check on `GET /health` (backend) and `/` (frontend) from an external monitor; alert by email.
- Check `GET /api/v1/admin/ai/jobs?state=failed` (or the dashboard) weekly; failed jobs carry sanitized error text.
- Watch provider dashboards for AI spend; keep budgets low while testing. Set a spending cap on the provider account if available.
- Host logs: look for 5xx, `429` spikes on `/public/contact`, and repeated `login_failed` audit entries.
- Review the audit log (`/admin/ai` → History) after every AI batch.

## 7. Recovery runbook
| Symptom | Action |
|---|---|
| Site shows "could not load" | backend down/cold: check `/health`, host logs, `API_URL` |
| Bad deploy | roll back the host release; if a migration ran, restore the pre-migration backup instead of downgrading |
| Admin locked out | `python -m app.create_admin you@example.com` resets the password |
| Suspected token leak | rotate `SECRET_KEY` (all sessions end) and deactivate unknown admins |
| Leaked AI key | revoke it at the provider, set a new `ANTHROPIC_API_KEY`, review usage |
| AI misbehaving | uncheck "Pipeline enabled" in AI settings; reject/delete drafts; nothing AI-made is public unless you approved it |
| Wrong post published | `Unpublish` in the editor (returns to draft; public cache may lag up to 60 s) |
| Uploads missing after redeploy | uploads were on ephemeral disk: restore from backup and mount a persistent volume |

## 8. Pre-launch checklist
- [ ] `pytest -v` and `npm test` pass; `npm run build` succeeds; `alembic upgrade head` works on a fresh Postgres
- [ ] Real profile/experience content entered and verified (no `[PLACEHOLDER]` left)
- [ ] `SECRET_KEY`, `INTERNAL_API_KEY`, `WORKER_TOKEN` are long random values; no secrets in Git
- [ ] `APP_ENV=production`, HTTPS on, CORS lists only your site
- [ ] Sitemap/robots/canonical/OG checked in a browser; submit sitemap in Search Console if you use it
- [ ] Contact form tested end to end; decide how you will be notified of new inquiries (the app stores them; it sends no email)
- [ ] Backup + restore drill done; uptime monitor set; scheduler chosen and tested
- [ ] AI: provider key, model, budgets set; `AI_PROVIDER=anthropic`; approved domains and feeds reviewed for licensing/terms
- [ ] `pip-audit` / `npm audit` run; lock files committed
