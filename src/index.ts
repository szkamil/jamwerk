// src/index.ts — JamWerk worker entry.
import { Hono } from 'hono';
import { authMiddleware } from './auth';
import authRoutes from './auth';
import gigRoutes, { musicians as musicianRoutes } from './gigs';
import pwaRoutes from './pwa';
import profilePage from './profile-page';
import pushRoutes from './push';
import { PAGE } from './ui';
import type { AppEnv } from './types';

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

export default app;
