-- 022: weekly e-mail digest opt-out + last-sent marker.
ALTER TABLE users ADD COLUMN digest INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN digest_sent_at TEXT;
