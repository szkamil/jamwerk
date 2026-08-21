// src/gigs.ts
//
// Gig lifecycle JSON API.
//
//   POST /gigs                     create a gig (poster)
//   GET  /gigs                     open-gig feed with filters
//   GET  /gigs/mine                my posted gigs + my applications
//   GET  /gigs/:id                 gig detail (applications visible to poster only)
//   POST /gigs/:id/apply           apply as a musician
//   POST /gigs/:id/applications/:appId/accept   book a musician (poster)
//   POST /gigs/:id/cancel          cancel (poster)
//   POST /gigs/:id/complete        confirm the gig happened (poster)
//   POST /gigs/:id/review          two-sided post-completion review
//
//   GET  /musicians/me             my musician profile
//   POST /musicians/me             create/update my musician profile
//
// Lifecycle: open -> booked -> completed, with cancelled reachable from
// open/booked. Reviews hang off the booking (one per direction), so a review
// always corresponds to a gig that verifiably happened.
import { Hono, Context } from 'hono';
import type { AppEnv } from './types';

export const INSTRUMENTS = [
  'vocals', 'guitar', 'bass', 'double_bass', 'drums', 'percussion', 'keys',
  'piano', 'accordion', 'violin', 'viola', 'cello', 'trumpet', 'trombone',
  'saxophone', 'clarinet', 'flute', 'harmonica', 'dj', 'other',
] as const;

const MAX_TEXT = 4000;

type Ctx = Context<AppEnv>;

function requireUser(c: Ctx): { email: string } | null {
  return c.get('user') ?? null;
}

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

/** Accept an array of short lowercase slugs; reject anything else. */
function parseSlugArray(v: unknown, max = 10): string[] | null {
  if (!Array.isArray(v) || v.length > max) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string' || !/^[a-z0-9_ -]{1,40}$/.test(item)) return null;
    out.push(item);
  }
  return out;
}

function parseHttpUrlArray(v: unknown, max = 5): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string' || item.length > 300) return null;
    try {
      const u = new URL(item);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    } catch {
      return null;
    }
    out.push(item);
  }
  return out;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// No email provider is wired up yet; log so the intent is visible in
// observability and the call sites are ready for a real sender.
function notify(to: string, subject: string, body: string) {
  console.log(`[NOTIFY] to=${to} subject=${JSON.stringify(subject)} body=${JSON.stringify(body)}`);
}

interface GigRow {
  id: number;
  poster_email: string;
  kind: 'gig' | 'practice';
  instrument: string;
  genres: string;
  gig_date: string | null;
  call_time: string | null;
  end_time: string | null;
  venue_city: string;
  venue_lat: number | null;
  venue_lng: number | null;
  fee_chf: number | null;
  requirements: string;
  setlist_link: string | null;
  description: string;
  status: string;
  created_at: string;
}

/** Public shape: JSON columns parsed, poster hidden until there is a booking. */
function gigToJson(row: GigRow, viewerEmail?: string) {
  const { poster_email, genres, requirements, ...rest } = row;
  return {
    ...rest,
    genres: JSON.parse(genres || '[]'),
    requirements: JSON.parse(requirements || '{}'),
    is_mine: viewerEmail !== undefined && poster_email === viewerEmail,
  };
}

// ─── Musician profile ─────────────────────────────────────────────────────────

export const musicians = new Hono<AppEnv>();

musicians.get('/me', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const row = await c.env.DB.prepare('SELECT * FROM musician_details WHERE owner = ?')
    .bind(user.email)
    .first();
  if (!row) return c.json({ error: 'No musician profile yet' }, 404);
  return c.json({
    ...row,
    instruments: JSON.parse((row.instruments as string) || '[]'),
    genres: JSON.parse((row.genres as string) || '[]'),
    demo_links: JSON.parse((row.demo_links as string) || '[]'),
  });
});

