# Data migration plan — Phase 1 design, NOT EXECUTED

1. Inventory Cloudinary remote JSON objects and authoritative production posts; do not use checked-in JSON as complete production truth.
2. Export timestamped immutable backups with secure hashes and restricted access.
3. Snapshot article IDs, slugs, revisions, dates, media credits, roles, comments, reactions, draft states and subscriber consent.
4. Build PostgreSQL schema and relational mapping on isolated staging.
5. Create idempotent import, dry-run diffs and count/hash reconciliation.
6. Run concurrency, rollback and URL preservation tests.
7. Plan short controlled cutover, with write freeze or dual-write protocol after careful testing.
8. Keep old storage until signed-off reconciliation and restoration verification.

No migration, export or database write has occurred.
