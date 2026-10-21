BEGIN;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  endpoint varchar(120) NOT NULL,
  identifier_hash varchar(64) NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (endpoint, identifier_hash, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires_at
  ON api_rate_limits (expires_at);

CREATE TABLE IF NOT EXISTS slack_cancellation_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slack_dm_channel_id varchar(50) NOT NULL,
  slack_scheduled_message_id varchar(100) NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  purge_after timestamptz NOT NULL,
  last_error_code varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slack_dm_channel_id, slack_scheduled_message_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_cancellation_jobs_retry
  ON slack_cancellation_jobs (next_attempt_at, purge_after);

CREATE OR REPLACE FUNCTION delete_user_account(
  target_user_id bigint,
  cancellation_jobs jsonb DEFAULT '[]'::jsonb
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO slack_cancellation_jobs (
    slack_dm_channel_id,
    slack_scheduled_message_id,
    purge_after,
    last_error_code
  )
  SELECT
    job->>'channelId',
    job->>'scheduledMessageId',
    COALESCE((job->>'purgeAfter')::timestamptz, now() + interval '121 days'),
    NULLIF(job->>'errorCode', '')
  FROM jsonb_array_elements(cancellation_jobs) AS job
  WHERE job->>'channelId' IS NOT NULL
    AND job->>'scheduledMessageId' IS NOT NULL
  ON CONFLICT (slack_dm_channel_id, slack_scheduled_message_id)
  DO UPDATE SET
    next_attempt_at = now(),
    purge_after = EXCLUDED.purge_after,
    last_error_code = EXCLUDED.last_error_code,
    updated_at = now();

  DELETE FROM reminders
  WHERE event_id IN (SELECT id FROM events WHERE user_id = target_user_id);
  DELETE FROM events WHERE user_id = target_user_id;
  DELETE FROM tasks WHERE user_id = target_user_id;
  DELETE FROM projects WHERE user_id = target_user_id;
  DELETE FROM sessions WHERE user_id = target_user_id;
  DELETE FROM users WHERE id = target_user_id;
END;
$$;

COMMIT;
