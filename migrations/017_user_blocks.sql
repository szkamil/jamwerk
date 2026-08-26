-- 017: users can block each other (messages, DMs, band inquiries).
-- One-way blocks: the blocker no longer receives messages/inquiries from the blocked user
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_email TEXT NOT NULL,
  blocked_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_email, blocked_email),
  FOREIGN KEY (blocker_email) REFERENCES users(email) ON DELETE CASCADE,
  FOREIGN KEY (blocked_email) REFERENCES users(email) ON DELETE CASCADE
);
