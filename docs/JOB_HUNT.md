# Job hunt (Phase 4)

Finds jobs from public job APIs, scores each against **your** resume, and prepares an honest application packet (cover letter + resume
highlights). **You** read it and press apply on the job's own page. Admin → **Job hunt**.

## The ON/OFF switch
The master switch is the only thing that lets the app contact job sites. Default: **OFF**.
- OFF: "Search now" returns 409, the scheduler (`/worker/tick`, `python -m app.worker tick`) does nothing for jobs, no HTTP request is made to any job site.
- ON: "Search now" works (at most once per 10 min) and the scheduler searches when due (every `interval_hours`, minimum 6).
- Turning it on/off is audited. It is a separate endpoint (`POST /api/v1/admin/jobs/toggle`); the settings form cannot change it.
- Your saved jobs and AI packets stay available while OFF. Preparing a packet (AI) is a manual click and works while OFF, limited by "AI packets per day".

## Sources (official public APIs only)
| Source | Key | Notes |
|---|---|---|
| RemoteOK `remoteok.com/api` | none | remote jobs; terms require a followed link back (every job links to its RemoteOK page) |
| Jobicy `jobicy.com/api/v2` | none | remote jobs, low rate limit (max 2 calls/search) |
| Arbeitnow `arbeitnow.com/api` | none | mostly Europe; on-site jobs outside your locations are skipped |
| Adzuna India | free `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (developer.adzuna.com) | the only source of local Indian jobs; skipped with a clear message if keys are missing |

Each source is fetched at most every 30 min (manual) / 3 h (scheduled). One failing source never stops the others. All requests go through the same
SSRF-safe fetcher as the blog research (approved hosts only, size cap, timeouts).

**Deliberately not included:** LinkedIn, Naukri, Indeed (no public API; scraping or bot-applying breaks their terms and gets accounts banned) and
Remotive/Himalayas (their terms restrict passing listings on to other boards/aggregators). Platforms do not offer a legitimate way to apply on your
behalf, so the app never submits applications.

## Matching (no AI, fully explainable)
Score 0-100: skills you have that the job asks for (title > tags > description), keyword in title (+20), location fit (+10), junior-friendly (+8),
senior titles (-30), "N+ years" far above your `my_years` (up to -25). Excluded titles (senior, lead, manager...) are dropped; remote jobs limited to
other regions (e.g. "USA only") are dropped. Every card shows matched skills (✓) and missing ones (✗). Duplicates (same company + title, even across
boards) are stored once; dismissed jobs never come back. Listings older than 45 days are ignored.

## Application packet (AI, truth-checked)
"Prepare with AI" sends the AI ONLY your verified profile facts (name, headline, bio, skills, roles) and the job text (marked as untrusted data).
It must not invent skills, years, metrics, or employers. A separate checker flags anything suspicious for you to fix: skills not in your profile,
"N years" above yours, percentages/"improved by" claims, placeholder text, prompt-injection phrases in the job post, gaps. Red notes mean "fix before sending".
With `AI_PROVIDER=mock` the letter is a clearly-marked fake; set `AI_PROVIDER=anthropic` + key + model for real drafts (billed by your provider).

## Tracker
new → saved → ready → applied → interview → offer / rejected, or dismissed. "I applied" only records that YOU applied (asks for confirmation).

## Setup
1. `alembic upgrade head` (migration 0004).
2. Optional: set `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` on the API host.
3. Admin → Job hunt → Settings: check keywords, locations, `my_years`, sources → Save. Turn the switch ON → "Search now".
4. For automatic runs, call `POST /api/v1/worker/tick` (see docs/DEPLOYMENT.md §4). On the free Render plan the API sleeps, so automatic runs only happen when something wakes it.

## Limits to know
- Free job APIs show a limited, mostly remote/international slice of the market, not every job on every platform.
- Scores are heuristics. Read the posting yourself.
- Third-party terms and APIs can change: check each source's current terms before relying on it.
