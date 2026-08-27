-- 020: musicians can mark themselves unavailable until a date; fan-outs skip them.
ALTER TABLE musician_details ADD COLUMN unavailable_until TEXT;
