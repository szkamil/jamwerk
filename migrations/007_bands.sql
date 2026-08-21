-- 007: band formation — bands, instrument seats, seat applications.
-- Members = the owner + everyone holding a filled seat. Applied 2026-08-21.
CREATE TABLE IF NOT EXISTS bands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  genres TEXT NOT NULL DEFAULT '[]',
  home_city TEXT,
  home_lat REAL,
  home_lng REAL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_email) REFERENCES users(email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bands_owner ON bands(owner_email);

CREATE TABLE IF NOT EXISTS band_seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  band_id INTEGER NOT NULL,
  instrument TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','filled','closed')),
  member_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_band_seats_band ON band_seats(band_id);
CREATE INDEX IF NOT EXISTS idx_band_seats_open ON band_seats(status, instrument);

CREATE TABLE IF NOT EXISTS seat_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_id INTEGER NOT NULL,
  musician_email TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'applied' CHECK(status IN ('applied','accepted','declined','withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(seat_id, musician_email),
  FOREIGN KEY (seat_id) REFERENCES band_seats(id) ON DELETE CASCADE,
  FOREIGN KEY (musician_email) REFERENCES users(email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_seat_applications_seat ON seat_applications(seat_id);
