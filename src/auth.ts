// src/auth.ts
// Cookie-JWT auth with email confirmation, password reset, and per-IP rate
// limiting. Confirmation is soft for now: unconfirmed accounts work, the
// `confirmed` flag just records state (gate later if abuse shows up).
import { Hono, Context, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendEmail } from './email';
import { normLang, pickLang, t } from './i18n';
import { rateLimited, clientIp } from './ratelimit';
import { turnstileOk } from './turnstile';
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
  if (!(await turnstileOk(c.env, body?.turnstile_token, clientIp(c)))) {
    return c.json({ error: 'Verification failed — please try again' }, 403);
  }

  const hash = await bcrypt.hash(password, 10);
  const confirmToken = crypto.randomUUID();
  const lang = ['en', 'fr', 'de', 'it'].includes(body?.lang)
    ? normLang(body.lang)
    : pickLang(c.req.header('Accept-Language'));
  try {
    await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, display_name, confirm_token, lang) VALUES (?, ?, ?, ?, ?)'
    ).bind(email, hash, displayName, confirmToken, lang).run();
  } catch (err: any) {
    if (String(err?.message || err).includes('UNIQUE')) {
      return c.json({ error: 'An account with this email already exists' }, 409);
    }
    throw err;
  }
  const task = sendEmail(c.env, email,
    t(lang, { en: 'Confirm your JamWerk account', fr: 'Confirmez votre compte JamWerk', de: 'Bestätige dein JamWerk-Konto', it: 'Conferma il tuo account JamWerk' }),
    t(lang, {
      en: `Welcome to JamWerk!\n\nConfirm your email address:\n{link}\n\nTip: tap the bell in the app header to get gig alerts for your instrument near you.\n\nIf you did not sign up, ignore this message.`,
      fr: `Bienvenue sur JamWerk !\n\nConfirmez votre adresse e-mail :\n{link}\n\nAstuce : touchez la cloche dans l'en-tête de l'app pour recevoir les alertes de concerts près de chez vous.\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez ce message.`,
      de: `Willkommen bei JamWerk!\n\nBestätige deine E-Mail-Adresse:\n{link}\n\nTipp: Tippe auf die Glocke in der App, um Gig-Alerts für dein Instrument in deiner Nähe zu erhalten.\n\nFalls du dich nicht registriert hast, ignoriere diese Nachricht.`,
      it: `Benvenuto su JamWerk!\n\nConferma il tuo indirizzo e-mail:\n{link}\n\nSuggerimento: tocca la campanella nell'app per ricevere avvisi sui concerti vicino a te.\n\nSe non ti sei registrato tu, ignora questo messaggio.`,
    }).replace('{link}', `${baseUrl(c)}/auth/confirm?token=${confirmToken}`));
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
      const row = await c.env.DB.prepare('SELECT lang FROM users WHERE email = ?').bind(email).first<{ lang: string }>();
      const lang = normLang(row?.lang);
      const task = sendEmail(c.env, email,
        t(lang, { en: 'Reset your JamWerk password', fr: 'Réinitialisez votre mot de passe JamWerk', de: 'Setze dein JamWerk-Passwort zurück', it: 'Reimposta la tua password JamWerk' }),
        t(lang, {
          en: `Someone asked to reset the password for this JamWerk account.\n\nSet a new password (link valid 1 hour):\n{link}\n\nIf this was not you, ignore this message.`,
          fr: `Quelqu'un a demandé la réinitialisation du mot de passe de ce compte JamWerk.\n\nDéfinissez un nouveau mot de passe (lien valable 1 heure) :\n{link}\n\nSi ce n'était pas vous, ignorez ce message.`,
          de: `Jemand hat das Zurücksetzen des Passworts für dieses JamWerk-Konto angefordert.\n\nNeues Passwort festlegen (Link 1 Stunde gültig):\n{link}\n\nFalls das nicht du warst, ignoriere diese Nachricht.`,
          it: `Qualcuno ha chiesto di reimpostare la password di questo account JamWerk.\n\nImposta una nuova password (link valido 1 ora):\n{link}\n\nSe non sei stato tu, ignora questo messaggio.`,
        }).replace('{link}', `${baseUrl(c)}/?reset=${token}`));
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

// Persist the user's UI language so emails and push match it.
auth.post('/lang', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const body = await c.req.json().catch(() => null);
  const lang = body?.lang;
  if (!['en', 'fr', 'de', 'it'].includes(lang)) return c.json({ error: 'Unknown language' }, 400);
  await c.env.DB.prepare('UPDATE users SET lang = ? WHERE email = ?').bind(lang, user.email).run();
  return c.json({ ok: true });
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