musicians.post('/me', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const instruments = parseSlugArray(body.instruments);
  const genres = parseSlugArray(body.genres);
  const demoLinks = parseHttpUrlArray(body.demo_links);
  if (!instruments || instruments.length === 0 || !instruments.every((i) => (INSTRUMENTS as readonly string[]).includes(i))) {
    return c.json({ error: 'instruments must be a non-empty array of known instruments', known: INSTRUMENTS }, 400);
  }
  if (!genres || genres.length === 0) return c.json({ error: 'genres must be a non-empty array of slugs' }, 400);
  if (!demoLinks) return c.json({ error: 'demo_links must be an array of at most 5 http(s) URLs' }, 400);

  const radius = Number.isInteger(body.travel_radius_km) && body.travel_radius_km > 0 && body.travel_radius_km <= 300
    ? body.travel_radius_km : 30;
  const rateMin = Number.isInteger(body.rate_min) && body.rate_min >= 0 ? body.rate_min : null;
  const rateMax = Number.isInteger(body.rate_max) && body.rate_max >= 0 ? body.rate_max : null;
  if (rateMin !== null && rateMax !== null && rateMin > rateMax) {
    return c.json({ error: 'rate_min must not exceed rate_max' }, 400);
  }
  const homeCity = typeof body.home_city === 'string' ? body.home_city.trim().slice(0, 100) : null;
  const homeLat = typeof body.home_lat === 'number' && Math.abs(body.home_lat) <= 90 ? body.home_lat : null;
  const homeLng = typeof body.home_lng === 'number' && Math.abs(body.home_lng) <= 180 ? body.home_lng : null;
  const flag = (v: unknown) => (v ? 1 : 0);

  await c.env.DB.prepare(
    `INSERT INTO musician_details
       (owner, instruments, genres, reads_charts, sings_backing, own_transport, own_pa,
        travel_radius_km, rate_min, rate_max, demo_links, home_city, home_lat, home_lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner) DO UPDATE SET
       instruments = excluded.instruments, genres = excluded.genres,
       reads_charts = excluded.reads_charts, sings_backing = excluded.sings_backing,
       own_transport = excluded.own_transport, own_pa = excluded.own_pa,
       travel_radius_km = excluded.travel_radius_km,
       rate_min = excluded.rate_min, rate_max = excluded.rate_max,
       demo_links = excluded.demo_links, home_city = excluded.home_city,
       home_lat = excluded.home_lat, home_lng = excluded.home_lng,
       updated_at = datetime('now')`
  ).bind(
    user.email, JSON.stringify(instruments), JSON.stringify(genres),
    flag(body.reads_charts), flag(body.sings_backing), flag(body.own_transport), flag(body.own_pa),
    radius, rateMin, rateMax, JSON.stringify(demoLinks), homeCity, homeLat, homeLng
  ).run();

  return c.json({ ok: true });
});

// ─── Gigs ─────────────────────────────────────────────────────────────────────

const gigs = new Hono<AppEnv>();

