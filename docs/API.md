# API reference (summary)

Base path `/api/v1`. Interactive docs at `/docs` outside production. Admin routes need `Authorization: Bearer <JWT>`
(the Next.js admin proxy adds it from an httpOnly cookie). Errors: `{"detail": ...}`; validation errors are 422, invalid state transitions 409.

## Auth
`POST /auth/login {email,password}` → token (5 failures / 15 min / IP → 429) · `GET /auth/me`

## Public (no auth; published + indexable content only)
| Route | Notes |
|---|---|
| `GET /public/profile, skills, experience, services, projects, projects/{slug}, settings` | Phase 1 |
| `GET /public/media/{id}`, `GET /public/resume` | only files marked public |
| `GET /public/blog?page&page_size&category&tag&q` | paginated summaries (page_size ≤ 50) |
| `GET /public/blog/{slug}` | full post, sources, related (≤ 3) |
| `GET /public/blog-filters` | categories/tags that have live posts |
| `GET /public/sitemap` | eligible paths only (no drafts/scheduled/noindex) |
| `GET /public/redirect?path=/blog/old` | `{to_path,status_code}` or 404 |
| `POST /public/contact` | 202; honeypot `website` must be empty; 5/hour/visitor, 200/hour global |

## Admin: portfolio (Phase 1)
`/admin/{skills|experience|projects|services}` CRUD + `/{id}/publish|unpublish|archive|restore`, `POST /reorder` · `/admin/profile` · `/admin/settings` · `/admin/media`

## Admin: blog
| Route | Purpose |
|---|---|
| `GET/POST /admin/blog`, `GET/PATCH/DELETE /admin/blog/{id}` | CRUD (PATCH merges + full validation; state fields are not patchable; DELETE only draft/rejected) |
| `GET /admin/blog/{id}/revisions` | revision history (hash, source `admin`/`ai`) |
| `POST /admin/blog/{id}/review` | draft → in_review |
| `POST /admin/blog/{id}/approve {revision_hash}` | in_review → approved; hash must equal current content hash; records admin + time |
| `POST /admin/blog/{id}/reject {reason}` | → rejected |
| `POST /admin/blog/{id}/draft` | back to draft / unpublish (clears approval) |
| `POST /admin/blog/{id}/publish` | approved/scheduled → published (re-validates approval) |
| `POST /admin/blog/{id}/schedule {publish_at}` / `unschedule` | needs timezone offset, future time |
| `POST /admin/blog/actions/publish-due` | manual trigger of the due-post publisher |

State machine: `draft→in_review`; `in_review→draft|approved|rejected`; `approved→draft|scheduled|published|rejected`; `scheduled→draft|approved|published`; `published→draft`; `rejected→draft`.

## Admin: inquiries and redirects
`GET /admin/inquiries?status` · `PATCH /admin/inquiries/{id} {status}` · `DELETE /admin/inquiries/{id}` · `GET/POST /admin/redirects` · `DELETE /admin/redirects/{id}`

## Admin: AI
| Route | Purpose |
|---|---|
| `GET/PUT /admin/ai/config` | enabled, schedule, time zone, tone, categories, feeds, approved domains, budgets (no approval toggle exists) |
| `GET /admin/ai/usage` | jobs today, tokens this month, cost estimate (only if prices configured) |
| `GET/POST /admin/ai/topics`, `POST /topics/{id}/draft`, `POST /topics/{id}/reject` | topics & sources |
| `POST /admin/ai/posts/{id}/regenerate` | new draft revision for an AI post still in draft/in_review/rejected |
| `POST /admin/ai/discover`, `POST /admin/ai/run` | enqueue discovery (1/hour manual) / run up to 2 queued jobs |
| `GET /admin/ai/jobs`, `GET /jobs/{id}`, `POST /jobs/{id}/cancel`, `POST /jobs/{id}/retry` | job control |
| `GET /admin/ai/review-queue`, `GET /admin/ai/history` | review list / audit trail |

## Worker
`POST /worker/tick` with `X-Worker-Token` (503 if `WORKER_TOKEN` unset). Publishes due posts (approval re-checked), schedules and runs a bounded number of AI jobs. Cannot approve anything.
