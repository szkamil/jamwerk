// src/index.ts — JamWerk worker entry.
import { Hono } from 'hono';
import { authMiddleware } from './auth';
import authRoutes from './auth';
import gigRoutes, { musicians as musicianRoutes } from './gigs';
import pwaRoutes from './pwa';
import profilePage from './profile-page';
import bandPage from './band-page';
import aboutPage from './about-page';
import pushRoutes from './push';
import bandRoutes from './bands';
import messageRoutes from './messages';
import feedbackRoutes from './feedback';
import { PAGE } from './ui';
import type { AppEnv, Env } from './types';
import { notFound } from './not-found';
import { fanOutGig } from './gigs';
import { admin, reports, backupToR2 } from './admin';
import { sendWeeklyDigests } from './digest';
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
app.route('/about', aboutPage);
app.route('/report', reports);
app.route('/admin', admin);

// SEO: sitemap with the public pages worth indexing (landing, about, band pages).
// Musician pages stay noindex (people, not businesses).
app.get('/robots.txt', (c) => c.text(`User-agent: *\nAllow: /\nDisallow: /m/\nSitemap: ${c.env.BASE_URL || 'https://jamwerk.app'}/sitemap.xml\n`));
app.get('/sitemap.xml', async (c) => {
  const base = c.env.BASE_URL || 'https://jamwerk.app';
  const { results } = await c.env.DB.prepare('SELECT id, name, created_at FROM bands ORDER BY id DESC LIMIT 5000').all();
  const slug = (n: string) => n.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'band';
  const urls = [`${base}/`, `${base}/about`, ...(results as any[]).map((b) => `${base}/b/${b.id}-${slug(b.name)}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`;
  return c.body(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
});
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
  // Standby that nobody confirmed within 2 h → becomes an urgent replacement and everyone nearby is alerted.
  const { results: fallenRows } = await env.DB.prepare(
    "SELECT * FROM gigs WHERE status = 'open' AND need = 'standby' AND standby_activated_at IS NOT NULL AND standby_activated_at < datetime('now', '-2 hours')"
  ).all();
  const fallen = await env.DB.prepare(
    "UPDATE gigs SET need = 'dep' WHERE status = 'open' AND need = 'standby' AND standby_activated_at IS NOT NULL AND standby_activated_at < datetime('now', '-2 hours')"
  ).run();
  for (const g of fallenRows as any[]) {
    await fanOutGig(env, { id: g.id, kind: 'gig', instrument: g.instrument, venue_city: g.venue_city, venue_lat: g.venue_lat, venue_lng: g.venue_lng, gig_date: g.gig_date, fee_chf: g.fee_chf, currency: g.currency || 'CHF', description: g.description || '', need: 'dep', poster_email: g.poster_email }, true);
  }
  let digests = 0;
  try { digests = await sendWeeklyDigests(env); } catch (err) { console.error('Digest failed:', err); }
  let backup: string | null = null;
  try { backup = await backupToR2(env); } catch (err) { console.error('Backup failed:', err); }
  const pruned = await env.DB.prepare(
    "DELETE FROM rate_limits WHERE attempted_at < datetime('now', '-1 day')"
  ).run();
  console.log(`Housekeeping: ${expired.meta.changes} listings expired, ${fallen.meta.changes} standby gigs reopened as replacements, backup=${backup ?? 'skipped'}, digests=${digests}, ${pruned.meta.changes} rate-limit rows pruned`);
}

export default {
  fetch: app.fetch,
  scheduled,
};
