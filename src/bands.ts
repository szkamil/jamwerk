// src/bands.ts — band formation (PLAN.md phase 3).
//
//   POST /bands                    create a band with open seats
//   GET  /bands                    latest bands with their open seats
//   GET  /bands/:id                detail: lineup + (owner only) seat applications
//   POST /bands/:id/seats          add an open seat (owner)
//   POST /bands/seats/:seatId/apply                 apply for a seat
//   POST /bands/seats/:seatId/applications/:appId/accept   fill the seat (owner)
//   POST /bands/seats/:seatId/close                 close an open seat (owner)
//
// Members = the owner + holders of filled seats. Contact is shared when a
// seat is filled, mirroring the gig-booking privacy rule.
import { Hono, Context } from 'hono';
import { notify } from './email';
import { rateLimited, clientIp } from './ratelimit';
import { INSTRUMENTS, geocodeCity, haversineKm } from './gigs';
import { Lang, t } from './i18n';
import type { AppEnv } from './types';
import { classifyMedia, parseLinks } from './media';
import { isBlocked } from './messages';
import { normGenres } from './genres';

type Ctx = Context<AppEnv>;

function requireUser(c: Ctx): { email: string } | null {
  return c.get('user') ?? null;
}

function parseSlugArray(v: unknown, max = 10): string[] | null {
  if (!Array.isArray(v) || v.length > max) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string' || !/^[a-z0-9_ -]{1,40}$/.test(item)) return null;
    out.push(item);
  }
  return out;
}

interface BandRow {
  id: number;
  owner_email: string;
  name: string;
  genres: string;
  home_city: string | null;
  home_lat: number | null;
  home_lng: number | null;
  description: string;
  links?: string;
  kind?: 'band' | 'jam';
  bookable?: number;
  fee_from?: number | null;
  fee_currency?: 'CHF' | 'EUR';
  pitch?: string;
}

/** Optional directory fields shared by create and edit. */
function bandExtras(body: any) {
  const kind: 'band' | 'jam' = body.kind === 'jam' ? 'jam' : 'band';
  const bookable = kind === 'band' && !!body.bookable ? 1 : 0;
  const feeFrom = bookable && Number.isInteger(body.fee_from) && body.fee_from > 0 && body.fee_from <= 100000 ? body.fee_from : null;
  const feeCurrency: 'CHF' | 'EUR' = body.fee_currency === 'EUR' ? 'EUR' : 'CHF';
  const pitch = typeof body.pitch === 'string' ? body.pitch.trim().slice(0, 160) : '';
  return { kind, bookable, feeFrom, feeCurrency, pitch };
}

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'band';
}

function bandPublic(b: any) {
  const links: string[] = JSON.parse(b.links || '[]');
  return {
    id: b.id, name: b.name, slug: slugify(b.name), kind: b.kind || 'band',
    genres: normGenres(JSON.parse(b.genres || '[]')), home_city: b.home_city, description: b.description,
    pitch: b.pitch || '', bookable: !!b.bookable, fee_from: b.fee_from ?? null, fee_currency: b.fee_currency || 'CHF',
    links, media: links.map(classifyMedia).filter(Boolean),
    cover: b.cover_key ? `/img/${b.cover_key}` : null,
    avg_rating: b.avg_rating != null ? Math.round(b.avg_rating * 10) / 10 : null,
    review_count: b.review_count || 0,
  };
}

/** Best-effort: tell matching musicians nearby that a seat opened. */
async function fanOutSeat(c: Ctx, band: BandRow, instrument: string) {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT m.owner, m.travel_radius_km, m.home_lat, m.home_lng, m.home_city, u.lang
       FROM musician_details m JOIN users u ON u.email = m.owner
       WHERE m.instruments LIKE ? AND m.owner != ? LIMIT 500`
    ).bind(`%"${instrument}"%`, band.owner_email).all();
    const city = (band.home_city || '').trim().toLowerCase();
    const targets = (results as any[]).filter((m) => {
      if (band.home_lat !== null && band.home_lng !== null && m.home_lat !== null && m.home_lng !== null) {
        return haversineKm(band.home_lat, band.home_lng, m.home_lat, m.home_lng) <= (m.travel_radius_km || 30);
      }
      return city && (m.home_city || '').trim().toLowerCase() === city;
    }).slice(0, 50);
    for (const target of targets) {
      notify(c, target.owner, (lang: Lang) => ({
        subject: t(lang, {
          en: `Band seat: ${instrument} — ${band.name}${band.home_city ? ` (${band.home_city})` : ''}`,
          fr: `Place dans un groupe : ${instrument} — ${band.name}${band.home_city ? ` (${band.home_city})` : ''}`,
          de: `Bandplatz: ${instrument} — ${band.name}${band.home_city ? ` (${band.home_city})` : ''}`,
          it: `Posto in un gruppo: ${instrument} — ${band.name}${band.home_city ? ` (${band.home_city})` : ''}`,
        }),
        body: `${band.description.slice(0, 300)}\n\nhttps://jamwerk.app`,
      }), target.lang);
    }
  } catch (err) {
    console.error('Seat fan-out failed:', err);
  }
}

