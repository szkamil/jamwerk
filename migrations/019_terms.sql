-- 019: users must accept the terms at sign-up; we keep when.
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
