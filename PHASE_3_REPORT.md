# Phase 3 Report: AI automation, security, deployment

## Implemented
- **Provider interface** (`ai/provider.py`): `AIProvider` with `AnthropicProvider` (server-side key, model from env, timeouts, retryable vs permanent errors, no secrets in errors) and a clearly-marked `MockProvider` for offline use. Structured output validated by Pydantic `ArticleDraft`.
- **Research** (`ai/research.py`): RSS/Atom feeds from an allow-list of domains; SSRF guard; `defusedxml`; robots.txt for page fetches; short excerpts only; source URL/title/domain/dates/retrieval time/content hash stored. Relevance = configured category keywords. Duplicate detection against topics and existing posts. It does **not** claim to monitor the whole internet and no search API is wired in (only feeds + manual topics).
- **Generation:** outline-level fields, article, SEO title/description, slug suggestion, headings, FAQs (appended to body), internal-link suggestions and image brief (stored as info notes), source list. Owner facts limited to the *published* profile name/headline. Regeneration for AI posts still in draft/review/rejected.
- **Quality flags:** missing evidence, stale/undated sources, unsupported or mis-cited claims, model uncertainty, unlisted links, unverified first-person claims, unsafe HTML, thin content, duplicate topic, suspected prompt injection.
- **Approval safety:** AI posts are created `in_review`; approval needs an authenticated admin + exact content hash (recorded with admin id and time); edits invalidate; publish re-validates; no AI code path approves/publishes; no config switch for it.
- **Reliability:** DB-backed queue; idempotency keys; one active draft job per topic/post; atomic claim; retries (max 3) with exponential backoff; stale-job recovery; cancellation (immediate for queued, cooperative for running); manual retry; daily job + monthly token budgets; usage + optional cost estimate; time zone aware schedules; bounded `tick` for external schedulers; CLI worker.
- **Admin AI dashboard:** settings, usage, topics/sources, jobs (errors, attempts, logs, cancel/retry), review queue with warnings, history. Draft preview/edit/approve/reject/schedule happen in the blog editor.
- **Docs:** `docs/API.md`, `docs/SECURITY_AUDIT.md`, `docs/DEPLOYMENT.md` (env vars, migrations, scheduler options, backup/restore, monitoring, recovery).

## Verification actually performed in the authoring sandbox (no internet)
| Check | Result |
|---|---|
| `py_compile` of all backend code and tests | passed |
| Pure-logic AI tests executed with stand-ins for `pytest`/`defusedxml` (13 cases: feed parsing, domain allow-list, SSRF guard, quality flags, JSON extraction, mock provider) | **passed** |
| `node --test` | **9 / 9 passed** |
| `pytest` full suite (95 test functions, 28 for the AI pipeline) | **NOT RUN** |
| Real `defusedxml` entity-bomb test, real HTTP fetch, real Anthropic call | **NOT RUN** |
| Migration 0003 on PostgreSQL | **NOT RUN** |
| Any live AI generation or feed discovery against the real internet | **NOT RUN** |

## Tests written (not yet executed): `test_ai.py` (28) + `test_ai_pure.py` (10)
Config validation, auth on every AI route, disabled state, discovery filters/duplicates, draft lands in review and is invisible publicly, exact-revision approval and invalidation,
worker cannot publish unapproved posts, regeneration rules, injection/unsupported-claim flags, prompt wrapping, idempotent enqueue, retry + backoff, bounded retries + manual retry,
permanent errors, invalid model output, daily/monthly budgets, cancel queued/running, stale recovery, time-zone scheduling, bounded tick, audit history.

## Known issues / limits
- AI quality checks are heuristics; a fluent draft can still be wrong. Human review is the real control.
- No search-API integration yet; discovery uses feeds you configure.
- AI is never assumed free: you need a provider account; the cost estimate is only as good as the prices you enter.
- Running jobs can only be cancelled between steps, not mid-model-call.
- `/admin/ai/run` executes jobs inside the web request (max 2, ~40 s); long runs belong in the worker/cron.
- Same security residuals as `docs/SECURITY_AUDIT.md` (in-memory login limiter, no JWT revocation, DNS-rebinding window, no CSP).
- Everything above is unverified until you run the test suite; expect some first-run fixes.

## Manual verification checklist
1. `pytest -v` and `npm test` green; `npm run build` works.
2. AI settings: add a real feed and its domain, enable, "Find topics now", "Draft this", "Run queued jobs now" (with `AI_PROVIDER=mock` first).
3. Confirm the draft is `in_review`, invisible at `/blog`, absent from `/sitemap.xml` and RSS.
4. Edit it, approve (note the revision hash), edit again → approval cleared. Approve again, schedule for 5 minutes ahead, call the tick, confirm it publishes.
5. Switch to `AI_PROVIDER=anthropic` with a small budget; check sources, warnings and cost.
6. Try failure paths: bad feed URL, wrong API key, cancel a job, hit the daily budget.
