// src/index.ts — JamWerk worker entry.
import { Hono, Context } from 'hono';
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
import type { AppEnv, Env } from './types';
import { notFound } from './not-found';
import { fanOutGig } from './gigs';
import { admin, reports, backupToR2 } from './admin';
import { sendWeeklyDigests } from './digest';
import placesRoutes from './places-api';
import { appHtml, assetBody } from './shell';
import { FONT_FILES } from './fonts';
import { securityHeaderMap } from './security';
import { mapPool } from './pool';

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
  try { await next(); }
  finally {
    const headers = await securityHeaderMap();
    for (const [k, v] of Object.entries(headers)) c.header(k, v);
  }
});
app.use('*', authMiddleware);

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

const HTML_CACHE = { 'Cache-Control': 'private, max-age=60', Vary: 'Cookie' };

function geoHint(c: Context<AppEnv>): string {
  const cf = (c.req.raw as Request & { cf?: { country?: string; region?: string; city?: string } }).cf;
  const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/[^A-Za-z \-]/g, '').slice(0, 40) : '');
  const geo = cf ? `${clean(cf.country)}:${clean(cf.region) || clean(cf.city)}` : '';
  return geo && geo !== ':' ? geo : '';
}

// A browser navigation (address bar, link, back/forward) gets the HTML shell.
// fetch() from the app sends Sec-Fetch-Dest: empty and Accept: */*, so the
// JSON APIs on the same paths stay JSON. Tests send no Accept header.
function wantsDocument(c: Context<AppEnv>): boolean {
  const dest = (c.req.header('Sec-Fetch-Dest') || '').toLowerCase();
  if (dest === 'document') return true;
  if (dest) return false;
  const mode = (c.req.header('Sec-Fetch-Mode') || '').toLowerCase();
  if (mode === 'navigate') return true;
  if (mode) return false;
  return (c.req.header('Accept') || '').includes('text/html');
}

const DOC_TABS: Record<string, string> = {
  '/musicians': 'musicians',
  '/bands': 'bands',
  '/jams': 'jams',
  '/gigs': 'board',
  '/messages': 'msgs',
  '/profile': 'profile',
  '/post': 'post',
};

function renderApp(c: Context<AppEnv>, opts: { tab: string | null; title?: string; description?: string; canonical?: string }) {
  const base = (c.env.BASE_URL || 'https://jamwerk.app').replace(/\/$/, '');
  const path = new URL(c.req.url).pathname.replace(/\/$/, '') || '/';
  const tab = opts.tab;
  return c.html(appHtml({
    tab,
    authed: !!c.get('user'),
    geo: geoHint(c),
    title: opts.title,
    description: opts.description,
    canonical: opts.canonical || `${base}${path === '/' ? '/' : path}`,
    robots: tab === 'msgs' || tab === 'profile' ? 'noindex' : undefined,
  }), 200, HTML_CACHE);
}

app.get('/assets/:file', (c) => {
  const hit = assetBody(c.req.param('file'));
  if (!hit) return c.notFound();
  return c.body(hit.body, 200, {
    'Content-Type': hit.type,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
});

app.get('/fonts/:file', (c) => {
  const body = FONT_FILES[c.req.param('file')];
  if (!body) return c.notFound();
  return new Response(body, {
    headers: {
      'Content-Type': 'font/woff2',
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Preload uses crossorigin, so the font response must allow it.
      'Access-Control-Allow-Origin': '*',
    },
  });
});

// Logged-out visitors get the marketing page. A session renders the musicians
// directory directly so the shell does not jump after /auth/me.
app.get('/', (c) => renderApp(c, { tab: c.get('user') ? 'musicians' : null }));

// Shareable tab URLs. Registered before the JSON routers on the same paths.
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET' || !wantsDocument(c)) return next();
  const path = new URL(c.req.url).pathname.replace(/\/$/, '') || '/';
  const gigId = path.match(/^\/gigs\/(\d+)$/);
  const tab = DOC_TABS[path] || (gigId ? 'board' : null);
  if (!tab) return next();
  if (!gigId) return renderApp(c, { tab });
  const row = await c.env.DB.prepare(
    'SELECT instrument, venue_city, gig_date, kind, fee_chf, currency FROM gigs WHERE id = ?'
  ).bind(Number(gigId[1])).first<{ instrument: string; venue_city: string; gig_date: string | null; kind: string; fee_chf: number | null; currency: string | null }>();
  if (!row) return renderApp(c, { tab });
  const when = row.gig_date || 'flexible date';
  const fee = row.kind === 'practice' ? 'jam' : `${row.currency || 'CHF'} ${row.fee_chf ?? ''}`.trim();
  return renderApp(c, {
    tab,
    title: `${row.instrument} in ${row.venue_city} — JamWerk`,
    description: `${row.kind === 'practice' ? 'Jam' : 'Paid dep gig'} · ${when} · ${row.venue_city}${fee ? ' · ' + fee : ''}`,
  });
});