const bands = new Hono<AppEnv>();

bands.post('/', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const genres = normGenres(body.genres);
  const seats = parseSlugArray(body.seats, 12) ?? [];
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : '';
  const links = parseLinks(body.links);
  if (links === null) return c.json({ error: 'links must be up to 5 valid http(s) URLs' }, 400);
  const x = bandExtras(body);
  if (!name) return c.json({ error: 'Band name is required' }, 400);
  if (genres.length === 0) return c.json({ error: 'genres must be a non-empty array of slugs' }, 400);
  if (!seats.every((s) => (INSTRUMENTS as readonly string[]).includes(s))) {
    return c.json({ error: 'seats must be known instruments', known: INSTRUMENTS }, 400);
  }
  const homeCity = typeof body.home_city === 'string' ? body.home_city.trim().slice(0, 100) : null;
  let lat: number | null = typeof body.home_lat === 'number' && Math.abs(body.home_lat) <= 90 ? body.home_lat : null;
  let lng: number | null = typeof body.home_lng === 'number' && Math.abs(body.home_lng) <= 180 ? body.home_lng : null;
  if (homeCity && (lat === null || lng === null)) {
    const geo = await geocodeCity(c.env, homeCity);
    if (geo) { lat = geo.lat; lng = geo.lng; }
    else return c.json({ error: 'City not recognised — pick one from the list', code: 'city_unknown' }, 400);
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO bands (owner_email, name, genres, home_city, home_lat, home_lng, description, links, kind, bookable, fee_from, fee_currency, pitch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(user.email, name, JSON.stringify(genres), homeCity, lat, lng, description, JSON.stringify(links), x.kind, x.bookable, x.feeFrom, x.feeCurrency, x.pitch).run();
  const bandId = result.meta.last_row_id;
  if (seats.length) {
    await c.env.DB.batch(seats.map((s) =>
      c.env.DB.prepare('INSERT INTO band_seats (band_id, instrument) VALUES (?, ?)').bind(bandId, s)
    ));
    const band: BandRow = { id: bandId as number, owner_email: user.email, name, genres: JSON.stringify(genres), home_city: homeCity, home_lat: lat, home_lng: lng, description };
    for (const s of [...new Set(seats)]) await fanOutSeat(c, band, s);
  }
  return c.json({ ok: true, id: bandId }, 201);
});

bands.get('/', async (c) => {
  const user = c.get('user');
  const q = c.req.query();
  const conds: string[] = ['1=1'];
  const binds: unknown[] = [];
  if (q.kind === 'band' || q.kind === 'jam') { conds.push('b.kind = ?'); binds.push(q.kind); }
  if (q.bookable === '1') conds.push('b.bookable = 1');
  if (q.genre) { const g = normGenres([q.genre])[0]; if (g) { conds.push('b.genres LIKE ?'); binds.push('%"' + g + '"%'); } }
  let lat = parseFloat(q.lat), lng = parseFloat(q.lng);
  const radius = Math.min(parseFloat(q.radius_km) || 50, 300);
  if ((isNaN(lat) || isNaN(lng)) && q.city) {
    const center = await geocodeCity(c.env, q.city);
    if (center) { lat = center.lat; lng = center.lng; }
    else { conds.push('LOWER(b.home_city) = LOWER(?)'); binds.push(q.city.trim()); }
  }
  const geo = !isNaN(lat) && !isNaN(lng);
  if (geo) {
    const dLat = radius / 111, dLng = radius / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
    conds.push('b.home_lat BETWEEN ? AND ? AND b.home_lng BETWEEN ? AND ?');
    binds.push(lat - dLat, lat + dLat, lng - dLng, lng + dLng);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT b.*, u.display_name AS owner_name,
       (SELECT COUNT(*) FROM band_seats s WHERE s.band_id = b.id AND s.status = 'filled') AS filled_count,
       (SELECT AVG(rating) FROM band_reviews r WHERE r.band_id = b.id) AS avg_rating,
       (SELECT COUNT(*) FROM band_reviews r WHERE r.band_id = b.id) AS review_count
     FROM bands b JOIN users u ON u.email = b.owner_email
     WHERE ${conds.join(' AND ')}
     ORDER BY b.created_at DESC LIMIT 100`
  ).bind(...binds).all();
  let bandsOut: any[] = [];
  for (const b of results as any[]) {
    const { results: seats } = await c.env.DB.prepare(
      "SELECT id, instrument, status FROM band_seats WHERE band_id = ? ORDER BY id"
    ).bind(b.id).all();
    bandsOut.push({
      ...bandPublic(b),
      owner_name: b.owner_name || b.owner_email.split('@')[0],
      member_count: 1 + b.filled_count,
      open_seats: (seats as any[]).filter((s) => s.status === 'open').map((s) => ({ id: s.id, instrument: s.instrument })),
      is_mine: user !== undefined && user !== null && b.owner_email === user.email,
      distance_km: geo && b.home_lat != null && b.home_lng != null ? Math.round(haversineKm(lat, lng, b.home_lat, b.home_lng)) : null,
    });
  }
  if (geo) bandsOut = bandsOut.filter((b) => b.distance_km !== null && b.distance_km <= radius).sort((a, b) => a.distance_km - b.distance_km);
  return c.json({ bands: bandsOut });
});

// Owner edits the band's directory fields (name, genres, city, description, links, kind, booking).
bands.put('/:id', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const band = await loadBand(c, c.req.param('id'));
  if (!band) return c.json({ error: 'Band not found' }, 404);
  if (band.owner_email !== user.email) return c.json({ error: 'Not your band' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : band.name;
  const genres = body.genres === undefined ? normGenres(JSON.parse(band.genres || '[]')) : normGenres(body.genres);
  if (!genres.length) return c.json({ error: 'genres must be a non-empty array of slugs' }, 400);
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : band.description;
  const links = parseLinks(body.links);
  if (links === null) return c.json({ error: 'links must be up to 5 valid http(s) URLs' }, 400);
  const x = bandExtras(body);
  const homeCity = typeof body.home_city === 'string' ? body.home_city.trim().slice(0, 100) : band.home_city;
  let lat: number | null = typeof body.home_lat === 'number' && Math.abs(body.home_lat) <= 90 ? body.home_lat : null;
  let lng: number | null = typeof body.home_lng === 'number' && Math.abs(body.home_lng) <= 180 ? body.home_lng : null;
  if (homeCity && (lat === null || lng === null)) {
    if (homeCity === band.home_city && band.home_lat != null) { lat = band.home_lat; lng = band.home_lng; }
    else {
      const geo = await geocodeCity(c.env, homeCity);
      if (geo) { lat = geo.lat; lng = geo.lng; }
      else return c.json({ error: 'City not recognised — pick one from the list', code: 'city_unknown' }, 400);
    }
  }
  await c.env.DB.prepare(
    `UPDATE bands SET name = ?, genres = ?, home_city = ?, home_lat = ?, home_lng = ?, description = ?, links = ?,
       kind = ?, bookable = ?, fee_from = ?, fee_currency = ?, pitch = ? WHERE id = ?`
  ).bind(name, JSON.stringify(genres), homeCity, lat, lng, description, JSON.stringify(links), x.kind, x.bookable, x.feeFrom, x.feeCurrency, x.pitch, band.id).run();
  return c.json({ ok: true });
});

// Cover photo (owner). Client sends a resized JPEG; stored in R2 like avatars.
const COVER_MAX = 900 * 1024;
bands.post('/:id/cover', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const band = await loadBand(c, c.req.param('id'));
  if (!band) return c.json({ error: 'Band not found' }, 404);
  if (band.owner_email !== user.email) return c.json({ error: 'Not your band' }, 403);
  if (!c.env.MEDIA) return c.json({ error: 'Photo storage is not configured' }, 503);
  const type = (c.req.header('content-type') || '').split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return c.json({ error: 'Send a JPEG, PNG or WebP image' }, 415);
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength < 100 || bytes.byteLength > COVER_MAX) return c.json({ error: `Image must be under ${Math.round(COVER_MAX / 1024)} KB` }, 413);
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const key = `covers/${crypto.randomUUID()}.${ext}`;
  await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  const prev = (band as any).cover_key as string | null;
  await c.env.DB.prepare('UPDATE bands SET cover_key = ? WHERE id = ?').bind(key, band.id).run();
  if (prev) { try { await c.env.MEDIA.delete(prev); } catch { /* best effort */ } }
  return c.json({ ok: true, cover: `/img/${key}` });
});
bands.delete('/:id/cover', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const band = await loadBand(c, c.req.param('id'));
  if (!band) return c.json({ error: 'Band not found' }, 404);
  if (band.owner_email !== user.email) return c.json({ error: 'Not your band' }, 403);
  const prev = (band as any).cover_key as string | null;
  await c.env.DB.prepare('UPDATE bands SET cover_key = NULL WHERE id = ?').bind(band.id).run();
  if (prev && c.env.MEDIA) { try { await c.env.MEDIA.delete(prev); } catch { /* best effort */ } }
  return c.json({ ok: true });
});

// The band played the event: mark the inquiry done so the organiser can leave a review.
bands.post('/:id/inquiries/:inqId/done', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const band = await loadBand(c, c.req.param('id'));
  if (!band) return c.json({ error: 'Band not found' }, 404);
  if (band.owner_email !== user.email) return c.json({ error: 'Not your band' }, 403);
  const inq = await c.env.DB.prepare('SELECT id, from_email, done_at FROM band_inquiries WHERE id = ? AND band_id = ?').bind(c.req.param('inqId'), band.id).first<any>();
  if (!inq) return c.json({ error: 'Inquiry not found' }, 404);
  if (!inq.done_at) {
    await c.env.DB.prepare("UPDATE band_inquiries SET done_at = datetime('now') WHERE id = ?").bind(inq.id).run();
    const base = c.env.BASE_URL || 'https://jamwerk.app';
    notify(c, inq.from_email, (lang: Lang) => ({
      subject: t(lang, { en: `How was ${band.name}? Leave a review`, fr: `Comment c’était avec ${band.name} ? Laissez un avis`, de: `Wie war ${band.name}? Bewertung abgeben`, it: `Com’è andata con ${band.name}? Lascia una recensione` }),
      body: t(lang, { en: 'Your review helps other organisers choose. One minute:', fr: 'Votre avis aide les autres organisateurs à choisir. Une minute :', de: 'Deine Bewertung hilft anderen Veranstalter:innen bei der Wahl. Eine Minute:', it: 'La tua recensione aiuta altri organizzatori a scegliere. Un minuto:' }) + `\n${base}/?review_band=${band.id}`,
    }));
  }
  return c.json({ ok: true });
});

// Review a band — only after the band marked your inquiry as done. One per person, editable.
bands.post('/:id/reviews', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const band = await loadBand(c, c.req.param('id'));
  if (!band) return c.json({ error: 'Band not found' }, 404);
  if (band.owner_email === user.email) return c.json({ error: 'You cannot review your own band' }, 403);
  const inq = await c.env.DB.prepare('SELECT done_at FROM band_inquiries WHERE band_id = ? AND from_email = ?').bind(band.id, user.email).first<any>();
  if (!inq?.done_at) return c.json({ error: 'You can review a band once they played for you', code: 'not_done' }, 403);
  const body = await c.req.json().catch(() => null);
  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return c.json({ error: 'rating must be 1-5' }, 400);
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 2000) : '';
  await c.env.DB.prepare('INSERT INTO band_reviews (band_id, reviewer_email, rating, comment) VALUES (?, ?, ?, ?) ON CONFLICT(band_id, reviewer_email) DO UPDATE SET rating = excluded.rating, comment = excluded.comment').bind(band.id, user.email, rating, comment).run();
  return c.json({ ok: true }, 201);
});

// Contact / book a band: opens (or reuses) a 'band' message thread with the owner.
// Login + confirmed email, max 3 new inquiries per day — the anti-abuse rules from PLAN.md.
bands.post('/:id/inquire', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const band = await loadBand(c, c.req.param('id'));
  if (!band) return c.json({ error: 'Band not found' }, 404);
  if (band.owner_email === user.email) return c.json({ error: 'This is your own band' }, 400);
  const u = await c.env.DB.prepare('SELECT confirmed, display_name FROM users WHERE email = ?').bind(user.email).first<{ confirmed: number; display_name: string }>();
  if (!u?.confirmed) return c.json({ error: 'Confirm your email address before contacting a band', code: 'email_unconfirmed' }, 403);
  const body = await c.req.json().catch(() => null);
  const text = typeof body?.message === 'string' ? body.message.trim().slice(0, 4000) : '';
  if (text.length < 10) return c.json({ error: 'Message must be at least 10 characters' }, 400);
  if (await isBlocked(c.env, user.email, band.owner_email)) return c.json({ error: 'You cannot message this band', code: 'blocked' }, 403);
  const existing = await c.env.DB.prepare('SELECT id FROM band_inquiries WHERE band_id = ? AND from_email = ?').bind(band.id, user.email).first<{ id: number }>();
  let inquiryId = existing?.id;
  if (!inquiryId) {
    const today = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM band_inquiries WHERE from_email = ? AND created_at > datetime('now', '-1 day')").bind(user.email).first<{ n: number }>();
    if ((today?.n ?? 0) >= 3) return c.json({ error: 'You can contact up to 3 bands per day' }, 429);
    const ins = await c.env.DB.prepare('INSERT INTO band_inquiries (band_id, from_email) VALUES (?, ?)').bind(band.id, user.email).run();
    inquiryId = ins.meta.last_row_id as number;
  }
  await c.env.DB.prepare("INSERT INTO messages (thread_type, thread_id, sender_email, body) VALUES ('band', ?, ?, ?)").bind(inquiryId, user.email, text).run();
  const name = u.display_name || user.email.split('@')[0];
  notify(c, band.owner_email, (lang: Lang) => ({
    subject: t(lang, { en: `${name} wants to book ${band.name}`, fr: `${name} souhaite réserver ${band.name}`, de: `${name} möchte ${band.name} buchen`, it: `${name} vuole prenotare ${band.name}` }),
    body: text.slice(0, 300) + '\n\nhttps://jamwerk.app',
  }));
  return c.json({ ok: true, thread_type: 'band', thread_id: inquiryId }, 201);
});

async function loadBand(c: Ctx, id: string): Promise<BandRow | null> {
  if (!/^\d+$/.test(id)) return null;
  return await c.env.DB.prepare('SELECT * FROM bands WHERE id = ?').bind(id).first<BandRow>();
}

bands.get('/:id', async (c) => {
  const user = c.get('user');
  const band = await loadBand(c, c.req.param('id'));
  if (!band) return c.json({ error: 'Band not found' }, 404);
  const isOwner = !!user && user.email === band.owner_email;

  const { results: seats } = await c.env.DB.prepare(
    `SELECT s.id, s.instrument, s.status, s.member_email,
            u.display_name, m.handle, m.gigs_played,
            (SELECT ROUND(AVG(rating), 1) FROM gig_reviews r WHERE r.reviewee_email = s.member_email AND r.direction = 'poster_to_musician') AS avg_rating
     FROM band_seats s
     LEFT JOIN users u ON u.email = s.member_email
     LEFT JOIN musician_details m ON m.owner = s.member_email
     WHERE s.band_id = ? ORDER BY s.id`
  ).bind(band.id).all();

  const ownerRow = await c.env.DB.prepare('SELECT display_name FROM users WHERE email = ?').bind(band.owner_email).first<{ display_name: string }>();
  const agg = await c.env.DB.prepare('SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count FROM band_reviews WHERE band_id = ?').bind(band.id).first<any>();
  const { results: reviews } = await c.env.DB.prepare('SELECT r.rating, r.comment, r.created_at, u.display_name FROM band_reviews r JOIN users u ON u.email = r.reviewer_email WHERE r.band_id = ? ORDER BY r.id DESC LIMIT 20').bind(band.id).all();
  const viewer = c.get('user');
  const myInq = viewer ? await c.env.DB.prepare('SELECT id, done_at FROM band_inquiries WHERE band_id = ? AND from_email = ?').bind(band.id, viewer.email).first<any>() : null;
  const out: Record<string, unknown> = {
    ...bandPublic({ ...band, avg_rating: agg?.avg_rating, review_count: agg?.review_count }),
    reviews: (reviews as any[]).map((r) => ({ rating: r.rating, comment: r.comment, created_at: r.created_at, reviewer: r.display_name })),
    can_review: !!(myInq && myInq.done_at),
    owner_name: ownerRow?.display_name || band.owner_email.split('@')[0],
    is_mine: isOwner,
    seats: (seats as any[]).map((s) => ({
      id: s.id,
      instrument: s.instrument,
      status: s.status,
      member: s.member_email ? {
        display_name: s.display_name || s.member_email.split('@')[0],
        handle: s.handle,
        gigs_played: s.gigs_played,
        avg_rating: s.avg_rating,
      } : null,
    })),
  };

  if (isOwner) {
    const { results: inqs } = await c.env.DB.prepare('SELECT i.id, i.done_at, i.created_at, u.display_name FROM band_inquiries i JOIN users u ON u.email = i.from_email WHERE i.band_id = ? ORDER BY i.id DESC LIMIT 50').bind(band.id).all();
    out.inquiries = (inqs as any[]).map((i) => ({ id: i.id, done: !!i.done_at, created_at: i.created_at, name: i.display_name }));
    const { results: apps } = await c.env.DB.prepare(
      `SELECT a.id, a.seat_id, a.musician_email, a.note, a.status, u.display_name, m.handle, m.instruments, m.gigs_played, m.home_city,
              (SELECT ROUND(AVG(rating), 1) FROM gig_reviews r WHERE r.reviewee_email = a.musician_email AND r.direction = 'poster_to_musician') AS avg_rating,
              (SELECT COUNT(*) FROM gig_reviews r WHERE r.reviewee_email = a.musician_email AND r.direction = 'poster_to_musician') AS review_count
       FROM seat_applications a
       LEFT JOIN users u ON u.email = a.musician_email
       LEFT JOIN musician_details m ON m.owner = a.musician_email
       WHERE a.seat_id IN (SELECT id FROM band_seats WHERE band_id = ?) AND a.status != 'withdrawn'
       ORDER BY a.created_at ASC`
    ).bind(band.id).all();
    out.applications = (apps as any[]).map((a) => ({
      ...a,
      musician_email: a.status === 'accepted' ? a.musician_email : undefined,
      display_name: a.display_name || a.musician_email.split('@')[0],
      instruments: JSON.parse(a.instruments || '[]'),
    }));
  }
  return c.json(out);
});

bands.post('/:id/seats', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const band = await loadBand(c, c.req.param('id'));
  if (!band) return c.json({ error: 'Band not found' }, 404);
  if (band.owner_email !== user.email) return c.json({ error: 'Only the band owner can add seats' }, 403);
  const body = await c.req.json().catch(() => null);
  const instrument = body?.instrument;
  if (!(INSTRUMENTS as readonly string[]).includes(instrument)) {
    return c.json({ error: 'instrument must be a known instrument', known: INSTRUMENTS }, 400);
  }
  const r = await c.env.DB.prepare('INSERT INTO band_seats (band_id, instrument) VALUES (?, ?)')
    .bind(band.id, instrument).run();
  await fanOutSeat(c, band, instrument);
  return c.json({ ok: true, id: r.meta.last_row_id }, 201);
});

interface SeatRow { id: number; band_id: number; instrument: string; status: string; member_email: string | null }

async function loadSeat(c: Ctx, id: string): Promise<{ seat: SeatRow; band: BandRow } | null> {
  if (!/^\d+$/.test(id)) return null;
  const seat = await c.env.DB.prepare('SELECT * FROM band_seats WHERE id = ?').bind(id).first<SeatRow>();
  if (!seat) return null;
  const band = await c.env.DB.prepare('SELECT * FROM bands WHERE id = ?').bind(seat.band_id).first<BandRow>();
  return band ? { seat, band } : null;
}

bands.post('/seats/:seatId/apply', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (await rateLimited(c.env, clientIp(c), 'apply', 30, 60)) {
    return c.json({ error: 'Too many applications — slow down a little' }, 429);
  }
  const loaded = await loadSeat(c, c.req.param('seatId'));
  if (!loaded) return c.json({ error: 'Seat not found' }, 404);
  const { seat, band } = loaded;
  if (band.owner_email === user.email) return c.json({ error: 'This is your own band' }, 403);
  if (seat.status !== 'open') return c.json({ error: `Seat is ${seat.status}, not open` }, 409);
  const musician = await c.env.DB.prepare('SELECT owner FROM musician_details WHERE owner = ?')
    .bind(user.email).first();
  if (!musician) return c.json({ error: 'Create your musician profile first' }, 403);

  const body = await c.req.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 4000) : '';
  try {
    await c.env.DB.prepare('INSERT INTO seat_applications (seat_id, musician_email, note) VALUES (?, ?, ?)')
      .bind(seat.id, user.email, note).run();
  } catch (err: any) {
    if (String(err?.message || err).includes('UNIQUE')) {
      return c.json({ error: 'You already applied for this seat' }, 409);
    }
    throw err;
  }
  notify(c, band.owner_email, (lang: Lang) => ({
    subject: t(lang, {
      en: `New application for the ${seat.instrument} seat in ${band.name}`,
      fr: `Nouvelle candidature pour la place de ${seat.instrument} dans ${band.name}`,
      de: `Neue Bewerbung für den ${seat.instrument}-Platz in ${band.name}`,
      it: `Nuova candidatura per il posto di ${seat.instrument} in ${band.name}`,
    }),
    body: `${note || t(lang, { en: 'Open the app to review it.', fr: "Ouvrez l'app pour la consulter.", de: 'Öffne die App, um sie anzusehen.', it: "Apri l'app per esaminarla." })}\n\nhttps://jamwerk.app`,
  }));
  return c.json({ ok: true }, 201);
});

