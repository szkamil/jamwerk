-- 006: per-user language (en/fr/de/it) for emails and push. Applied 2026-08-21.
ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';
