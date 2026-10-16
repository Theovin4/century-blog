# Rollback — Phase 1

All code changes are isolated on `improve/editorial-adsense-readiness-20261016`; production main has not been changed. The safest immediate rollback is to **not merge or deploy the branch**.

Before staging deployment: note the last known good deployment ID, secret configuration, runtime flags and backing-data snapshot.

For any later cutover: maintain immutable verified content backups; test restore to isolated destination; preserve slugs and canonical URLs; use a release checklist and approval gate.

Never use a deployment rollback as a substitute for restoring migrated data. Secrets rotation must be coordinated, not undone to exposed values.