gigs.post('/', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  // 'gig' is a dated, paid booking; 'practice' is a free, open-ended jam listing.
  const kind: 'gig' | 'practice' = body.kind === 'practice' ? 'practice' : 'gig';
  const errors: string[] = [];
  if (typeof body.instrument !== 'string' || !(INSTRUMENTS as readonly string[]).includes(body.instrument)) {
    errors.push(`instrument must be one of: ${INSTRUMENTS.join(', ')}`);
  }
  const genres = parseSlugArray(body.genres) ?? [];
  if (genres.length === 0) errors.push('genres must be a non-empty array of slugs');
  const today = new Date().toISOString().slice(0, 10);
  if (kind === 'gig') {
    if (!isIsoDate(body.gig_date)) errors.push('gig_date must be YYYY-MM-DD');
    else if (body.gig_date < today) errors.push('gig_date must not be in the past');
    if (!Number.isInteger(body.fee_chf) || body.fee_chf <= 0 || body.fee_chf > 100000) {
      errors.push('fee_chf must be a positive integer (CHF for the whole gig)');
    }
  } else {
    if (body.fee_chf !== undefined && body.fee_chf !== null) {
      errors.push('practice listings have no fee — omit fee_chf');
    }
    if (body.gig_date !== undefined && !isIsoDate(body.gig_date)) {
      errors.push('gig_date, if given, must be YYYY-MM-DD');
    }
  }
  if (typeof body.venue_city !== 'string' || !body.venue_city.trim()) errors.push('venue_city is required');
  if (typeof body.description !== 'string' || !body.description.trim() || body.description.length > MAX_TEXT) {
    errors.push(`description is required (max ${MAX_TEXT} chars)`);
  }
  if (errors.length) return c.json({ error: 'Validation failed', details: errors }, 400);

  const timeRe = /^\d{2}:\d{2}$/;
  const callTime = timeRe.test(body.call_time) ? body.call_time : null;
  const endTime = timeRe.test(body.end_time) ? body.end_time : null;
  const lat = typeof body.venue_lat === 'number' && Math.abs(body.venue_lat) <= 90 ? body.venue_lat : null;
  const lng = typeof body.venue_lng === 'number' && Math.abs(body.venue_lng) <= 180 ? body.venue_lng : null;
  const setlist = parseHttpUrlArray(body.setlist_link ? [body.setlist_link] : undefined);
  const requirements = body.requirements && typeof body.requirements === 'object' && !Array.isArray(body.requirements)
    ? body.requirements : {};
  // Gigs expire the day after the date; practice listings run 60 days.
  // A scheduled job can flip leftover 'open' rows past expires_at to 'expired'.
  const expiresAt = kind === 'gig'
    ? new Date(Date.parse(body.gig_date) + 86400000).toISOString().slice(0, 10)
    : new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

  const result = await c.env.DB.prepare(
    `INSERT INTO gigs (poster_email, kind, instrument, genres, gig_date, call_time, end_time,
                       venue_city, venue_lat, venue_lng, fee_chf, requirements, setlist_link,
                       description, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    user.email, kind, body.instrument, JSON.stringify(genres),
    isIsoDate(body.gig_date) ? body.gig_date : null, callTime, endTime,
    body.venue_city.trim().slice(0, 100), lat, lng, kind === 'gig' ? body.fee_chf : null,
    JSON.stringify(requirements), setlist && setlist[0] ? setlist[0] : null,
    body.description.trim(), expiresAt
  ).run();

  return c.json({ ok: true, id: result.meta.last_row_id }, 201);
});

gigs.get('/', async (c) => {
  const user = c.get('user');
  const q = c.req.query();
  // The board shows one kind at a time; paid gigs are the default tab.
  const kind = q.kind === 'practice' ? 'practice' : 'gig';
  const conds = ["status = 'open'", 'kind = ?', '(gig_date IS NULL OR gig_date >= date())'];
  const binds: unknown[] = [kind];
  if (q.instrument && (INSTRUMENTS as readonly string[]).includes(q.instrument)) {
    conds.push('instrument = ?');
    binds.push(q.instrument);
  }
  if (q.city) {
    conds.push('LOWER(venue_city) = LOWER(?)');
    binds.push(q.city.trim());
  }
  if (isIsoDate(q.date_from)) { conds.push('gig_date >= ?'); binds.push(q.date_from); }
  if (isIsoDate(q.date_to)) { conds.push('gig_date <= ?'); binds.push(q.date_to); }

  const lat = parseFloat(q.lat), lng = parseFloat(q.lng);
  const radius = Math.min(parseFloat(q.radius_km) || 50, 300);
  const geo = !isNaN(lat) && !isNaN(lng);
  if (geo) {
    // Cheap bounding box in SQL (D1 has no trig), exact distance refined below.
    const dLat = radius / 111;
    const dLng = radius / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1));
    conds.push('venue_lat BETWEEN ? AND ?', 'venue_lng BETWEEN ? AND ?');
    binds.push(lat - dLat, lat + dLat, lng - dLng, lng + dLng);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM gigs WHERE ${conds.join(' AND ')} ORDER BY ${kind === 'gig' ? 'gig_date ASC' : 'created_at DESC'} LIMIT 100`
  ).bind(...binds).all();

  let rows = results as unknown as GigRow[];
  let withDistance = rows.map((r) => ({ row: r, distance_km: null as number | null }));
  if (geo) {
    withDistance = withDistance
      .map((e) => ({ ...e, distance_km: e.row.venue_lat !== null && e.row.venue_lng !== null
        ? Math.round(haversineKm(lat, lng, e.row.venue_lat, e.row.venue_lng) * 10) / 10 : null }))
      .filter((e) => e.distance_km !== null && e.distance_km <= radius);
  }
  return c.json({
    gigs: withDistance.map((e) => ({ ...gigToJson(e.row, user?.email), distance_km: e.distance_km })),
  });
});

