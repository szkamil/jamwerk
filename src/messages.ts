// src/messages.ts — in-app messaging, one thread per application.
//
//   GET  /messages/threads            my conversations (gig + band-seat)
//   GET  /messages/:type/:appId       messages in one thread (marks them read)
//   POST /messages/:type/:appId       send a message
//
// thread_type 'gig' keys gig_applications.id; 'seat' keys seat_applications.id.
// Only the applicant and the gig poster / band owner can read or post, and
// each side sees the other's display name, never the email — the booking flow
// stays the only place contact details change hands.
import { Hono, Context } from 'hono';
import { notify } from './email';
import { rateLimited, clientIp } from './ratelimit';
import { Lang, t } from './i18n';
import type { AppEnv } from './types';

type Ctx = Context<AppEnv>;
type ThreadType = 'gig' | 'seat';

interface Thread {
  applicant: string;
  counterparty: string;   // gig poster / band owner
  context: string;        // human label for the conversation
}

async function loadThread(c: Ctx, type: string, appId: string): Promise<Thread | null> {
  if (!/^\d+$/.test(appId)) return null;
  if (type === 'gig') {
    const row = await c.env.DB.prepare(
      `SELECT a.musician_email, g.poster_email, g.instrument, g.venue_city, g.gig_date, g.kind
       FROM gig_applications a JOIN gigs g ON g.id = a.gig_id WHERE a.id = ?`
    ).bind(appId).first<any>();
    if (!row) return null;
    return {
      applicant: row.musician_email,
      counterparty: row.poster_email,
      context: `${row.instrument} · ${row.venue_city}${row.gig_date ? ' · ' + row.gig_date : ''}`,
    };
  }
  if (type === 'seat') {
    const row = await c.env.DB.prepare(
      `SELECT a.musician_email, b.owner_email, b.name, s.instrument
       FROM seat_applications a
       JOIN band_seats s ON s.id = a.seat_id
       JOIN bands b ON b.id = s.band_id WHERE a.id = ?`
    ).bind(appId).first<any>();
    if (!row) return null;
    return {
      applicant: row.musician_email,
      counterparty: row.owner_email,
      context: `${row.name} · ${row.instrument}`,
    };
  }
  return null;
}

function participant(thread: Thread, email: string): boolean {
  return thread.applicant === email || thread.counterparty === email;
}

const messages = new Hono<AppEnv>();

messages.get('/threads', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const me = user.email;

  const gigRows = await c.env.DB.prepare(
    `SELECT a.id AS thread_id, 'gig' AS thread_type,
            a.musician_email, g.poster_email, g.instrument, g.venue_city, g.gig_date,
            um.display_name AS musician_name, up.display_name AS poster_name,
            (SELECT body FROM messages m WHERE m.thread_type = 'gig' AND m.thread_id = a.id ORDER BY m.id DESC LIMIT 1) AS last_body,
            (SELECT created_at FROM messages m WHERE m.thread_type = 'gig' AND m.thread_id = a.id ORDER BY m.id DESC LIMIT 1) AS last_at,
            (SELECT COUNT(*) FROM messages m WHERE m.thread_type = 'gig' AND m.thread_id = a.id AND m.sender_email != ? AND m.is_read = 0) AS unread
     FROM gig_applications a
     JOIN gigs g ON g.id = a.gig_id
     JOIN users um ON um.email = a.musician_email
     JOIN users up ON up.email = g.poster_email
     WHERE a.musician_email = ? OR g.poster_email = ?`
  ).bind(me, me, me).all();

  const seatRows = await c.env.DB.prepare(
    `SELECT a.id AS thread_id, 'seat' AS thread_type,
            a.musician_email, b.owner_email AS poster_email, s.instrument, b.name AS band_name,
            um.display_name AS musician_name, up.display_name AS poster_name,
            (SELECT body FROM messages m WHERE m.thread_type = 'seat' AND m.thread_id = a.id ORDER BY m.id DESC LIMIT 1) AS last_body,
            (SELECT created_at FROM messages m WHERE m.thread_type = 'seat' AND m.thread_id = a.id ORDER BY m.id DESC LIMIT 1) AS last_at,
            (SELECT COUNT(*) FROM messages m WHERE m.thread_type = 'seat' AND m.thread_id = a.id AND m.sender_email != ? AND m.is_read = 0) AS unread
     FROM seat_applications a
     JOIN band_seats s ON s.id = a.seat_id
     JOIN bands b ON b.id = s.band_id
     JOIN users um ON um.email = a.musician_email
     JOIN users up ON up.email = b.owner_email
     WHERE a.musician_email = ? OR b.owner_email = ?`
  ).bind(me, me, me).all();

  const threads = [...(gigRows.results as any[]), ...(seatRows.results as any[])].map((r) => {
    const iAmApplicant = r.musician_email === me;
    const otherEmail = iAmApplicant ? r.poster_email : r.musician_email;
    const otherName = iAmApplicant ? r.poster_name : r.musician_name;
    return {
      thread_type: r.thread_type,
      thread_id: r.thread_id,
      counterpart: otherName || otherEmail.split('@')[0],
      context: r.thread_type === 'gig'
        ? `${r.instrument} · ${r.venue_city}${r.gig_date ? ' · ' + r.gig_date : ''}`
        : `${r.band_name} · ${r.instrument}`,
      last_body: r.last_body,
      last_at: r.last_at,
      unread: r.unread,
    };
  });
  threads.sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
  return c.json({ threads, unread_total: threads.reduce((n, x) => n + x.unread, 0) });
});

