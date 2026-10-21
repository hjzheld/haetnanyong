# Standalone items

The main navigation entry **일정·태스크** opens `/items`, which lists only the signed-in user's tasks/events with no project.

Routes:

- `/items/tasks/new` and `/items/events/new`: registration pages.
- `/items/tasks/:id` and `/items/events/:id`: detail pages.
- `/items/tasks/:id/edit` and `/items/events/:id/edit`: edit pages.

Detail pages support deletion, task completion/reopening, and event Slack reminder setup/cancellation. Project-linked items continue to be managed in the project view. Direct links to those items redirect to their project.

Calendar remains a color-coded read-only overview. Registration buttons, day-click registration, and inline editing were removed. Standalone entries in the calendar and home dashboard link to their detail pages. Calendar has a “프로젝트 없음” filter.

API additions:

- `GET /api/tasks/:id` and `GET /api/events/:id`: authenticated owner-only detail lookup; invalid IDs return 400, missing/other-user items return 404.
- `GET /api/tasks?scope=standalone` and `GET /api/events?scope=standalone`: filter by `project_id IS NULL` on the server; omitted scope preserves the existing complete list.

Existing POST/PATCH/DELETE endpoints handle saves and deletions. Existing reminder endpoints handle scheduling/cancellation. No additional database migration is required.
