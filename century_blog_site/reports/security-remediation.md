# Security remediation — Phase 1

## Critical: credential-like value in Git history
The public README on main contains an admin password-looking value. It has been replaced by placeholders **only on the working branch**. The original remains in main and prior history until a reviewed release/history remediation.

Required operator actions:
1. Check whether the prior value was used anywhere, without disclosing it.
2. Rotate affected Vercel `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`; the latter invalidates previous signed sessions. Coordinate to avoid lockout.
3. Check password reuse, admin activity and unauthorized access; revoke any other compromised credentials.
4. Merge the README redaction only after review. Assess history rewrite with collaborators and forks before proceeding.
5. Scan git history and deployment logs for other secrets using an approved secret scanner.

## High
- Convert per-instance rate limiter to a durable distributed backend before relying on it for security.
- Harden `/api/image-proxy` against DNS rebinding, unsafe redirects, unbounded responses, abuse and excessive resource consumption; consider allowlisting trusted image hosts.
- Verify public-facing engagement and subscription endpoints are resistant to spam and allow proper moderation.
- Review session role changes, 7-day session lifetimes, and current cookies.
- Verify stored data privacy and Cloudinary delivery types, particularly authenticated user and subscriber data.

No production secrets rotated, no real audit log inspected and no production impact claimed.
