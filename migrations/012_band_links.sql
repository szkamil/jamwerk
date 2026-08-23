-- 012: promo/demo links on bands (YouTube, Spotify, SoundCloud, Bandcamp…), JSON array of URLs
ALTER TABLE bands ADD COLUMN links TEXT NOT NULL DEFAULT '[]';
