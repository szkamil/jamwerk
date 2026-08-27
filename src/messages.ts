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
type ThreadType = 'gig' | 'seat' | 'band' | 'dm';

/** True when either side has blocked the other. */
export async function isBlocked(env: AppEnv['Bindings'], a: string, b: string): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT 1 AS x FROM user_blocks WHERE (blocker_email = ? AND blocked_email = ?) OR (blocker_email = ? AND blocked_email = ?) LIMIT 1'
  ).bind(a, b, b, a).first();
  return !!row;
}

interface Thread {
  applicant: string;
  counterparty: string;   // gig poster / band owner
  context: string;        // human label for the conversation
}

export async function loadThread(c: Ctx, type: string, appId: string): Promise<Thread | null> {
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
  if (type === 'band') {
    const row = await c.env.DB.prepare(
      `SELECT i.from_email, b.owner_email, b.name FROM band_inquiries i JOIN bands b ON b.id = i.band_id WHERE i.id = ?`
    ).bind(appId).first<any>();
    if (!row) return null;
    return { applicant: row.from_email, counterparty: row.owner_email, context: row.name };
  }
  if (type === 'dm') {
    const row = await c.env.DB.prepare('SELECT a_email, b_email, started_by FROM dm_threads WHERE id = ?').bind(appId).first<any>();
    if (!row) return null;
    const other = row.started_by === row.a_email ? row.b_email : row.a_email;
    return { applicant: row.started_by, counterparty: other, context: '' };
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

  const bandRows = await c.env.DB.prepare(
    `SELECT i.id AS thread_id, 'band' AS thread_type,
            i.from_email AS musician_email, b.owner_email AS poster_email, b.name AS band_name,
            um.display_name AS musician_name, up.display_name AS poster_name,
            (SELECT body FROM messages m WHERE m.thread_type = 'band' AND m.thread_id = i.id ORDER BY m.id DESC LIMIT 1) AS last_body,
            (SELECT created_at FROM messages m WHERE m.thread_type = 'band' AND m.thread_id = i.id ORDER BY m.id DESC LIMIT 1) AS last_at,
            (SELECT COUNT(*) FROM messages m WHERE m.thread_type = 'band' AND m.thread_id = i.id AND m.sender_email != ? AND m.is_read = 0) AS unread
     FROM band_inquiries i
     JOIN bands b ON b.id = i.band_id
     JOIN users um ON um.email = i.from_email
     JOIN users up ON up.email = b.owner_email
     WHERE i.from_email = ? OR b.owner_email = ?`
  ).bind(me, me, me).all();

  const dmRows = await c.env.DB.prepare(
    `SELECT d.id AS thread_id, 'dm' AS thread_type,
            d.started_by AS musician_email,
            CASE WHEN d.started_by = d.a_email THEN d.b_email ELSE d.a_email END AS poster_email,
            um.display_name AS musician_name, up.display_name AS poster_name,
            (SELECT body FROM messages m WHERE m.thread_type = 'dm' AND m.thread_id = d.id ORDER BY m.id DESC LIMIT 1) AS last_body,
            (SELECT created_at FROM messages m WHERE m.thread_type = 'dm' AND m.thread_id = d.id ORDER BY m.id DESC LIMIT 1) AS last_at,
            (SELECT COUNT(*) FROM messages m WHERE m.thread_type = 'dm' AND m.thread_id = d.id AND m.sender_email != ? AND m.is_read = 0) AS unread
     FROM dm_threads d
     JOIN users um ON um.email = d.started_by
     JOIN users up ON up.email = CASE WHEN d.started_by = d.a_email THEN d.b_email ELSE d.a_email END
     WHERE d.a_email = ? OR d.b_email = ?`
  ).bind(me, me, me).all();

  const threads = [...(gigRows.results as any[]), ...(seatRows.results as any[]), ...(bandRows.results as any[]), ...(dmRows.results as any[])].map((r) => {
    const iAmApplicant = r.musician_email === me;
    const otherEmail = iAmApplicant ? r.poster_email : r.musician_email;
    const otherName = iAmApplicant ? r.poster_name : r.musician_name;
    return {
      thread_type: r.thread_type,
      thread_id: r.thread_id,
      counterpart: otherName || otherEmail.split('@')[0],
      context: r.thread_type === 'gig'
        ? `${r.instrument} · ${r.venue_city}${r.gig_date ? ' · ' + r.gig_date : ''}`
        : r.thread_type === 'band' ? `${r.band_name}` : r.thread_type === 'dm' ? '' : `${r.band_name} · ${r.instrument}`,
      last_body: r.last_body,
      last_at: r.last_at,
      unread: r.unread,
    };
  });
  const { results: myBlocks } = await c.env.DB.prepare('SELECT blocked_email FROM user_blocks WHERE blocker_email = ?').bind(me).all();
  const blockedSet = new Set((myBlocks as any[]).map((r) => r.blocked_email));
  const visible = threads.filter((th, i) => {
    const r = [...(gigRows.results as any[]), ...(seatRows.results as any[]), ...(bandRows.results as any[]), ...(dmRows.results as any[])][i];
    const other = r.musician_email === me ? r.poster_email : r.musician_email;
    return !blockedSet.has(other);
  });
  threads.length = 0; threads.push(...visible);
  threads.sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
  return c.json({ threads, unread_total: threads.reduce((n, x) => n + x.unread, 0) });
});

