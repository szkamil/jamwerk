// src/admin.ts — reports from users + the smallest admin that keeps you out of D1:
// stats, open reports, ban a user, hide a gig, delete a band. Gated by ADMIN_EMAIL
// (falls back to FEEDBACK_EMAIL). Admin UI is English-only (one person).
import { Hono, Context } from 'hono';
import { sendEmail } from './email';
import { rateLimited, clientIp } from './ratelimit';
import type { AppEnv } from './types';
import { esc } from './profile-page';
import { loadThread } from './messages';

type Ctx = Context<AppEnv>;
export function isAdmin(c: Ctx): boolean {
  const user = c.get('user');
  const admin = (c.env.ADMIN_EMAIL || c.env.FEEDBACK_EMAIL || '').toLowerCase();
  return !!user && !!admin && user.email.toLowerCase() === admin;
}

export const reports = new Hono<AppEnv>();
reports.post('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (await rateLimited(c.env, clientIp(c), 'report', 10, 60)) return c.json({ error: 'Too many reports — slow down' }, 429);
  const body = await c.req.json().catch(() => null);
  const type = body?.type;
  let id = String(body?.id ?? '').slice(0, 100);
  if (type === 'user' && body?.thread_type && body?.thread_id) {
    const th = await loadThread(c, String(body.thread_type), String(body.thread_id));
    if (!th || (th.applicant !== user.email && th.counterparty !== user.email)) return c.json({ error: 'Thread not found' }, 404);
    id = th.applicant === user.email ? th.counterparty : th.applicant;
  }
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 2000) : '';
  if (!['user', 'gig', 'band'].includes(type) || !id) return c.json({ error: 'type (user|gig|band) and id are required' }, 400);
  if (type !== 'user' && !/^\d{1,12}$/.test(id)) return c.json({ error: 'id must be numeric' }, 400);
  if (type === 'user' && !/^[^\s<>"'`]+@[^\s<>"'`]+$/.test(id)) return c.json({ error: 'Report a user from a conversation' }, 400);
  if (reason.length < 3) return c.json({ error: 'Tell us briefly what is wrong' }, 400);
  await c.env.DB.prepare('INSERT INTO reports (reporter_email, target_type, target_id, reason) VALUES (?, ?, ?, ?)').bind(user.email, type, id, reason).run();
  const to = c.env.FEEDBACK_EMAIL;
  if (to) {
    const task = sendEmail(c.env, to, `JamWerk report: ${type} ${id}`, `${reason}\n\nReported by: ${user.email}\n\n${(c.env.BASE_URL || 'https://jamwerk.app')}/admin`, { lang: 'en' });
    try { c.executionCtx.waitUntil(task); } catch { /* tests */ }
  }
  return c.json({ ok: true }, 201);
});

export const admin = new Hono<AppEnv>();
admin.use('*', async (c, next) => {
  if (!isAdmin(c)) return c.text('Not found', 404);
  await next();
});

