ALTER TABLE projects ALTER COLUMN color SET DEFAULT '#557558';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS color varchar(7) NOT NULL DEFAULT '#C98B8B';
ALTER TABLE events ADD COLUMN IF NOT EXISTS color varchar(7) NOT NULL DEFAULT '#8E8AA3';
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE events ADD CONSTRAINT chk_events_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
