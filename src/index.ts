// src/index.ts — JamWerk worker entry.
import { Hono } from 'hono';
import { authMiddleware } from './auth';
import authRoutes from './auth';
import gigRoutes, { musicians as musicianRoutes } from './gigs';
import pwaRoutes from './pwa';
import profilePage from './profile-page';
import bandPage from './band-page';
import pushRoutes from './push';
import bandRoutes from './bands';
import messageRoutes from './messages';
import feedbackRoutes from './feedback';
import { PAGE } from './ui';
import type { AppEnv, Env } from './types';
import { notFound } from './not-found';
import placesRoutes from './places-api';

const app = new Hono<AppEnv>();

app.get('/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ status: 'ok' });
  } catch {
    return c.json({ status: 'degraded' }, 503);
  }
});

app.use('*', async (c, next) => {
  await next();
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});
app.use('*', authMiddleware);

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// The SPA shell. Cloudflare's request geolocation is passed to the page as a
// hint (data-geo="CC:Region") — the client uses it ONLY when neither a stored
// choice nor the browser language maps to a supported UI language.
app.get('/', (c) => {
  const cf = (c.req.raw as Request & { cf?: { country?: string; region?: string; city?: string } }).cf;
  const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/[^A-Za-z \-]/g, '').slice(0, 40) : '');
  const geo = cf ? `${clean(cf.country)}:${clean(cf.region) || clean(cf.city)}` : '';
  return c.html(geo && geo !== ':' ? PAGE.replace('<html lang="en">', `<html lang="en" data-geo="${geo}">`) : PAGE);
});
// Mailjet domain-ownership validation (Option 1: empty file on the site).
// Mailjet's DNS-TXT check kept failing on their side even though the record
// resolves; this file is the documented alternative. Harmless to keep.
app.get('/c9430416e4605ac213d863a7ff83f3f8.txt', (c) => c.text(''));
app.route('/', pwaRoutes);
app.route('/auth', authRoutes);
app.route('/gigs', gigRoutes);
app.route('/m', profilePage);
app.route('/b', bandPage);
app.route('/push', pushRoutes);
app.route('/bands', bandRoutes);
app.route('/messages', messageRoutes);
app.route('/musicians', musicianRoutes);
app.route('/feedback', feedbackRoutes);
app.route('/places', placesRoutes);
// Photos from R2. Keys are immutable (uuid), so cache hard.
app.get('/img/:folder/:file', async (c) => {
  const key = `${c.req.param('folder')}/${c.req.param('file')}`;
  if (!c.env.MEDIA || !/^avatars\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) return c.notFound();
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': obj.httpEtag } });
});
app.notFound(notFound);

// Daily housekeeping: flip stale open listings past their expiry to 'expired'
// (paid gigs expire the day after the date, practice listings after 60 days),
// and clear rate-limit rows older than a day.
async function scheduled(_controller: ScheduledController, env: Env): Promise<void> {
  const expired = await env.DB.prepare(
    "UPDATE gigs SET status = 'expired' WHERE status = 'open' AND expires_at < date()"
  ).run();
  const pruned = await env.DB.prepare(
    "DELETE FROM rate_limits WHERE attempted_at < datetime('now', '-1 day')"
  ).run();
  console.log(`Housekeeping: ${expired.meta.changes} listings expired, ${pruned.meta.changes} rate-limit rows pruned`);
}

export default {
  fetch: app.fetch,
  scheduled,
};