async function stats(c: Ctx) {
  const q = async (sql: string) => (await c.env.DB.prepare(sql).first<{ n: number }>())?.n ?? 0;
  return {
    users: await q('SELECT COUNT(*) AS n FROM users'),
    users_7d: await q("SELECT COUNT(*) AS n FROM users WHERE created_at > datetime('now', '-7 days')"),
    musicians: await q('SELECT COUNT(*) AS n FROM musician_details WHERE handle IS NOT NULL'),
    gigs_open: await q("SELECT COUNT(*) AS n FROM gigs WHERE status = 'open'"),
    gigs_7d: await q("SELECT COUNT(*) AS n FROM gigs WHERE created_at > datetime('now', '-7 days')"),
    bands: await q('SELECT COUNT(*) AS n FROM bands'),
    messages_7d: await q("SELECT COUNT(*) AS n FROM messages WHERE created_at > datetime('now', '-7 days')"),
    push_subs: await q('SELECT COUNT(*) AS n FROM push_subscriptions'),
    reports_open: await q("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
    banned: await q('SELECT COUNT(*) AS n FROM users WHERE banned = 1'),
  };
}

admin.get('/stats', async (c) => c.json(await stats(c)));

admin.get('/', async (c) => {
  const s = await stats(c);
  const { results: reps } = await c.env.DB.prepare("SELECT * FROM reports WHERE status = 'open' ORDER BY id DESC LIMIT 100").all();
  const { results: recentUsers } = await c.env.DB.prepare('SELECT email, display_name, created_at, confirmed, banned FROM users ORDER BY created_at DESC LIMIT 30').all();
  const row = (r: any) => `<tr><td>${r.id}</td><td>${esc(r.target_type)} ${esc(r.target_id)}</td><td>${esc(r.reason)}</td><td>${esc(r.reporter_email)}</td><td>${esc(r.created_at)}</td>
    <td>${r.target_type === 'user' ? `<button data-act="/admin/ban" data-email="${esc(r.target_id)}">Ban user</button>` : r.target_type === 'gig' ? `<button data-act="/admin/hide-gig" data-id="${Number(r.target_id) || 0}">Hide gig</button>` : `<button data-act="/admin/delete-band" data-id="${Number(r.target_id) || 0}">Delete band</button>`}
    <button data-act="/admin/resolve" data-id="${Number(r.id)}">Resolve</button></td></tr>`;
  const urow = (u: any) => `<tr><td>${esc(u.email)}</td><td>${esc(u.display_name || '')}</td><td>${esc(u.created_at)}</td><td>${u.confirmed ? '✓' : '–'}</td><td>${u.banned ? `<b>banned</b> <button data-act="/admin/unban" data-email="${esc(u.email)}">Unban</button>` : `<button data-act="/admin/ban" data-email="${esc(u.email)}">Ban</button>`}</td></tr>`;
  return c.html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JamWerk admin</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:20px;color:#1b1a16;background:#f4f2ec}h1,h2{font-weight:800}table{border-collapse:collapse;width:100%;background:#fff}td,th{border:1px solid #e5e1d8;padding:6px 8px;text-align:left;vertical-align:top;font-size:13px}button{font:inherit;padding:4px 10px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer}.k{display:inline-block;background:#fff;border:1px solid #e5e1d8;border-radius:10px;padding:8px 12px;margin:0 8px 8px 0}.k b{font-size:20px;display:block}</style>
<h1>JamWerk admin</h1>
<div>${Object.entries(s).map(([k, v]) => `<span class="k"><b>${v}</b>${k.replace(/_/g, ' ')}</span>`).join('')}</div>
<h2>Open reports (${reps.length})</h2>
<table><tr><th>#</th><th>Target</th><th>Reason</th><th>By</th><th>When</th><th></th></tr>${(reps as any[]).map(row).join('') || '<tr><td colspan="6">None</td></tr>'}</table>
<h2>Recent users</h2>
<table><tr><th>Email</th><th>Name</th><th>Joined</th><th>Conf.</th><th></th></tr>${(recentUsers as any[]).map(urow).join('')}</table>
<script>
// Data never goes through inline JS: buttons carry data-* attributes (HTML-escaped), read here.
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const path = b.dataset.act;
  if (!/^\/admin\/[a-z-]+$/.test(path)) return;
  const body = b.dataset.email !== undefined ? { email: b.dataset.email } : { id: Number(b.dataset.id) };
  if (!confirm(path + ' ' + JSON.stringify(body) + ' ?')) return;
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  alert(r.ok ? 'OK' : 'Failed: ' + r.status); if (r.ok) location.reload();
});
</script>`);
});

admin.post('/ban', async (c) => {
  const { email } = await c.req.json().catch(() => ({} as any));
  if (typeof email !== 'string' || !email) return c.json({ error: 'email required' }, 400);
  if (email.toLowerCase() === c.get('user')!.email.toLowerCase()) return c.json({ error: 'Not yourself' }, 400);
  const r = await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET banned = 1 WHERE email = ?').bind(email),
    c.env.DB.prepare("UPDATE gigs SET status = 'cancelled' WHERE poster_email = ? AND status = 'open'").bind(email),
    c.env.DB.prepare('DELETE FROM push_subscriptions WHERE owner = ?').bind(email),
  ]);
  return c.json({ ok: true, changed: r[0].meta.changes });
});
admin.post('/unban', async (c) => {
  const { email } = await c.req.json().catch(() => ({} as any));
  if (typeof email !== 'string' || !email) return c.json({ error: 'email required' }, 400);
  await c.env.DB.prepare('UPDATE users SET banned = 0 WHERE email = ?').bind(email).run();
  return c.json({ ok: true });
});
admin.post('/hide-gig', async (c) => {
  const { id } = await c.req.json().catch(() => ({} as any));
  if (!Number.isInteger(id)) return c.json({ error: 'id required' }, 400);
  const r = await c.env.DB.prepare("UPDATE gigs SET status = 'cancelled' WHERE id = ? AND status IN ('open','booked')").bind(id).run();
  return c.json({ ok: true, changed: r.meta.changes });
});
admin.post('/delete-band', async (c) => {
  const { id } = await c.req.json().catch(() => ({} as any));
  if (!Number.isInteger(id)) return c.json({ error: 'id required' }, 400);
  const r = await c.env.DB.prepare('DELETE FROM bands WHERE id = ?').bind(id).run();
  return c.json({ ok: true, changed: r.meta.changes });
});
admin.post('/resolve', async (c) => {
  const { id } = await c.req.json().catch(() => ({} as any));
  if (!Number.isInteger(id)) return c.json({ error: 'id required' }, 400);
  await c.env.DB.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

/** Daily JSON snapshot of every table into R2 (backups/YYYY-MM-DD.json). Small DB; fine. */
export async function backupToR2(env: AppEnv['Bindings']): Promise<string | null> {
  if (!env.MEDIA) return null;
  const tables = ['users', 'musician_details', 'gigs', 'gig_applications', 'bookings', 'gig_reviews', 'bands', 'band_seats', 'seat_applications', 'band_inquiries', 'dm_threads', 'messages', 'user_blocks', 'reports', 'push_subscriptions', 'feedback'];
  const dump: Record<string, unknown[]> = {};
  for (const t of tables) {
    try { dump[t] = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results; } catch { dump[t] = []; }
  }
  const key = `backups/${new Date().toISOString().slice(0, 10)}.json`;
  await env.MEDIA.put(key, JSON.stringify({ taken_at: new Date().toISOString(), tables: dump }), { httpMetadata: { contentType: 'application/json' } });
  return key;
}
