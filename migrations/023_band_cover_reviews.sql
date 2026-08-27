-- 023: band cover photo, "concert effectué" on inquiries, reviews of bands by organisers.
ALTER TABLE bands ADD COLUMN cover_key TEXT;
ALTER TABLE band_inquiries ADD COLUMN done_at TEXT;
CREATE TABLE IF NOT EXISTS band_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  band_id INTEGER NOT NULL,
  reviewer_email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(band_id, reviewer_email),
  FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_email) REFERENCES users(email) ON DELETE CASCADE
);
