-- 013: profile photo (R2 object key, e.g. avatars/<uuid>.jpg)
ALTER TABLE users ADD COLUMN photo_key TEXT;