messages.get('/:type/:appId', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const thread = await loadThread(c, c.req.param('type'), c.req.param('appId'));
  if (!thread) return c.json({ error: 'Thread not found' }, 404);
  if (!participant(thread, user.email)) return c.json({ error: 'Not your conversation' }, 403);

  const after = parseInt(c.req.query('after') || '0', 10) || 0;
  const { results } = await c.env.DB.prepare(
    'SELECT id, sender_email, body, created_at FROM messages WHERE thread_type = ? AND thread_id = ? AND id > ? ORDER BY id ASC LIMIT 500'
  ).bind(c.req.param('type'), c.req.param('appId'), after).all();
  await c.env.DB.prepare(
    'UPDATE messages SET is_read = 1 WHERE thread_type = ? AND thread_id = ? AND sender_email != ? AND is_read = 0'
  ).bind(c.req.param('type'), c.req.param('appId'), user.email).run();

  const other = thread.applicant === user.email ? thread.counterparty : thread.applicant;
  const blk = await c.env.DB.prepare('SELECT 1 AS x FROM user_blocks WHERE blocker_email = ? AND blocked_email = ?').bind(user.email, other).first();
  const seen = await c.env.DB.prepare('SELECT MAX(id) AS id FROM messages WHERE thread_type = ? AND thread_id = ? AND sender_email = ? AND is_read = 1').bind(c.req.param('type'), c.req.param('appId'), user.email).first<{ id: number | null }>();
  return c.json({
    context: thread.context,
    blocked_by_me: !!blk,
    seen_up_to: seen?.id ?? 0,
    messages: (results as any[]).map((m) => ({
      id: m.id,
      mine: m.sender_email === user.email,
      body: m.body,
      created_at: m.created_at,
    })),
  });
});

// Start (or reuse) a direct-message thread with a musician by public handle.
// Anti-abuse (PLAN.md): login + confirmed email, recipient opt-in (accepts_dm),
// at most 3 new conversations per day per sender.
// Block / unblock. Block by thread (the other participant) or by public handle.
messages.get('/blocks', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const { results } = await c.env.DB.prepare(
    `SELECT b.blocked_email AS email, u.display_name, m.handle FROM user_blocks b
     JOIN users u ON u.email = b.blocked_email LEFT JOIN musician_details m ON m.owner = b.blocked_email
     WHERE b.blocker_email = ? ORDER BY b.created_at DESC`
  ).bind(user.email).all();
  return c.json({ blocks: (results as any[]).map((r) => ({ email: r.email, name: r.display_name || r.email.split('@')[0], handle: r.handle })) });
});
messages.post('/block', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const body = await c.req.json().catch(() => null);
  let target: string | null = null;
  if (body?.thread_type && body?.thread_id) {
    const thread = await loadThread(c, String(body.thread_type), String(body.thread_id));
    if (!thread || !participant(thread, user.email)) return c.json({ error: 'Thread not found' }, 404);
    target = thread.applicant === user.email ? thread.counterparty : thread.applicant;
  } else if (typeof body?.handle === 'string') {
    const row = await c.env.DB.prepare('SELECT owner FROM musician_details WHERE handle = ?').bind(body.handle.trim().toLowerCase()).first<{ owner: string }>();
    target = row?.owner ?? null;
  }
  if (!target) return c.json({ error: 'Nobody to block' }, 404);
  if (target === user.email) return c.json({ error: 'That is you' }, 400);
  if (body.unblock) {
    await c.env.DB.prepare('DELETE FROM user_blocks WHERE blocker_email = ? AND blocked_email = ?').bind(user.email, target).run();
    return c.json({ ok: true, blocked: false });
  }
  await c.env.DB.prepare('INSERT OR IGNORE INTO user_blocks (blocker_email, blocked_email) VALUES (?, ?)').bind(user.email, target).run();
  return c.json({ ok: true, blocked: true });
});

