// src/auth.ts
// Cookie-JWT auth with email confirmation, password reset, and per-IP rate
// limiting. Confirmation is soft for now: unconfirmed accounts work, the
// `confirmed` flag just records state (gate later if abuse shows up).
import { Hono, Context, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendEmail } from './email';
import { rateLimited, clientIp } from './ratelimit';
import type { AppEnv } from './types';

const COOKIE = 'token';
const WEEK_S = 7 * 24 * 3600;

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const token = getCookie(c, COOKIE);
  c.set('user', undefined);
  if (token) {
    try {
      const decoded = jwt.verify(token, c.env.JWT_SECRET) as { email: string };
      c.set('user', { email: decoded.email });
    } catch {
      setCookie(c, COOKIE, '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'Strict' });
    }
  }
  await next();
}

function setSession(c: Context<AppEnv>, email: string) {
  const token = jwt.sign({ email }, c.env.JWT_SECRET, { expiresIn: WEEK_S });
  setCookie(c, COOKIE, token, {
    path: '/', httpOnly: true, sameSite: 'Strict', secure: true, maxAge: WEEK_S,
  });
}

function baseUrl(c: Context<AppEnv>): string {
  return c.env.BASE_URL || 'https://jamwerk.app';
}

const auth = new Hono<AppEnv>();

auth.post('/register', async (c) => {
  if (await rateLimited(c.env, clientIp(c), 'register', 5, 60)) {
    return c.json({ error: 'Too many sign-ups from this address — try again later' }, 429);
  }
  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const displayName = typeof body?.display_name === 'string' ? body.display_name.trim().slice(0, 100) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Valid email required' }, 400);
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);

  const hash = await bcrypt.hash(password, 10);
  const confirmToken = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, display_name, confirm_token) VALUES (?, ?, ?, ?)'
    ).bind(email, hash, displayName, confirmToken).run();
  } catch (err: any) {
    if (String(err?.message || err).includes('UNIQUE')) {
      return c.json({ error: 'An account with this email already exists' }, 409);
    }
    throw err;
  }
  const task = sendEmail(c.env, email, 'Confirm your JamWerk account',
    `Welcome to JamWerk!\n\nConfirm your email address:\n${baseUrl(c)}/auth/confirm?token=${confirmToken}\n\nIf you did not sign up, ignore this message.`);
  try { c.executionCtx.waitUntil(task); } catch { /* no execution context in some test setups */ }
  setSession(c, email);
  return c.json({ ok: true, email }, 201);
});

auth.get('/confirm', async (c) => {
  const token = c.req.query('token') || '';
  if (token) {
    const r = await c.env.DB.prepare(
      "UPDATE users SET confirmed = 1, confirm_token = NULL WHERE confirm_token = ?"
    ).bind(token).run();
    if (r.meta.changes) return c.redirect('/?confirmed=1', 302);
  }
  return c.redirect('/?confirmed=0', 302);
});

auth.post('/login', async (c) => {
  if (await rateLimited(c.env, clientIp(c), 'login', 10, 15)) {
    return c.json({ error: 'Too many attempts — try again in a few minutes' }, 429);
  }
  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE email = ?')
    .bind(email).first<{ password_hash: string }>();
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }
  setSession(c, email);
  return c.json({ ok: true, email });
});

// Always answers ok so the endpoint cannot be used to probe which emails exist.
auth.post('/forgot', async (c) => {
  if (await rateLimited(c.env, clientIp(c), 'forgot', 3, 60)) {
    return c.json({ error: 'Too many reset requests — try again later' }, 429);
  }
  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email) {
    const token = crypto.randomUUID();
    const r = await c.env.DB.prepare(
      "UPDATE users SET reset_token = ?, reset_expires = datetime('now', '+1 hour') WHERE email = ?"
    ).bind(token, email).run();
    if (r.meta.changes) {
      const task = sendEmail(c.env, email, 'Reset your JamWerk password',
        `Someone asked to reset the password for this JamWerk account.\n\nSet a new password (link valid 1 hour):\n${baseUrl(c)}/?reset=${token}\n\nIf this was not you, ignore this message.`);
      try { c.executionCtx.waitUntil(task); } catch { /* no execution context in some test setups */ }
    }
  }
  return c.json({ ok: true });
});

auth.post('/reset', async (c) => {
  const body = await c.req.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);
  const row = await c.env.DB.prepare(
    "SELECT email FROM users WHERE reset_token = ? AND reset_expires > datetime('now')"
  ).bind(token).first<{ email: string }>();
  if (!row) return c.json({ error: 'Invalid or expired reset link' }, 400);
  const hash = await bcrypt.hash(password, 10);
  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL, confirmed = 1 WHERE email = ?'
  ).bind(hash, row.email).run();
  setSession(c, row.email);
  return c.json({ ok: true, email: row.email });
});

auth.post('/logout', (c) => {
  setCookie(c, COOKIE, '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'Strict' });
  return c.json({ ok: true });
});

auth.get('/me', (c) => {
  const user = c.get('user');
  return user ? c.json({ email: user.email }) : c.json({ error: 'Not logged in' }, 401);
});

export default auth;
