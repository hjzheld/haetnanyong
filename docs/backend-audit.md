# Neon / backend audit

Historical audit record: SQL checks and schema observations below describe that audit run. They do not establish the current production migration state. See [current database setup](../server/db/README.md) and [latest documentation review](documentation-consistency-2026-10-22.md).

The live Neon schema was read using information_schema and pg_catalog. No production rows or schema were modified by the audit.

## Fixed

- Validate JSON object bodies before accessing fields; missing bodies and wrong field types return 400.
- Validate BIGINT path/foreign IDs, text lengths, date formats, timestamp timezones, task priorities and statuses.
- Match users.nickname, sessions.token_hash/revoked_at and project-based ownership of tasks/events/reminders.
- Map PostgreSQL constraint violations to 400 and unique conflicts to 409.
- Preserve passwords exactly, including spaces; reject unsupported stored password hashes without crashing.
- Allow clearing task/event descriptions explicitly with null.
- Increment event version when editing. Block edits while a reminder needs cancellation or reconciliation.
- Reserve a reminder DB row before calling Slack. Preserve uncertain scheduling outcomes as UNKNOWN; prevent duplicate scheduling.
- Reuse the unique event reminder row only after cancellation, incrementing revision.
- Cancel using the saved Slack channel. Preserve cancellation failures and cancel reservations before deleting events.
- Replace the incomplete local schema document with a live schema snapshot (including lengths, identities, constraints and indexes).
- Replace Swagger with explicit tags, operation responses, request bodies for every create/update operation, BIGINT examples and actual API field names.

## Verification

- `npm run build`: production build.
- `npm run lint`: TypeScript check. The existing vue-router/volar/sfc-route-blocks export warning is separate from backend type checking.
- `node scripts/check-api-schema.mjs`: EXPLAIN (without ANALYZE) checks SQL against Neon without executing changes.
- `node scripts/export-schema.mjs`: prints a read-only schema snapshot; does not apply it.
- HTTP checks: Swagger JSON/HTML, all operation tags/responses/request bodies, malformed auth requests, unauthenticated resource requests.
- Input checks: absent/invalid bodies, BIGINT bounds, invalid dates, password whitespace preservation.

## Operational limits

- Slack delivery/cancellation was not invoked during validation. UNKNOWN reservations require reconciliation with Slack before retrying; the internal cancellation cron also reconciles outstanding reminders. See `code-audit-2026-10-22.md` for the latest review and limits.
- Event PATCH edits fields within the existing timed/all-day type; changing allDay is not supported.
- schema.sql is a fresh-database snapshot, not a migration to rerun against the existing database.
- Backend code now catches SQL constraint errors; EXPLAIN validates names/types but does not prove all data-dependent constraints or external Slack outcomes.
