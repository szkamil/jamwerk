// src/index.ts — JamWerk worker entry.
import { Hono } from 'hono';
import { authMiddleware } from './auth';
import authRoutes from './auth';
import gigRoutes, { musicians as musicianRoutes } from './gigs';
import pwaRoutes from './pwa';
import profilePage from './profile-page';
import pushRoutes from './push';
import { PAGE } from './ui';
import type { AppEnv, Env } from './types';

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

app.get('/', (c) => c.html(PAGE));
app.route('/', pwaRoutes);
app.route('/auth', authRoutes);
app.route('/gigs', gigRoutes);
app.route('/m', profilePage);
app.route('/push', pushRoutes);
app.route('/musicians', musicianRoutes);

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
