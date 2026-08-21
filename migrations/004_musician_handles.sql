-- 004: public profile handles. Generated on profile save (slug + random
-- suffix); the public page lives at /m/:handle. Applied 2026-08-21.
ALTER TABLE musician_details ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_musician_handle ON musician_details(handle);
