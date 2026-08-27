-- 018: paid gigs are either a replacement ('dep') or a standby request; standby is
-- activated by the poster when the main musician drops out.
ALTER TABLE gigs ADD COLUMN need TEXT NOT NULL DEFAULT 'dep' CHECK(need IN ('dep','standby'));
ALTER TABLE gigs ADD COLUMN standby_activated_at TEXT;