// Existing DM thread with a musician (by handle), if any — lets the client open the
// conversation page directly instead of a prompt.
messages.get('/dm/with/:handle', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const handle = c.req.param('handle').toLowerCase();
  const target = await c.env.DB.prepare('SELECT m.owner, m.accepts_dm, u.display_name FROM musician_details m JOIN users u ON u.email = m.owner WHERE m.handle = ?')
    .bind(handle).first<{ owner: string; accepts_dm: number; display_name: string }>();
  if (!target) return c.json({ error: 'Musician not found' }, 404);
  const [a, b] = [user.email, target.owner].sort();
  const existing = await c.env.DB.prepare('SELECT id FROM dm_threads WHERE a_email = ? AND b_email = ?').bind(a, b).first<{ id: number }>();
  return c.json({ thread_id: existing?.id ?? null, counterpart: target.display_name || target.owner.split('@')[0], accepts_dm: target.accepts_dm !== 0 });
});

messages.post('/dm', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const body = await c.req.json().catch(() => null);
  const handle = typeof body?.handle === 'string' ? body.handle.trim().toLowerCase() : '';
  const text = typeof body?.message === 'string' ? body.message.trim().slice(0, 4000) : '';
  if (!/^[a-z0-9-]{1,50}$/.test(handle)) return c.json({ error: 'handle is required' }, 400);
  if (text.length < 5) return c.json({ error: 'Message must be at least 5 characters' }, 400);
  const sender = await c.env.DB.prepare('SELECT confirmed, display_name FROM users WHERE email = ?').bind(user.email).first<{ confirmed: number; display_name: string }>();
  if (!sender?.confirmed) return c.json({ error: 'Confirm your email address before sending direct messages', code: 'email_unconfirmed' }, 403);
  const target = await c.env.DB.prepare('SELECT m.owner, m.accepts_dm, u.display_name FROM musician_details m JOIN users u ON u.email = m.owner WHERE m.handle = ?')
    .bind(handle).first<{ owner: string; accepts_dm: number; display_name: string }>();
  if (!target) return c.json({ error: 'Musician not found' }, 404);
  if (target.owner === user.email) return c.json({ error: 'That is you' }, 400);
  if (target.accepts_dm === 0) return c.json({ error: 'This musician does not accept direct messages', code: 'dm_closed' }, 403);
  if (await isBlocked(c.env, user.email, target.owner)) return c.json({ error: 'You cannot message this person', code: 'blocked' }, 403);
  const [a, b] = [user.email, target.owner].sort();
  const existing = await c.env.DB.prepare('SELECT id FROM dm_threads WHERE a_email = ? AND b_email = ?').bind(a, b).first<{ id: number }>();
  let threadId = existing?.id;
  if (!threadId) {
    const today = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM dm_threads WHERE started_by = ? AND created_at > datetime('now', '-1 day')").bind(user.email).first<{ n: number }>();
    if ((today?.n ?? 0) >= 3) return c.json({ error: 'You can start up to 3 new conversations per day' }, 429);
    const ins = await c.env.DB.prepare('INSERT INTO dm_threads (a_email, b_email, started_by) VALUES (?, ?, ?)').bind(a, b, user.email).run();
    threadId = ins.meta.last_row_id as number;
  }
  await c.env.DB.prepare("INSERT INTO messages (thread_type, thread_id, sender_email, body) VALUES ('dm', ?, ?, ?)").bind(threadId, user.email, text).run();
  const name = sender.display_name || user.email.split('@')[0];
  notify(c, target.owner, (lang: Lang) => ({
    subject: t(lang, { en: `New message from ${name}`, fr: `Nouveau message de ${name}`, de: `Neue Nachricht von ${name}`, it: `Nuovo messaggio da ${name}` }),
    body: text.slice(0, 300) + '\n\nhttps://jamwerk.app',
  }));
  return c.json({ ok: true, thread_type: 'dm', thread_id: threadId, counterpart: target.display_name || target.owner.split('@')[0] }, 201);
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
  if (await isBlocked(c.env, user.email, recipient)) return c.json({ error: 'You cannot message this person', code: 'blocked' }, 403);

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
