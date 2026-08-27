-- 021: user reports + ban flag for the minimal admin.
ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_email TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('user','gig','band')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (reporter_email) REFERENCES users(email) ON DELETE CASCADE
);
