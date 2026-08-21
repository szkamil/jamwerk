// src/auth.ts
// Cookie-JWT auth. POC scope: no email confirmation, no password reset,
// no rate limiting — all required before this leaves the workers.dev URL.
import { Hono, Context, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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

const auth = new Hono<AppEnv>();

auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const displayName = typeof body?.display_name === 'string' ? body.display_name.trim().slice(0, 100) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Valid email required' }, 400);
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);

  const hash = await bcrypt.hash(password, 10);
  try {
    await c.env.DB.prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)')
      .bind(email, hash, displayName).run();
  } catch (err: any) {
    if (String(err?.message || err).includes('UNIQUE')) {
      return c.json({ error: 'An account with this email already exists' }, 409);
    }
    throw err;
  }
  setSession(c, email);
  return c.json({ ok: true, email }, 201);
});

auth.post('/login', async (c) => {
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

auth.post('/logout', (c) => {
  setCookie(c, COOKIE, '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'Strict' });
  return c.json({ ok: true });
});

auth.get('/me', (c) => {
  const user = c.get('user');
  return user ? c.json({ email: user.email }) : c.json({ error: 'Not logged in' }, 401);
});

export default auth;