gigs.get('/mine', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const [posted, applied] = await Promise.all([
    c.env.DB.prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM gig_applications a WHERE a.gig_id = g.id AND a.status != 'withdrawn') AS application_count
       FROM gigs g WHERE poster_email = ? ORDER BY gig_date DESC LIMIT 100`
    ).bind(user.email).all(),
    c.env.DB.prepare(
      `SELECT a.id AS application_id, a.status AS application_status, a.note, g.*
       FROM gig_applications a JOIN gigs g ON g.id = a.gig_id
       WHERE a.musician_email = ? ORDER BY g.gig_date DESC LIMIT 100`
    ).bind(user.email).all(),
  ]);
  return c.json({
    posted: (posted.results as any[]).map((r) => ({ ...gigToJson(r, user.email), application_count: r.application_count })),
    applications: (applied.results as any[]).map((r) => ({
      ...gigToJson(r, user.email),
      application_id: r.application_id,
      application_status: r.application_status,
      note: r.note,
    })),
  });
});

async function loadGig(c: Ctx, id: string): Promise<GigRow | null> {
  if (!/^\d+$/.test(id)) return null;
  return await c.env.DB.prepare('SELECT * FROM gigs WHERE id = ?').bind(id).first<GigRow>();
}

gigs.get('/:id', async (c) => {
  const user = c.get('user');
  const gig = await loadGig(c, c.req.param('id'));
  if (!gig) return c.json({ error: 'Gig not found' }, 404);

  const out: Record<string, unknown> = gigToJson(gig, user?.email);
  if (user && gig.poster_email === user.email) {
    const { results } = await c.env.DB.prepare(
      `SELECT a.id, a.musician_email, a.note, a.status, a.created_at,
              m.instruments, m.genres, m.demo_links, m.gigs_played, m.reads_charts, m.rate_min, m.rate_max
       FROM gig_applications a
       LEFT JOIN musician_details m ON m.owner = a.musician_email
       WHERE a.gig_id = ? AND a.status != 'withdrawn'
       ORDER BY a.created_at ASC`
    ).bind(gig.id).all();
    out.applications = (results as any[]).map((a) => ({
      ...a,
      instruments: JSON.parse(a.instruments || '[]'),
      genres: JSON.parse(a.genres || '[]'),
      demo_links: JSON.parse(a.demo_links || '[]'),
    }));
  }
  if (user) {
    const booking = await c.env.DB.prepare(
      'SELECT * FROM bookings WHERE gig_id = ? AND (musician_email = ? OR ? = ?)'
    ).bind(gig.id, user.email, gig.poster_email, user.email).first();
    if (booking) out.booking = booking;
  }
  return c.json(out);
});

gigs.post('/:id/apply', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const gig = await loadGig(c, c.req.param('id'));
  if (!gig) return c.json({ error: 'Gig not found' }, 404);
  if (gig.poster_email === user.email) return c.json({ error: 'You cannot apply to your own gig' }, 403);
  if (gig.status !== 'open') return c.json({ error: `Gig is ${gig.status}, not open` }, 409);

  const musician = await c.env.DB.prepare('SELECT owner FROM musician_details WHERE owner = ?')
    .bind(user.email).first();
  if (!musician) return c.json({ error: 'Create your musician profile first' }, 403);

  const body = await c.req.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, MAX_TEXT) : '';

  try {
    await c.env.DB.prepare(
      'INSERT INTO gig_applications (gig_id, musician_email, note) VALUES (?, ?, ?)'
    ).bind(gig.id, user.email, note).run();
  } catch (err: any) {
    if (String(err?.message || err).includes('UNIQUE')) {
      return c.json({ error: 'You already applied to this gig' }, 409);
    }
    throw err;
  }

  notify(gig.poster_email,
    gig.kind === 'practice'
      ? `New practice partner request in ${gig.venue_city}`
      : `New application for your gig on ${gig.gig_date}`,
    `${user.email}${note ? `\n\n${note}` : ''}`);
  return c.json({ ok: true }, 201);
});

gigs.post('/:id/applications/:appId/accept', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const gig = await loadGig(c, c.req.param('id'));
  if (!gig) return c.json({ error: 'Gig not found' }, 404);
  if (gig.poster_email !== user.email) return c.json({ error: 'Only the poster can accept applications' }, 403);

  const appId = c.req.param('appId');
  const application = await c.env.DB.prepare(
    "SELECT * FROM gig_applications WHERE id = ? AND gig_id = ? AND status IN ('applied','shortlisted')"
  ).bind(appId, gig.id).first<{ id: number; musician_email: string }>();
  if (!application) return c.json({ error: 'Application not found or no longer active' }, 404);

  // Practice listings have no single winner: accepting connects the two
  // musicians (contact shared) and leaves the listing open for more partners.
  if (gig.kind === 'practice') {
    if (gig.status !== 'open') return c.json({ error: `Listing is ${gig.status}, not open` }, 409);
    await c.env.DB.prepare("UPDATE gig_applications SET status = 'accepted' WHERE id = ?")
      .bind(application.id).run();
    notify(application.musician_email, `Practice match in ${gig.venue_city}!`,
      `The poster accepted you.\nContact: ${gig.poster_email}\n\n${gig.description}`);
    return c.json({ ok: true, musician_email: application.musician_email });
  }

  // Claim the gig first; meta.changes = 0 means someone was accepted concurrently.
  const claim = await c.env.DB.prepare(
    "UPDATE gigs SET status = 'booked' WHERE id = ? AND status = 'open'"
  ).bind(gig.id).run();
  if (!claim.meta.changes) return c.json({ error: 'Gig is no longer open' }, 409);

  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO bookings (gig_id, musician_email, agreed_fee_chf) VALUES (?, ?, ?)')
      .bind(gig.id, application.musician_email, gig.fee_chf),
    c.env.DB.prepare("UPDATE gig_applications SET status = 'accepted' WHERE id = ?")
      .bind(application.id),
    c.env.DB.prepare(
      "UPDATE gig_applications SET status = 'declined' WHERE gig_id = ? AND id != ? AND status IN ('applied','shortlisted')"
    ).bind(gig.id, application.id),
  ]);

  notify(application.musician_email, `You're booked! Gig on ${gig.gig_date} in ${gig.venue_city}`,
    `CHF ${gig.fee_chf} · ${gig.venue_city} · ${gig.gig_date}\nContact: ${gig.poster_email}`);
  return c.json({ ok: true, musician_email: application.musician_email });
});

