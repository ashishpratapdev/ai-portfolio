# Phase 2 Report: SEO, blog CMS, freelance leads

## Implemented
- **Blog data model + migration 0002:** posts, categories, tags, revisions, redirects, inquiries.
- **Workflow (backend-enforced):** draft, in_review, approved, scheduled, published (+ rejected). Transition table in `services/blog.py`; invalid moves → 409.
- **Approval integrity:** SHA-256 content hash; approve needs the exact hash; any content change wipes approval; published posts locked; publish/scheduled publish re-validate.
- **Scheduled publishing:** timezone-aware input, future-only, idempotent `publish_due` (also via CLI and `/worker/tick`).
- **Revisions:** one per real content change (no-ops are skipped), with source and author.
- **Public blog:** `/blog` (search, category/tag filter, pagination), `/blog/[slug]`, related posts, sources list, RSS (`/blog/rss.xml`), cover image + required alt text.
- **SEO:** per-page metadata, canonical URLs, Open Graph/Twitter, `robots.txt` (blocks `/admin`, `/api/`), sitemap from an API that only returns eligible URLs, BlogPosting JSON-LD (escaped), noindex support (posts, filtered/paged blog views), automatic 301 redirect when a published post's slug changes, manual redirects API, optional Search Console verification and Plausible hook (renders nothing unless configured; no fabricated metrics).
- **Caching:** public blog fetches revalidate every 60 s; API never returns non-public content, so caches cannot hold it. Admin responses are `no-store`.
- **Contact inquiries:** validation, honeypot, per-visitor and global DB-backed rate limits (visitor IP forwarded by the Next server only when it presents the shared key; stored as salted hash), link-heavy messages auto-marked `spam`, statuses, admin list/update/delete.
- **Admin UI:** blog list, editor with Markdown preview, SEO fields with counters, workflow panel (submit, approve this revision, reject with reason, publish, schedule, unpublish), revisions, inquiries inbox.
- **Safe Markdown renderer:** no raw HTML, link-scheme allow-list.

## Verification actually performed in the authoring sandbox (no internet)
| Check | Result |
|---|---|
| `py_compile` on all backend modules and tests | passed |
| `tsc` JSX syntax check on all frontend files | no syntax errors |
| `node --test` (format, markdown safety, SEO helpers) | **9 / 9 passed** |
| Static cross-check: every model table/column has a migration column | passed (apart from tooling false positives) |
| `pytest` (backend) | **NOT RUN** |
| `alembic upgrade head` / drift test | **NOT RUN** |
| `next build`, browser checks, Lighthouse/structured-data validator | **NOT RUN** |

## Tests written (not yet executed): `test_blog.py` (19), `test_contact_seo.py` (12)
Blog CRUD, every state transition, hash approval, invalidation after edits (including tags), locked published posts, scheduled publishing + idempotency +
tamper revalidation, redirects, revisions, pagination/search/filter/related, sitemap eligibility, noindex, contact validation/honeypot/spam/rate limits/IP-spoof resistance, redirect validation, security headers.

## Known issues / decisions
- Editing a published post requires unpublishing first (simple, safe; a "live edit with re-approval" flow was not built).
- Contact submissions are stored but **no email notification** is sent (needs an email provider and its terms).
- Rate limiting of contact depends on `INTERNAL_API_KEY` matching on both sides; otherwise all visitors share one bucket.
- Public cache can serve an unpublished post for up to 60 s.
- Sitemap `lastmod` for projects/posts uses `updated_at`.
- No automated frontend component or E2E tests; admin CSRF behaviour needs a manual check.
- Next.js 15/React 19 API usage is from knowledge and unverified against an install.
