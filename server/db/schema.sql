-- Read-only snapshot exported from Neon. For a fresh database; not an in-place migration.

CREATE TABLE "events" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "user_id" bigint NOT NULL,
  "project_id" bigint,
  "title" character varying(200) NOT NULL,
  "description" text,
  "color" character varying(7) DEFAULT '#8E8AA3' NOT NULL,
  "is_all_day" boolean DEFAULT false NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "start_date" date,
  "end_date" date,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "projects" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "user_id" bigint NOT NULL,
  "name" character varying(150) NOT NULL,
  "description" text,
  "color" character varying(7) DEFAULT '#557558'::character varying NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "reminders" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "event_id" bigint NOT NULL,
  "timing_type" character varying(20) NOT NULL,
  "offset_minutes" integer,
  "remind_at" timestamp with time zone NOT NULL,
  "status" character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "idempotency_key" character varying(100) NOT NULL,
  "slack_dm_channel_id" character varying(50),
  "slack_scheduled_message_id" character varying(100),
  "reservation_accepted_at" timestamp with time zone,
  "canceled_at" timestamp with time zone,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "last_error_code" character varying(100),
  "last_error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sessions" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "user_id" bigint NOT NULL,
  "token_hash" character varying(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tasks" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "user_id" bigint NOT NULL,
  "project_id" bigint,
  "title" character varying(200) NOT NULL,
  "description" text,
  "color" character varying(7) DEFAULT '#C98B8B' NOT NULL,
  "start_date" date NOT NULL,
  "due_date" date NOT NULL,
  "status" character varying(20) DEFAULT 'TODO'::character varying NOT NULL,
  "priority" character varying(20) DEFAULT 'MEDIUM'::character varying NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "email" character varying(254) NOT NULL,
  "nickname" character varying(100) DEFAULT ('냥이_'::text || upper(SUBSTRING(md5((random())::text) FROM 1 FOR 4))) NOT NULL,
  "password_hash" text NOT NULL,
  "slack_workspace_id" character varying(50),
  "slack_user_id" character varying(50),
  "slack_dm_channel_id" character varying(50),
  "slack_connected_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "events" ADD CONSTRAINT "chk_events_dates" CHECK ((((is_all_day = false) AND (starts_at IS NOT NULL) AND (ends_at IS NOT NULL) AND (starts_at < ends_at) AND (start_date IS NULL) AND (end_date IS NULL)) OR ((is_all_day = true) AND (start_date IS NOT NULL) AND (end_date IS NOT NULL) AND (start_date < end_date) AND (starts_at IS NULL) AND (ends_at IS NULL))));
ALTER TABLE "events" ADD CONSTRAINT "chk_events_title" CHECK ((length(TRIM(BOTH FROM title)) > 0));
ALTER TABLE "events" ADD CONSTRAINT "chk_events_color" CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "events" ADD CONSTRAINT "chk_events_version" CHECK ((version >= 1));
ALTER TABLE "events" ADD CONSTRAINT "events_pkey" PRIMARY KEY (id);
ALTER TABLE "events" ADD CONSTRAINT "fk_events_project" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;
ALTER TABLE "events" ADD CONSTRAINT "fk_events_user" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "chk_projects_color" CHECK (((color)::text ~ '^#[0-9A-Fa-f]{6}$'::text));
ALTER TABLE "projects" ADD CONSTRAINT "chk_projects_name" CHECK ((length(TRIM(BOTH FROM name)) > 0));
ALTER TABLE "projects" ADD CONSTRAINT "fk_projects_user" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY (id);
ALTER TABLE "reminders" ADD CONSTRAINT "chk_reminders_attempt_count" CHECK ((attempt_count >= 0));
ALTER TABLE "reminders" ADD CONSTRAINT "chk_reminders_canceled" CHECK ((((status)::text <> 'CANCELED'::text) OR (canceled_at IS NOT NULL)));
ALTER TABLE "reminders" ADD CONSTRAINT "chk_reminders_offset" CHECK (((((timing_type)::text = 'BEFORE_START'::text) AND (offset_minutes IS NOT NULL) AND (offset_minutes = ANY (ARRAY[10, 30]))) OR (((timing_type)::text = 'CUSTOM'::text) AND (offset_minutes IS NULL))));
ALTER TABLE "reminders" ADD CONSTRAINT "chk_reminders_revision" CHECK ((revision >= 1));
ALTER TABLE "reminders" ADD CONSTRAINT "chk_reminders_scheduled" CHECK ((((status)::text <> 'SCHEDULED'::text) OR ((slack_dm_channel_id IS NOT NULL) AND (slack_scheduled_message_id IS NOT NULL) AND (reservation_accepted_at IS NOT NULL))));
ALTER TABLE "reminders" ADD CONSTRAINT "chk_reminders_status" CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'SCHEDULING'::character varying, 'SCHEDULED'::character varying, 'FAILED'::character varying, 'UNKNOWN'::character varying, 'CANCEL_PENDING'::character varying, 'CANCELED'::character varying, 'CANCEL_FAILED'::character varying, 'ELAPSED'::character varying])::text[])));
ALTER TABLE "reminders" ADD CONSTRAINT "chk_reminders_timing_type" CHECK (((timing_type)::text = ANY ((ARRAY['BEFORE_START'::character varying, 'CUSTOM'::character varying])::text[])));
ALTER TABLE "reminders" ADD CONSTRAINT "fk_reminders_event" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_event_id_key" UNIQUE (event_id);
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_idempotency_key_key" UNIQUE (idempotency_key);
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_pkey" PRIMARY KEY (id);
ALTER TABLE "sessions" ADD CONSTRAINT "chk_sessions_expiry" CHECK ((expires_at > created_at));
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_user" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_pkey" PRIMARY KEY (id);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_hash_key" UNIQUE (token_hash);
ALTER TABLE "tasks" ADD CONSTRAINT "chk_tasks_completion" CHECK (((((status)::text = 'DONE'::text) AND (completed_at IS NOT NULL)) OR (((status)::text <> 'DONE'::text) AND (completed_at IS NULL))));
ALTER TABLE "tasks" ADD CONSTRAINT "chk_tasks_date_range" CHECK ((start_date <= due_date));
ALTER TABLE "tasks" ADD CONSTRAINT "chk_tasks_priority" CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying])::text[])));
ALTER TABLE "tasks" ADD CONSTRAINT "chk_tasks_status" CHECK (((status)::text = ANY ((ARRAY['TODO'::character varying, 'IN_PROGRESS'::character varying, 'DONE'::character varying])::text[])));
ALTER TABLE "tasks" ADD CONSTRAINT "chk_tasks_title" CHECK ((length(TRIM(BOTH FROM title)) > 0));
ALTER TABLE "tasks" ADD CONSTRAINT "chk_tasks_color" CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_project" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;
ALTER TABLE "tasks" ADD CONSTRAINT "fk_tasks_user" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_pkey" PRIMARY KEY (id);
ALTER TABLE "users" ADD CONSTRAINT "chk_users_nickname" CHECK (((length(TRIM(BOTH FROM nickname)) >= 2) AND (length(TRIM(BOTH FROM nickname)) <= 30)));
ALTER TABLE "users" ADD CONSTRAINT "chk_users_slack_connection" CHECK ((((slack_workspace_id IS NULL) AND (slack_user_id IS NULL) AND (slack_dm_channel_id IS NULL) AND (slack_connected_at IS NULL)) OR ((slack_workspace_id IS NOT NULL) AND (slack_user_id IS NOT NULL) AND (slack_dm_channel_id IS NOT NULL) AND (slack_connected_at IS NOT NULL))));
ALTER TABLE "users" ADD CONSTRAINT "uq_users_nickname" UNIQUE (nickname);
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE (email);
ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (id);
CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);
CREATE INDEX idx_projects_user_archived ON public.projects USING btree (user_id, archived_at);
CREATE INDEX idx_tasks_project_due_date ON public.tasks USING btree (project_id, due_date);
CREATE INDEX idx_events_project_starts_at ON public.events USING btree (project_id, starts_at);
CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);
CREATE INDEX idx_tasks_project_start_date ON public.tasks USING btree (project_id, start_date);
CREATE INDEX idx_tasks_project_status ON public.tasks USING btree (project_id, status);
CREATE INDEX idx_reminders_status_remind_at ON public.reminders USING btree (status, remind_at);
CREATE INDEX idx_events_project_start_date ON public.events USING btree (project_id, start_date);
