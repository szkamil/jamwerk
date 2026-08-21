-- 002: cache for Nominatim city lookups (one row per normalized city name;
-- lat/lng NULL records a failed lookup so we do not re-query it every time).
CREATE TABLE IF NOT EXISTS geocode_cache (
  city_key TEXT PRIMARY KEY,
  lat REAL,
  lng REAL,
  display TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