app.route('/', pwaRoutes);
app.route('/auth', authRoutes);
app.route('/gigs', gigRoutes);
app.route('/m', profilePage);
app.route('/b', bandPage);
app.route('/about', aboutPage);
app.route('/report', reports);
app.route('/admin', admin);

// SEO: public pages worth indexing. Musician pages stay noindex (people, not
// businesses). Messages and profile are shells behind a login, so noindex.
app.get('/robots.txt', (c) => c.text(`User-agent: *\nAllow: /\nDisallow: /m/\nSitemap: ${c.env.BASE_URL || 'https://jamwerk.app'}/sitemap.xml\n`));
app.get('/sitemap.xml', async (c) => {
  const base = (c.env.BASE_URL || 'https://jamwerk.app').replace(/\/$/, '');
  const { results: bands } = await c.env.DB.prepare('SELECT id, name FROM bands ORDER BY id DESC LIMIT 5000').all();
  const { results: gigs } = await c.env.DB.prepare("SELECT id FROM gigs WHERE status = 'open' ORDER BY id DESC LIMIT 5000").all();
  const slug = (n: string) => n.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'band';
  const urls = [
    `${base}/`, `${base}/about`, `${base}/musicians`, `${base}/bands`, `${base}/jams`, `${base}/gigs`,
    ...(bands as any[]).map((b) => `${base}/b/${b.id}-${slug(b.name)}`),
    ...(gigs as any[]).map((g) => `${base}/gigs/${g.id}`),
  ];
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
  if (!c.env.MEDIA || !/^(avatars|covers)\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) return c.notFound();
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': obj.httpEtag } });
});
app.notFound(notFound);

// Daily housekeeping. Each step is isolated so one failure still leaves
// digest, backup and cleanup a chance to run.
async function scheduled(_controller: ScheduledController, env: Env): Promise<void> {
  let expired = 0;
  let fallen = 0;
  let digests = 0;
  let backup: string | null = null;
  let pruned = 0;
  try {
    const r = await env.DB.prepare(
      "UPDATE gigs SET status = 'expired' WHERE status = 'open' AND expires_at < date()"
    ).run();
    expired = r.meta.changes ?? 0;
  } catch (err) {
    console.error('Expire failed:', err);
  }
  try {
    const { results: fallenRows } = await env.DB.prepare(
      "SELECT * FROM gigs WHERE status = 'open' AND need = 'standby' AND standby_activated_at IS NOT NULL AND standby_activated_at < datetime('now', '-2 hours')"
    ).all();
    const fallenRes = await env.DB.prepare(
      "UPDATE gigs SET need = 'dep' WHERE status = 'open' AND need = 'standby' AND standby_activated_at IS NOT NULL AND standby_activated_at < datetime('now', '-2 hours')"
    ).run();
    fallen = fallenRes.meta.changes ?? 0;
    await mapPool(fallenRows as any[], 4, async (g) => {
      await fanOutGig(env, {
        id: g.id, kind: 'gig', instrument: g.instrument, venue_city: g.venue_city,
        venue_lat: g.venue_lat, venue_lng: g.venue_lng, gig_date: g.gig_date, fee_chf: g.fee_chf,
        currency: g.currency || 'CHF', description: g.description || '', need: 'dep', poster_email: g.poster_email,
      }, true);
    });
  } catch (err) {
    console.error('Standby reopen failed:', err);
  }
  try { digests = await sendWeeklyDigests(env); } catch (err) { console.error('Digest failed:', err); }
  try { backup = await backupToR2(env); } catch (err) { console.error('Backup failed:', err); }
  try {
    const r = await env.DB.prepare(
      "DELETE FROM rate_limits WHERE attempted_at < datetime('now', '-1 day')"
    ).run();
    pruned = r.meta.changes ?? 0;
  } catch (err) {
    console.error('Rate-limit prune failed:', err);
  }
  console.log(`Housekeeping: ${expired} listings expired, ${fallen} standby gigs reopened as replacements, backup=${backup ?? 'skipped'}, digests=${digests}, ${pruned} rate-limit rows pruned`);
}

export default {
  fetch: app.fetch,
  scheduled,
};
