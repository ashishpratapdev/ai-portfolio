# Phase 4 Report: Job hunt

## Implemented
Master ON/OFF switch (default OFF, gates manual + scheduled fetching), 4 public sources (RemoteOK, Jobicy, Arbeitnow, Adzuna India with optional key),
explainable resume-fit scoring, filtering (exclude keywords, region-restricted remote jobs, age), cross-source dedupe, per-source rate-limit gaps,
AI application packet (cover letter + highlights) restricted to verified profile facts with a truthfulness checker, tracker statuses/notes, run history,
scheduler hook, admin "Job hunt" page (switch, settings, filters, fit chips, side panel with editable letter, copy, open-job-page, "I applied"),
migration 0004, `docs/JOB_HUNT.md`.

## Not built, on purpose
Automatic submission of applications and any LinkedIn/Naukri/Indeed access (terms violations, bans, CAPTCHAs, and risk of inaccurate claims under your name).

## Verification actually performed in the authoring sandbox (no internet)
| Check | Result |
|---|---|
| Pure-logic job tests (16: parsers for all 4 APIs, matching, location rules, dedupe, truthfulness checks, prompt safety) executed with stand-ins for pytest/defusedxml | **16 / 16 passed** (found and fixed one real bug: "Remote" locations were not treated as open) |
| `node --test` (adds 4 tests for the job page helpers) | **28 / 28 passed** |
| `py_compile` of all backend code and tests; model-vs-migration column parity for the 3 new tables | passed |
| `tsc` JSX syntax check, import/export resolution | passed |
| `pytest` (adds ~17 API tests in `test_jobs_api.py`: ON/OFF gating, no fetch while OFF, dedupe, rate limits, source failure isolation, status workflow, AI packet flags, daily limit, scheduler) | **NOT RUN** |
| `alembic upgrade head` on Postgres, `next build`, real calls to the job APIs, real AI call, browser check | **NOT RUN** |

## Known risks
- Response shapes of the four APIs come from their public documentation and tests use fixtures built from it; real responses may differ slightly. Parsers are defensive, but expect small fixes on first live run.
- Adzuna query parameters (country `in`, `what`, `where`) are from its docs and untested against the live service.
- Free-plan API sleep: scheduled searches only run when something wakes the API.
