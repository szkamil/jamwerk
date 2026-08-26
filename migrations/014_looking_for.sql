-- 014: what a musician is after (JSON array of dep | jam | join_band | start_band)
ALTER TABLE musician_details ADD COLUMN looking_for TEXT NOT NULL DEFAULT '[]';
