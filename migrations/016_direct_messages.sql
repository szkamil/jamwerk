-- 016: direct messages between musicians (thread_type 'dm'), opt-out flag on the
-- musician profile, messages CHECK rebuilt once more to allow 'dm'.
ALTER TABLE musician_details ADD COLUMN accepts_dm INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS dm_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  a_email TEXT NOT NULL,
  b_email TEXT NOT NULL,
  started_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(a_email, b_email),
  FOREIGN KEY (a_email) REFERENCES users(email) ON DELETE CASCADE,
  FOREIGN KEY (b_email) REFERENCES users(email) ON DELETE CASCADE
);
CREATE TABLE messages_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_type TEXT NOT NULL CHECK(thread_type IN ('gig','seat','band','dm')),
  thread_id INTEGER NOT NULL,
  sender_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_read INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sender_email) REFERENCES users(email) ON DELETE CASCADE
);
INSERT INTO messages_new (id, thread_type, thread_id, sender_email, body, created_at, is_read)
  SELECT id, thread_type, thread_id, sender_email, body, created_at, is_read FROM messages;
DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_type, thread_id, id);
