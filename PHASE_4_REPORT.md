# Phase 4 Report: Job hunt

## Implemented
Master ON/OFF switch (default OFF, gates manual + scheduled fetching), 4 public sources (RemoteOK, Jobicy, Arbeitnow, Adzuna India with optional key),
explainable resume-fit scoring, filtering (exclude keywords, region-restricted remote jobs, age), cross-source dedupe, per-source rate-limit gaps,
AI application packet (cover letter + highlights) restricted to verified profile facts with a truthfulness checker, tracker statuses/notes, run history,
scheduler hook, admin "Job hunt" page (switch, settings, filters, fit chips, side panel with editable letter, copy, open-job-page, "I applied"),
migration 0004, `docs/JOB_HUNT.md`.

## Added in the second pass
Light green admin redesign from the reference image (sidebar with job-search card, top search `Ctrl K`, dashboard: stat cards, Overview chart, source tiles, goals, recent matches, CSV export);
resume upload/paste with skill/title/years extraction feeding the search and the AI packet; company career boards (Greenhouse/Lever/Ashby); platform search links (LinkedIn, Naukri,
Indeed India, Google Jobs, Google/Microsoft/Amazon/Accenture careers); context-aware skill detection (no more "express your interest" = Express.js); migration 0005; monthly stats/goals API.

## Not built, on purpose
Automatic submission of applications and any LinkedIn/Naukri/Indeed access (terms violations, bans, CAPTCHAs, and risk of inaccurate claims under your name).

## Verification actually performed in the authoring sandbox (no internet)
| Check | Result |
|---|---|
| Pure-logic job tests (22: parsers for RemoteOK/Jobicy/Arbeitnow/Adzuna/Greenhouse/Lever/Ashby, matching, location rules, dedupe, truthfulness checks, prompt safety, resume analysis on the owner's real resume text) executed with stand-ins for pytest/defusedxml | **22 / 22 passed** (bugs found and fixed by them: "Remote" locations not treated as open, Lever `None` tags, resume skill ordering, generic skills as keywords) |
| Pure AI tests re-run after the matching change | 11 / 13 pass; the 2 "failures" are limits of my pytest/defusedxml stand-ins (need real `pytest` and `defusedxml`), not code failures |
| `node --test` (job helpers, platform links, CSV export safety, percent change) | **32 / 32 passed** |
| `py_compile` of all backend code and tests; model-vs-migration column parity for the 3 new tables | passed |
| `tsc` JSX syntax check, import/export resolution | passed |
| `pytest` (24 API tests in `test_jobs_api.py`, incl. boards, resume upload/validation/privacy, stats, goals: ON/OFF gating, no fetch while OFF, dedupe, rate limits, source failure isolation, status workflow, AI packet flags, daily limit, scheduler) | **NOT RUN** |
| `alembic upgrade head` on Postgres (0004, 0005), `next build`, real calls to the job APIs, real AI call, browser check | **NOT RUN** |

## Known risks
- Response shapes of the four APIs come from their public documentation and tests use fixtures built from it; real responses may differ slightly. Parsers are defensive, but expect small fixes on first live run.
- Adzuna query parameters (country `in`, `what`, `where`) are from its docs and untested against the live service.
- Free-plan API sleep: scheduled searches only run when something wakes the API.
