-- GigDep schema. Applied idempotently on every deploy
-- (wrangler d1 execute --file, see .github/workflows/gigdep-deploy.yml),
-- so every statement must be IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS musician_details (
  owner TEXT PRIMARY KEY,
  instruments TEXT NOT NULL DEFAULT '[]',
  genres TEXT NOT NULL DEFAULT '[]',
  reads_charts INTEGER DEFAULT 0,
  sings_backing INTEGER DEFAULT 0,
  own_transport INTEGER DEFAULT 0,
  own_pa INTEGER DEFAULT 0,
  travel_radius_km INTEGER DEFAULT 30,
  rate_min INTEGER,
  rate_max INTEGER,
  demo_links TEXT NOT NULL DEFAULT '[]',
  gigs_played INTEGER DEFAULT 0,
  home_city TEXT,
  home_lat REAL,
  home_lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner) REFERENCES users(email) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gigs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poster_email TEXT NOT NULL,
  instrument TEXT NOT NULL,
  genres TEXT NOT NULL DEFAULT '[]',
  gig_date TEXT NOT NULL,
  call_time TEXT,
  end_time TEXT,
  venue_city TEXT NOT NULL,
  venue_lat REAL,
  venue_lng REAL,
  fee_chf INTEGER NOT NULL CHECK(fee_chf > 0),
  requirements TEXT NOT NULL DEFAULT '{}',
  setlist_link TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','booked','completed','cancelled','expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (poster_email) REFERENCES users(email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gigs_open ON gigs(status, gig_date);
CREATE INDEX IF NOT EXISTS idx_gigs_poster ON gigs(poster_email);

CREATE TABLE IF NOT EXISTS gig_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gig_id INTEGER NOT NULL,
  musician_email TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'applied' CHECK(status IN ('applied','shortlisted','accepted','declined','withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(gig_id, musician_email),
  FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE CASCADE,
  FOREIGN KEY (musician_email) REFERENCES users(email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gig_applications_gig ON gig_applications(gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_applications_musician ON gig_applications(musician_email);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gig_id INTEGER UNIQUE NOT NULL,
  musician_email TEXT NOT NULL,
  agreed_fee_chf INTEGER NOT NULL,
  confirmed_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  cancelled_by TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT,
  FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE CASCADE,
  FOREIGN KEY (musician_email) REFERENCES users(email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bookings_musician ON bookings(musician_email);

CREATE TABLE IF NOT EXISTS gig_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('poster_to_musician','musician_to_poster')),
  reviewer_email TEXT NOT NULL,
  reviewee_email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(booking_id, direction),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gig_reviews_reviewee ON gig_reviews(reviewee_email);
