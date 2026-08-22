-- 009: in-app messaging. One thread per application — thread_type 'gig' keys
-- gig_applications.id, 'seat' keys seat_applications.id. Participants are the
-- applicant and the gig poster / band owner; nobody else can read or post.
-- Applied 2026-08-22.
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_type TEXT NOT NULL CHECK(thread_type IN ('gig','seat')),
  thread_id INTEGER NOT NULL,
  sender_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_read INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sender_email) REFERENCES users(email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_type, thread_id, id);
