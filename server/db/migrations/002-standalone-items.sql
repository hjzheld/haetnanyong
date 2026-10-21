-- Allow tasks and events to exist without belonging to a project.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id bigint;
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id bigint;

UPDATE tasks t SET user_id = p.user_id FROM projects p WHERE t.user_id IS NULL AND p.id = t.project_id;
UPDATE events e SET user_id = p.user_id FROM projects p WHERE e.user_id IS NULL AND p.id = e.project_id;

ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE events ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE events ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE events ADD CONSTRAINT fk_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks (user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_events_user_starts_at ON events (user_id, starts_at);
