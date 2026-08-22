-- 011: fee currency (CHF default, EUR for gigs on the French side of Grand Genève)
ALTER TABLE gigs ADD COLUMN currency TEXT NOT NULL DEFAULT 'CHF' CHECK(currency IN ('CHF','EUR'));
ALTER TABLE bookings ADD COLUMN currency TEXT NOT NULL DEFAULT 'CHF' CHECK(currency IN ('CHF','EUR'));
