-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT  NOT NULL,
  settings_json TEXT  NOT NULL DEFAULT '{}',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);

-- Habits table
CREATE TABLE IF NOT EXISTS habits (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT    NOT NULL,
  description          TEXT    NOT NULL DEFAULT '',
  color                TEXT    NOT NULL DEFAULT '#14b8a6',
  icon                 TEXT    NOT NULL DEFAULT '✅',
  frequency_type       TEXT    NOT NULL DEFAULT 'daily'
                       CHECK(frequency_type IN ('daily','weekly_days','weekly_count','monthly_count')),
  frequency_config_json TEXT   NOT NULL DEFAULT '{}',
  difficulty           TEXT    NOT NULL DEFAULT 'medium'
                       CHECK(difficulty IN ('easy','medium','hard')),
  is_private           INTEGER NOT NULL DEFAULT 0,
  is_archived          INTEGER NOT NULL DEFAULT 0,
  forgiveness_days     INTEGER NOT NULL DEFAULT 1 CHECK(forgiveness_days BETWEEN 0 AND 3),
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_archived ON habits(user_id, is_archived);

-- Check-ins table
CREATE TABLE IF NOT EXISTS checkins (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id     INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checked_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  logical_date TEXT    NOT NULL,  -- YYYY-MM-DD in user's timezone
  note         TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checkins_habit_date ON checkins(habit_id, logical_date);
CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON checkins(user_id, logical_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_unique ON checkins(habit_id, logical_date);

-- Streaks table
CREATE TABLE IF NOT EXISTS streaks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id       INTEGER NOT NULL UNIQUE REFERENCES habits(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak    INTEGER NOT NULL DEFAULT 0,
  last_updated   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Accountability partners
CREATE TABLE IF NOT EXISTS partners (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           TEXT    NOT NULL DEFAULT 'pending'
                   CHECK(status IN ('pending','accepted','declined')),
  share_habit_names INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, partner_user_id)
);

-- Notifications / push subscriptions
CREATE TABLE IF NOT EXISTS notifications (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id              INTEGER REFERENCES habits(id) ON DELETE CASCADE,
  scheduled_time        TEXT,   -- HH:MM in user's local time
  push_subscription_json TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1,
  last_sent_at          TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_habit ON notifications(habit_id);
