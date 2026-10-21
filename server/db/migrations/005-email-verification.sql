BEGIN;

-- Email delivery is currently disabled in the application. These columns and
-- tokens are retained because this migration has already been applied in Neon.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_created
  ON email_verification_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires
  ON email_verification_tokens (expires_at);

-- Existing accounts predate verification, so keep them usable.
UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at);

COMMIT;
