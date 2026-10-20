-- Run once against the Neon database if users already existed before auth was added.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- After every existing user has a valid scrypt hash, enforce the application contract:
-- ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
