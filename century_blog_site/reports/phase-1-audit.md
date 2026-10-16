# Century Blog — Phase 1 audit (2026-10-16)

Scope: code-level review of `Theovin4/century-blog`, application directory `century_blog_site`. Dedicated branch `improve/editorial-adsense-readiness-20261016`. No production environment access, production database write, DNS modification, or deployment.

## Confirmed from repository
- Next.js 16 / React 19, bespoke newsroom dashboard, Cloudinary-hosted JSON persistence with local seed fallback.
- Canonical website configured as https://www.centuryblog.com.ng with redirects for several legacy Vercel routes.
- XML and news XML sitemap route handlers, robots metadata, organization/article structured data and AdSense metadata/ads.txt exist in code.
- `README.md` contained a credential-like password in public commit history. Latest branch README has been redacted; secret rotation and history response remain outstanding.
- `lib/auto-news.js` directly published candidates satisfying its quality gate. On this branch changed to review-only draft creation.
- `lib/content-quality.js` uses minimum word thresholds (900/1200/1600/1800) and compulsory structural sections in the indexing gate. This can exclude useful concise reporting. Change only following content inventory and tests.
- `lib/json-store.js` uses Cloudinary and local files with caching, not a relational transactional store. Whole-document changes merit concurrency/data-loss review.
- `lib/rate-limit.js` uses in-process Map: rate limiting not shared across serverless instances.
- Public image proxy performs DNS checks but unbounded upstream fetch occurs before size check; redirect/DNS rebinding, memory and cost protections need review.
- `app/api/submissions/route.js` may claim newsletter success after storing a local record without verified subscription delivery.
- Auto draft publishing endpoint requires reviewer permission; broader publishing permissions and audit trail require comprehensive verification.

## Requires live verification
- Actual 200 response, XML correctness and indexing of sitemap and news sitemap.
- Search Console exclusions, AdSense rejection diagnosis, GA4 events and traffic baselines.
- Production configured secrets, permissions, Cloudinary content inventory and backup restoration.
- Performance and cross-browser results.
- Credential exposure history and whether the example was ever a real production password.

## Recommended release order
1. Rotate any exposed credentials and validate backups.
2. Test and approve automated publication halt (draft-only patch).
3. Inventory current production articles and verify backup/restore.
4. Editorial remediation with human verification.
5. Relational migration on isolated staging; prevent slug/ID loss.
6. UI/UX redesign and crawl validation, then production review.

## Limitations
Connected GitHub read/write supports branch edits; no local repository checkout was available from the environment for running the project build. Do not claim a passing build or successful production deployment. No backup of live Cloudinary state was performed.
