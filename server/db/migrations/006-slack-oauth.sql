BEGIN;
CREATE TABLE IF NOT EXISTS slack_installations (
  workspace_id varchar(50) PRIMARY KEY,
  encrypted_bot_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Retain routing for pending account-deletion cancellation jobs.
CREATE TABLE IF NOT EXISTS slack_channel_installations (
  channel_id varchar(50) PRIMARY KEY,
  workspace_id varchar(50) NOT NULL REFERENCES slack_installations(workspace_id)
);
CREATE TABLE IF NOT EXISTS slack_oauth_states (
  state_hash varchar(64) PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slack_oauth_states_expiry ON slack_oauth_states(expires_at);
COMMIT;