messages.get('/:type/:appId', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const thread = await loadThread(c, c.req.param('type'), c.req.param('appId'));
  if (!thread) return c.json({ error: 'Thread not found' }, 404);
  if (!participant(thread, user.email)) return c.json({ error: 'Not your conversation' }, 403);

  const { results } = await c.env.DB.prepare(
    'SELECT id, sender_email, body, created_at FROM messages WHERE thread_type = ? AND thread_id = ? ORDER BY id ASC LIMIT 200'
  ).bind(c.req.param('type'), c.req.param('appId')).all();
  await c.env.DB.prepare(
    'UPDATE messages SET is_read = 1 WHERE thread_type = ? AND thread_id = ? AND sender_email != ? AND is_read = 0'
  ).bind(c.req.param('type'), c.req.param('appId'), user.email).run();

  return c.json({
    context: thread.context,
    messages: (results as any[]).map((m) => ({
      id: m.id,
      mine: m.sender_email === user.email,
      body: m.body,
      created_at: m.created_at,
    })),
  });
});

messages.post('/:type/:appId', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (await rateLimited(c.env, clientIp(c), 'message', 60, 60)) {
    return c.json({ error: 'Too many messages — slow down a little' }, 429);
  }
  const thread = await loadThread(c, c.req.param('type'), c.req.param('appId'));
  if (!thread) return c.json({ error: 'Thread not found' }, 404);
  if (!participant(thread, user.email)) return c.json({ error: 'Not your conversation' }, 403);

  const reqBody = await c.req.json().catch(() => null);
  const text = typeof reqBody?.body === 'string' ? reqBody.body.trim().slice(0, 4000) : '';
  if (!text) return c.json({ error: 'Message body is required' }, 400);

  const recipient = thread.applicant === user.email ? thread.counterparty : thread.applicant;

  // Notify only when the recipient has nothing unread here yet — one nudge per
  // catch-up, not one email per message.
  const pending = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM messages WHERE thread_type = ? AND thread_id = ? AND sender_email = ? AND is_read = 0'
  ).bind(c.req.param('type'), c.req.param('appId'), user.email).first<{ n: number }>();

  await c.env.DB.prepare(
    'INSERT INTO messages (thread_type, thread_id, sender_email, body) VALUES (?, ?, ?, ?)'
  ).bind(c.req.param('type'), c.req.param('appId'), user.email, text).run();

  if ((pending?.n ?? 0) === 0) {
    const sender = await c.env.DB.prepare('SELECT display_name FROM users WHERE email = ?')
      .bind(user.email).first<{ display_name: string }>();
    const name = sender?.display_name || user.email.split('@')[0];
    notify(c, recipient, (lang: Lang) => ({
      subject: t(lang, {
        en: `New message from ${name} — ${thread.context}`,
        fr: `Nouveau message de ${name} — ${thread.context}`,
        de: `Neue Nachricht von ${name} — ${thread.context}`,
        it: `Nuovo messaggio da ${name} — ${thread.context}`,
      }),
      body: text.slice(0, 200) + '\n\nhttps://jamwerk.app',
    }));
  }
  return c.json({ ok: true }, 201);
});

export default messages;
