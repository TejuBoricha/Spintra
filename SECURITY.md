# Security Policy

Spintra takes the security of our real-time social gaming lounge and our players' privacy seriously.

---

## Supported Versions

Only the latest commit on `main` receives security updates and patches.

| Version | Supported |
|---|---|
| Latest `main` (Production) | :white_check_mark: |
| Older releases / commits | :x: |

---

## Security Architecture & Defenses

1. **Anonymous Authentication & Row-Level Security (RLS)**:
   - Every participant uses Supabase Anonymous Auth (`auth.users` row) without password exposure or personal email requirements.
   - All 26 public schema database tables enforce strict RLS policies tied to `auth.uid()`.
   - Direct mutations on high-stakes entities (room locks, host elections, match states, scoring) are restricted to `SECURITY DEFINER` RPCs and host verification triggers.
2. **Transaction-Scoped Advisory Locks**:
   - Critical concurrency paths (`elect_room_host`, `city_join_seat`, `_record_award`, room join caps) utilize PostgreSQL advisory transaction locks (`pg_advisory_xact_lock`) to serialize race conditions without table lock contention.
3. **Automated Dependency Auditing**:
   - CI executes strict `npm run audit` at the `moderate` severity threshold on every push via `scripts/audit-gate.mjs`.

---

## Reporting a Vulnerability

If you discover a security vulnerability or exploit in Spintra, please **do not open a public GitHub issue**.

Instead, report it responsibly via GitHub Private Vulnerability Reporting:
1. Navigate to the **Security** tab of the Spintra repository.
2. Select **Advisories** and click **Report a vulnerability**.
3. Include detailed reproduction steps, network requests, and impact assessments.

We will acknowledge receipt within 48 hours and coordinate remediation before public disclosure.