bands.post('/seats/:seatId/applications/:appId/accept', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const loaded = await loadSeat(c, c.req.param('seatId'));
  if (!loaded) return c.json({ error: 'Seat not found' }, 404);
  const { seat, band } = loaded;
  if (band.owner_email !== user.email) return c.json({ error: 'Only the band owner can accept' }, 403);
  const application = await c.env.DB.prepare(
    "SELECT * FROM seat_applications WHERE id = ? AND seat_id = ? AND status = 'applied'"
  ).bind(c.req.param('appId'), seat.id).first<{ id: number; musician_email: string }>();
  if (!application) return c.json({ error: 'Application not found or no longer active' }, 404);

  const claim = await c.env.DB.prepare(
    "UPDATE band_seats SET status = 'filled', member_email = ? WHERE id = ? AND status = 'open'"
  ).bind(application.musician_email, seat.id).run();
  if (!claim.meta.changes) return c.json({ error: 'Seat is no longer open' }, 409);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE seat_applications SET status = 'accepted' WHERE id = ?").bind(application.id),
    c.env.DB.prepare("UPDATE seat_applications SET status = 'declined' WHERE seat_id = ? AND id != ? AND status = 'applied'")
      .bind(seat.id, application.id),
  ]);
  notify(c, application.musician_email, (lang: Lang) => ({
    subject: t(lang, {
      en: `Welcome to ${band.name}! You have the ${seat.instrument} seat`,
      fr: `Bienvenue dans ${band.name} ! La place de ${seat.instrument} est à vous`,
      de: `Willkommen bei ${band.name}! Der ${seat.instrument}-Platz gehört dir`,
      it: `Benvenuto/a in ${band.name}! Il posto di ${seat.instrument} è tuo`,
    }),
    body: t(lang, { en: 'Contact', fr: 'Contact', de: 'Kontakt', it: 'Contatto' }) + `: ${band.owner_email}\n\n${band.description.slice(0, 300)}`,
  }));
  return c.json({ ok: true, musician_email: application.musician_email });
});

bands.post('/seats/:seatId/close', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const loaded = await loadSeat(c, c.req.param('seatId'));
  if (!loaded) return c.json({ error: 'Seat not found' }, 404);
  const { seat, band } = loaded;
  if (band.owner_email !== user.email) return c.json({ error: 'Only the band owner can close seats' }, 403);
  if (seat.status !== 'open') return c.json({ error: `Seat is ${seat.status}, not open` }, 409);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE band_seats SET status = 'closed' WHERE id = ?").bind(seat.id),
    c.env.DB.prepare("UPDATE seat_applications SET status = 'declined' WHERE seat_id = ? AND status = 'applied'").bind(seat.id),
  ]);
  return c.json({ ok: true });
});

export default bands;
