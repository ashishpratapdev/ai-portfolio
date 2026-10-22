# Security audit (Phase 3 checklist)

**Method:** code review against the Phase 3 prompt + automated tests written for each control.
**Honest status:** tests have *not yet been executed* (no package access in the authoring sandbox); pure-logic tests for the AI helpers *were* executed.
Run `pytest -v` and treat any failure here as a failed control. This is a developer self-audit, not a third-party penetration test.

| Area | Control | Where | Test |
|---|---|---|---|
| Authentication | bcrypt hashes, JWT HS256 with expiry, deactivated users rejected, constant-ish login timing, failed-login limiter | `security.py`, `routers/auth.py` | `test_auth.py` |
| Authorization | every `/admin/*` router has a router-level admin dependency; AI/blog/inquiry routes included | `routers/*` | `test_auth.py`, `test_ai.py::test_ai_endpoints_require_admin`, `test_blog.py::test_blog_admin_requires_auth` |
| Approval bypass | only `approve()` sets approval; needs admin + exact hash; PATCH forbids state/approval fields (`extra="forbid"`) | `services/blog.py`, `schemas_blog.py` | `test_patch_cannot_set_state_or_approval_fields`, `test_approve_requires_exact_current_hash` |
| Mutation after approval | content change wipes approval (incl. tags/categories/sources); published posts locked | `apply_content` | `test_content_change_after_approval_invalidates_it`, `test_tag_change_…`, `test_published_post_is_locked…` |
| Publish-time revalidation | `publish()` and `publish_due()` re-hash content; conditional UPDATE prevents double publish | `publish_due` | `test_due_publish_revalidates_approval_even_if_content_tampered`, idempotency test |
| AI cannot self-approve | AI posts forced to `in_review`; `assert` after creation; no approve code path in `ai/`; no config flag | `create_post`, `pipeline.run_draft` | `test_ai_draft_lands_in_review…`, `test_config_validation` (rejects `require_approval`) |
| Prompt injection | sources wrapped as data, closing tag neutralised, system prompt forbids following embedded instructions, heuristic flagging, output only goes to a review queue, body rendered without raw HTML | `pipeline.py`, `quality.py`, `lib/markdown.js` | `test_prompt_wraps_sources…`, `test_unsupported_claims_and_injection_are_flagged`, `markdown.test.js` |
| SSRF / fetch safety | http(s) only, ports 80/443, approved domains per hop, public-IP check, manual redirects (≤3), 1 MB cap, 10 s timeout, robots.txt honoured | `ai/research.py` | `test_ssrf_guard_blocks_private_hosts…` |
| XML attacks | `defusedxml` for feeds | `research.parse_feed` | `test_malformed_and_entity_bomb_feeds_rejected` |
| Stored XSS | no `dangerouslySetInnerHTML` for user content; Markdown → React nodes; link schemes allow-listed; JSON-LD escaped | `components/Markdown.js`, `lib/seo.js` | `markdown.test.js` |
| CORS | explicit origins; `*` refused at startup; no credentials | `config.py`, `main.py` | `test_cors_rejects_unlisted_origin` |
| CSRF | admin token in httpOnly SameSite=Strict cookie, never in JS; proxy requires same-origin `Origin` on writes; API itself uses bearer headers (not cookies) | `lib/server-auth.js`, proxy route | manual check (no automated frontend test) |
| Rate limits | login (in-memory), contact (DB-backed, per salted-IP-hash + global), AI manual discovery (1/h), AI daily/monthly budgets | `security.py`, `contact.py`, `jobs.py` | `test_contact_seo.py`, `test_ai.py` budgets |
| Spam | honeypot, link-heavy → `spam` status, no auto-email | `contact.py` | `test_contact_seo.py` |
| Privacy | raw IPs never stored (salted hash); inquiries deletable | `contact.py` | `test_contact_valid_is_saved_privately` |
| Uploads | type allow-list, magic bytes, 5 MB cap, random names, private by default, nosniff, path-traversal guard | `routers/media.py` | `test_media.py` |
| Secrets | env only; `.env.example` placeholders; AI key server-side; provider errors never echo headers/bodies; weak `SECRET_KEY` refused | `config.py`, `provider.py` | `test_anthropic_provider_refuses…` |
| Logs/errors | job errors truncated to 300 chars, exception text only; audit log for admin and system actions | `jobs.py`, `deps.audit` | `test_history_and_audit` |
| Caching / leakage | public API single `_live()` predicate; admin responses `no-store`; Next fetch cache only holds public API responses (≤60 s stale after unpublish) | `blog_public.py`, `main.py` | `test_only_non_public_states_hidden_everywhere` |
| Worker endpoint | token compare with `hmac.compare_digest`; disabled when token unset; bounded work | `routers/worker.py` | `test_worker_token_protection` |
| Provider failure | retryable vs permanent errors, bounded retries with backoff, no partial posts | `jobs.py` | retry/bounded/invalid-output tests |
| Time zones | storage in UTC; schedule input requires offset; budgets/schedules use configured IANA zone | `services/blog.py`, `jobs.py` | schedule tests, `test_scheduled_discovery…` |

## Known residual risks (not fixed)
1. Login limiter is per-process memory; multiple workers weaken it. Put the app behind a WAF or move the counter to the DB/Redis.
2. DNS-rebinding between the public-IP check and the connection is not fully closed (documented limitation of the stdlib approach).
3. JWTs are not revocable before expiry (60 min default) except by deactivating the admin user.
4. No security headers CSP on the Next.js app yet (basic headers only). Add a CSP once your analytics choice is final.
5. Single admin role; any admin can approve. Add roles if you add collaborators.
6. AI quality checks are heuristics. They reduce risk; they do not prove claims true. Human review is the control.
7. Dependencies are not pinned/locked. Generate lock files (`pip freeze`, `package-lock.json`) and run `pip-audit` / `npm audit` before launch.
