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
  const genres = parseSlugArray(body.genres) ?? [];
  const seats = parseSlugArray(body.seats, 12) ?? [];
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : '';
  const links = parseLinks(body.links);
  if (links === null) return c.json({ error: 'links must be up to 5 valid http(s) URLs' }, 400);
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
    'INSERT INTO bands (owner_email, name, genres, home_city, home_lat, home_lng, description, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(user.email, name, JSON.stringify(genres), homeCity, lat, lng, description, JSON.stringify(links)).run();
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
  const { results } = await c.env.DB.prepare(
    `SELECT b.*, u.display_name AS owner_name,
       (SELECT COUNT(*) FROM band_seats s WHERE s.band_id = b.id AND s.status = 'filled') AS filled_count
     FROM bands b JOIN users u ON u.email = b.owner_email
     ORDER BY b.created_at DESC LIMIT 100`
  ).all();
  const bandsOut = [];
  for (const b of results as any[]) {
    const { results: seats } = await c.env.DB.prepare(
      "SELECT id, instrument, status FROM band_seats WHERE band_id = ? ORDER BY id"
    ).bind(b.id).all();
    bandsOut.push({
      id: b.id,
      name: b.name,
      genres: JSON.parse(b.genres || '[]'),
      home_city: b.home_city,
      description: b.description,
      links: JSON.parse(b.links || '[]'),
      media: (JSON.parse(b.links || '[]') as string[]).map(classifyMedia).filter(Boolean),
      owner_name: b.owner_name || b.owner_email.split('@')[0],
      member_count: 1 + b.filled_count,
      open_seats: (seats as any[]).filter((s) => s.status === 'open').map((s) => ({ id: s.id, instrument: s.instrument })),
      is_mine: user !== undefined && user !== null && b.owner_email === user.email,
    });
  }
  return c.json({ bands: bandsOut });
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

  const out: Record<string, unknown> = {
    id: band.id,
    name: band.name,
    genres: JSON.parse(band.genres || '[]'),
    home_city: band.home_city,
    description: band.description,
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
