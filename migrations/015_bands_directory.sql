-- 015: bands as a directory — kind (band | jam group), bookable + fee-from + pitch,
-- and booking inquiries as a third message thread type (messages CHECK rebuilt).
ALTER TABLE bands ADD COLUMN kind TEXT NOT NULL DEFAULT 'band' CHECK(kind IN ('band','jam'));
ALTER TABLE bands ADD COLUMN bookable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bands ADD COLUMN fee_from INTEGER;
ALTER TABLE bands ADD COLUMN fee_currency TEXT NOT NULL DEFAULT 'CHF' CHECK(fee_currency IN ('CHF','EUR'));
ALTER TABLE bands ADD COLUMN pitch TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS band_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  band_id INTEGER NOT NULL,
  from_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(band_id, from_email),
  FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE,
  FOREIGN KEY (from_email) REFERENCES users(email) ON DELETE CASCADE
);
CREATE TABLE messages_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_type TEXT NOT NULL CHECK(thread_type IN ('gig','seat','band')),
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
