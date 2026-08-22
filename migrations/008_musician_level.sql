-- 008: experience level on musician profiles (hobby / semi_pro / pro; NULL =
-- unspecified). Practice listings carry their own "who's welcome" level inside
-- the existing requirements JSON — no schema change needed there. Applied 2026-08-21.
ALTER TABLE musician_details ADD COLUMN level TEXT;