gigs.post('/:id/cancel', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const gig = await loadGig(c, c.req.param('id'));
  if (!gig) return c.json({ error: 'Gig not found' }, 404);
  if (gig.poster_email !== user.email) return c.json({ error: 'Only the poster can cancel' }, 403);
  if (gig.status !== 'open' && gig.status !== 'booked') {
    return c.json({ error: `Gig is ${gig.status} and cannot be cancelled` }, 409);
  }

  const body = await c.req.json().catch(() => ({}));
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, MAX_TEXT) : '';
  const booking = await c.env.DB.prepare('SELECT musician_email FROM bookings WHERE gig_id = ? AND completed_at IS NULL AND cancelled_at IS NULL')
    .bind(gig.id).first<{ musician_email: string }>();

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE gigs SET status = 'cancelled' WHERE id = ?").bind(gig.id),
    c.env.DB.prepare(
      "UPDATE bookings SET cancelled_by = ?, cancelled_at = datetime('now'), cancel_reason = ? WHERE gig_id = ? AND completed_at IS NULL AND cancelled_at IS NULL"
    ).bind(user.email, reason, gig.id),
  ]);

  if (booking) {
    notify(booking.musician_email, `Gig cancelled: ${gig.gig_date} in ${gig.venue_city}`, reason || '-');
  }
  return c.json({ ok: true });
});

