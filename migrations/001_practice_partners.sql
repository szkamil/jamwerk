-- 001: practice-partner listings share the gigs table via a `kind` column.
-- The deployed table had NOT NULL fee_chf/gig_date, so this is a rebuild
-- (SQLite cannot alter constraints). Applied to jamwerk-db on 2026-08-21.
CREATE TABLE gigs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poster_email TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'gig' CHECK(kind IN ('gig','practice')),
  instrument TEXT NOT NULL,
  genres TEXT NOT NULL DEFAULT '[]',
  gig_date TEXT,
  call_time TEXT,
  end_time TEXT,
  venue_city TEXT NOT NULL,
  venue_lat REAL,
  venue_lng REAL,
  fee_chf INTEGER CHECK(fee_chf IS NULL OR fee_chf > 0),
  requirements TEXT NOT NULL DEFAULT '{}',
  setlist_link TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','booked','completed','cancelled','expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  CHECK(kind = 'practice' OR (fee_chf IS NOT NULL AND gig_date IS NOT NULL)),
  FOREIGN KEY (poster_email) REFERENCES users(email) ON DELETE CASCADE
);
INSERT INTO gigs_new (id, poster_email, kind, instrument, genres, gig_date, call_time, end_time, venue_city, venue_lat, venue_lng, fee_chf, requirements, setlist_link, description, status, created_at, expires_at)
  SELECT id, poster_email, 'gig', instrument, genres, gig_date, call_time, end_time, venue_city, venue_lat, venue_lng, fee_chf, requirements, setlist_link, description, status, created_at, expires_at FROM gigs;
DROP TABLE gigs;
ALTER TABLE gigs_new RENAME TO gigs;
CREATE INDEX IF NOT EXISTS idx_gigs_open ON gigs(status, kind, gig_date);
CREATE INDEX IF NOT EXISTS idx_gigs_poster ON gigs(poster_email);
