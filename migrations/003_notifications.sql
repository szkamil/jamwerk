-- 003: email confirmation + password reset columns, and the rate-limit table.
-- NOT idempotent (ALTER ADD COLUMN) — run once. Applied to jamwerk-db 2026-08-21.
ALTER TABLE users ADD COLUMN confirmed INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN confirm_token TEXT;
ALTER TABLE users ADD COLUMN reset_token TEXT;
ALTER TABLE users ADD COLUMN reset_expires TEXT;
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  action TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(ip, action, attempted_at);
