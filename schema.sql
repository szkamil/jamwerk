-- GigDep schema. Applied idempotently on every deploy
-- (wrangler d1 execute --file, see .github/workflows/gigdep-deploy.yml),
-- so every statement must be IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  confirmed INTEGER DEFAULT 0,
  photo_key TEXT,
  confirm_token TEXT,
  reset_token TEXT,
  reset_expires TEXT,
  lang TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-IP fixed-window rate limiting (mirrors migrations/003)
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  action TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(ip, action, attempted_at);

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
  handle TEXT,
  level TEXT,
  looking_for TEXT NOT NULL DEFAULT '[]',
  accepts_dm INTEGER NOT NULL DEFAULT 1,
  home_city TEXT,
  home_lat REAL,
  home_lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner) REFERENCES users(email) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_musician_handle ON musician_details(handle);

CREATE TABLE IF NOT EXISTS gigs (
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
  currency TEXT NOT NULL DEFAULT 'CHF' CHECK(currency IN ('CHF','EUR')),
  requirements TEXT NOT NULL DEFAULT '{}',
  setlist_link TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','booked','completed','cancelled','expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  CHECK(kind = 'practice' OR (fee_chf IS NOT NULL AND gig_date IS NOT NULL)),
  FOREIGN KEY (poster_email) REFERENCES users(email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gigs_open ON gigs(status, kind, gig_date);
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
  currency TEXT NOT NULL DEFAULT 'CHF' CHECK(currency IN ('CHF','EUR')),
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

-- Geocode cache (mirrors migrations/002) — one row per normalized city name;
-- NULL lat/lng records a failed lookup so it is not retried on every request.
CREATE TABLE IF NOT EXISTS geocode_cache (
  city_key TEXT PRIMARY KEY,
  lat REAL,
  lng REAL,
  display TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Web Push subscriptions (mirrors migrations/005)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner) REFERENCES users(email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_push_owner ON push_subscriptions(owner);

-- Band formation (mirrors migrations/007)
CREATE TABLE IF NOT EXISTS bands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  genres TEXT NOT NULL DEFAULT '[]',
  home_city TEXT,
  home_lat REAL,
  home_lng REAL,
  description TEXT NOT NULL DEFAULT '',
  links TEXT NOT NULL DEFAULT '[]',
  kind TEXT NOT NULL DEFAULT 'band' CHECK(kind IN ('band','jam')),
  bookable INTEGER NOT NULL DEFAULT 0,
  fee_from INTEGER,
  fee_currency TEXT NOT NULL DEFAULT 'CHF' CHECK(fee_currency IN ('CHF','EUR')),
  pitch TEXT NOT NULL DEFAULT '',
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

-- In-app messaging (mirrors migrations/009)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_type TEXT NOT NULL CHECK(thread_type IN ('gig','seat','band','dm')),
  thread_id INTEGER NOT NULL,
  sender_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_read INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sender_email) REFERENCES users(email) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_type, thread_id, id);

-- Direct messages between two users (thread_type 'dm' keys this id); a_email < b_email
CREATE TABLE IF NOT EXISTS dm_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  a_email TEXT NOT NULL,
  b_email TEXT NOT NULL,
  started_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(a_email, b_email),
  FOREIGN KEY (a_email) REFERENCES users(email) ON DELETE CASCADE,
  FOREIGN KEY (b_email) REFERENCES users(email) ON DELETE CASCADE
);

-- Booking / contact inquiries to a band (thread_type 'band' keys this id)
CREATE TABLE IF NOT EXISTS band_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  band_id INTEGER NOT NULL,
  from_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(band_id, from_email),
  FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE,
  FOREIGN KEY (from_email) REFERENCES users(email) ON DELETE CASCADE
);

-- Feedback form submissions (mirrors migrations/010)
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
