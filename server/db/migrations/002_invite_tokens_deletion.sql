-- Partner invite tokens (email link-based invites)
CREATE TABLE IF NOT EXISTS partner_invite_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,
  email       TEXT    NOT NULL COLLATE NOCASE,    -- who was invited
  share_habit_names INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT    NOT NULL,
  accepted_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_inviter ON partner_invite_tokens(inviter_id);

-- Account deletion requests (7-day grace period)
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at TEXT    NOT NULL,  -- when the delete will actually fire
  cancelled    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Add motivational_note column to habits (shown at check-in time in Focus Mode)
ALTER TABLE habits ADD COLUMN motivational_note TEXT NOT NULL DEFAULT '';

-- Add day_reset_hour to users settings — track per-user (also in settings_json but mirrored here for query efficiency)
-- No separate column; stored in settings_json.dayResetHour (0-23, default 3)
-- This comment is intentional to document the convention.

-- Ensure password_reset_tokens has an index on user_id for cleanup queries
CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_expires ON password_reset_tokens(expires_at);
