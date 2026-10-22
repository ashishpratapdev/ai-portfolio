# Render staging → production plan

## Branch strategy
| Branch | Deploys to | Purpose |
|---|---|---|
| `staging` | Render services `portfolio-staging-*` | test everything with real hosting |
| `main` | production services (created later) | only after staging passes the checklist below |

## 1. Put the code on GitHub (you do this once)
```bash
mkdir ai-portfolio && tar xzf ai-portfolio-all-phases.tar.gz -C ai-portfolio && cd ai-portfolio
git init -b staging
git add . && git commit -m "Initial import: phases 1-3"
# create an EMPTY repo on github.com (e.g. ai-portfolio), then:
git remote add origin https://github.com/<your-user>/ai-portfolio.git
git push -u origin staging
```
Check `git status` shows no `.env` files (they are git-ignored). If the repo is private, Render needs access to it
(Render dashboard → Account Settings → GitHub → configure access).

## 2. Services created on Render (Singapore region)
| Service | Type | Build | Start |
|---|---|---|---|
| `portfolio-staging-db` | Postgres | n/a | n/a |
| `portfolio-staging-api` | Web (Python) | `cd backend && pip install -r requirements.txt` | `cd backend && alembic upgrade head && python -m app.bootstrap_admin && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| `portfolio-staging-web` | Web (Node) | `cd frontend && npm install && npm run build` | `cd frontend && npm start` |

**Environment (API):** `APP_ENV=staging`, `DATABASE_URL` (internal URL of the DB), `SECRET_KEY`, `INTERNAL_API_KEY`, `WORKER_TOKEN`,
`CORS_ORIGINS`, `SITE_URL`, `AI_PROVIDER=mock`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (you set this one yourself in the dashboard).
**Environment (web):** `API_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `INTERNAL_API_KEY` (same value as API), `NODE_ENV=production`.
`NEXT_PUBLIC_*` values are baked in at build time: change them, then redeploy.

## 3. Free-plan behaviour to expect (verify current terms on Render's pricing page)
- Free web services sleep after ~15 min idle; the first request then takes about a minute. Your scheduler (below) would also wake it.
- Free Postgres expires 30 days after creation (recreate and restore from a dump if you keep staging longer).
- No persistent disk: uploaded files vanish on restart/redeploy. Fine for testing; production needs a paid disk or object storage.
- 750 free instance hours/month per workspace is shared by all free services; two always-on free services would exceed it.
- Backend login rate-limit and AI/scheduler endpoints work, but nothing calls `/worker/tick` automatically on staging. Trigger it by hand or with an external cron.

## 4. Staging acceptance checklist (do all before promoting to `main`)
1. `https://<api>/health` returns `{"status":"ok"}`; `/docs` is reachable (staging only).
2. Log in at `https://<web>/admin`; wrong password 5× returns "Too many failed attempts".
3. Fill profile (real details), publish; add a project, publish; confirm public pages update.
4. Upload a PDF resume; confirm it is private until marked public.
5. Create a blog post → review → approve → publish; confirm it appears in `/blog`, `/sitemap.xml`, `/blog/rss.xml`. Edit-after-approval clears approval.
6. Send a contact message; confirm it shows in Admin → Inquiries; 6th message within an hour is refused.
7. AI (mock): add feed + approved domain, "Find topics now", "Draft this", "Run queued jobs now"; draft stays `in_review` and is not public.
8. `curl -X POST https://<api>/api/v1/worker/tick -H "X-Worker-Token: <token>"` returns JSON.
9. View the site at 375 px width; tab through the admin with the keyboard.
10. Remove `ADMIN_PASSWORD` from the API env after the first login.

## 5. Promoting to `main` (later)
Merge `staging` into `main`, create `portfolio-prod-*` services deploying branch `main` on **paid** plans (always-on API, persistent storage or object storage,
paid Postgres with backups), use NEW secrets (never reuse staging ones), set `APP_ENV=production`, then follow `docs/DEPLOYMENT.md` §3-§8.