gigs.post('/:id/complete', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const gig = await loadGig(c, c.req.param('id'));
  if (!gig) return c.json({ error: 'Gig not found' }, 404);
  if (gig.poster_email !== user.email) return c.json({ error: 'Only the poster can confirm completion' }, 403);
  if (gig.kind !== 'gig') return c.json({ error: 'Practice listings have no completion — close them with cancel' }, 409);
  if (gig.status !== 'booked') return c.json({ error: `Gig is ${gig.status}, not booked` }, 409);

  const booking = await c.env.DB.prepare('SELECT id, musician_email FROM bookings WHERE gig_id = ? AND cancelled_at IS NULL')
    .bind(gig.id).first<{ id: number; musician_email: string }>();
  if (!booking) return c.json({ error: 'No active booking for this gig' }, 409);

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE gigs SET status = 'completed' WHERE id = ?").bind(gig.id),
    c.env.DB.prepare("UPDATE bookings SET completed_at = datetime('now') WHERE id = ?").bind(booking.id),
    c.env.DB.prepare('UPDATE musician_details SET gigs_played = gigs_played + 1 WHERE owner = ?')
      .bind(booking.musician_email),
  ]);
  return c.json({ ok: true });
});

gigs.post('/:id/review', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const gig = await loadGig(c, c.req.param('id'));
  if (!gig) return c.json({ error: 'Gig not found' }, 404);
  if (gig.kind !== 'gig') return c.json({ error: 'Practice listings are not reviewable' }, 409);
  if (gig.status !== 'completed') return c.json({ error: 'Reviews open once the gig is completed' }, 409);

  const booking = await c.env.DB.prepare('SELECT id, musician_email FROM bookings WHERE gig_id = ?')
    .bind(gig.id).first<{ id: number; musician_email: string }>();
  if (!booking) return c.json({ error: 'No booking for this gig' }, 409);

  let direction: string, reviewee: string;
  if (user.email === gig.poster_email) {
    direction = 'poster_to_musician';
    reviewee = booking.musician_email;
  } else if (user.email === booking.musician_email) {
    direction = 'musician_to_poster';
    reviewee = gig.poster_email;
  } else {
    return c.json({ error: 'Only the poster or the booked musician can review' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  const rating = body?.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return c.json({ error: 'rating must be an integer 1-5' }, 400);
  }
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, MAX_TEXT) : '';

  try {
    await c.env.DB.prepare(
      'INSERT INTO gig_reviews (booking_id, direction, reviewer_email, reviewee_email, rating, comment) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(booking.id, direction, user.email, reviewee, rating, comment).run();
  } catch (err: any) {
    if (String(err?.message || err).includes('UNIQUE')) {
      return c.json({ error: 'You already reviewed this gig' }, 409);
    }
    throw err;
  }
  return c.json({ ok: true }, 201);
});

export default gigs;
