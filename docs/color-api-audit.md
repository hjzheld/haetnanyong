# Color API audit

Defaults: project `#557558`, task `#C98B8B`, event `#8E8AA3`.

Tasks/events store their own color. Project-linked items display the current project color, so changing a project color updates all child displays without copying values into child rows. List and mutation responses expose the stored color; calendar/dashboard responses expose the effective display color. The frontend resolves the project color for list rows and locks the inherited color input.

Fixed:

- Color-only PATCH validation and persistence for tasks/events.
- Explicit PostgreSQL parameter types in standalone/project UNION inserts.
- Direct user ownership for standalone event edits/deletes and reminder reads/scheduling/cancellation/Slack connection guards.
- Dashboard standalone coverage, archived project exclusion, and Korean date overlap.
- Restored reminder form, task status input, immutable event kind during editing, KST labels and exclusive all-day end date.
- Main/detail/calendar colors and standalone edit links.
- OpenAPI nullable project IDs and color fields.

Validation:

- `node scripts/check-api-schema.mjs`: read-only EXPLAIN for API/service/utility queries.
- `node scripts/check-item-colors.mjs`: real PostgreSQL statements against transaction-local temporary tables only; verifies creation, color-only updates, ownership, calendar inheritance and event deletion.
- `npm.cmd run lint`: Nuxt type checking.

Existing databases require migrations 002 and 003; SQL files are not automatically applied on startup. The audit does not modify production schema or user data.
