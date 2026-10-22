-- Apply separately in the database migration workflow. No data is changed.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_events_user_starts_at ON events (user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_events_user_start_date ON events (user_id, start_date);
COMMIT;
