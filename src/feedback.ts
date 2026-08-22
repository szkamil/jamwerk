// src/feedback.ts — the footer "Feedback" contact form.
//
//   POST /feedback   { message, email? }
//
// No login required. Submissions land in the feedback table; when the
// FEEDBACK_EMAIL var is configured each one is also forwarded there by email.
import { Hono } from 'hono';
import { sendEmail } from './email';
import { rateLimited, clientIp } from './ratelimit';
import { turnstileOk } from './turnstile';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
  if (message.length < 5 || message.length > 2000) {
    return c.json({ error: 'Message must be 5-2000 characters' }, 400);
  }
  if (!(await turnstileOk(c.env, body.turnstile_token, clientIp(c)))) {
    return c.json({ error: 'Verification failed — please try again' }, 403);
  }
  if (await rateLimited(c.env, clientIp(c), 'feedback', 5, 60)) {
    return c.json({ error: 'Too many submissions — try again later' }, 429);
  }
  const from = c.get('user')?.email || email;
  await c.env.DB.prepare('INSERT INTO feedback (email, body) VALUES (?, ?)').bind(from, message).run();
  if (c.env.FEEDBACK_EMAIL) {
    const task = sendEmail(c.env, c.env.FEEDBACK_EMAIL, 'JamWerk feedback', `${message}\n\nFrom: ${from || 'anonymous'}`);
    try {
      c.executionCtx.waitUntil(task);
    } catch {
      // No execution context (some test setups) — the promise still runs.
    }
  }
  return c.json({ ok: true });
});

export default app;
