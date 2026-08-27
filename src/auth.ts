// src/auth.ts
// Cookie-JWT auth with email confirmation, password reset, and per-IP rate
// limiting. Confirmation is soft for now: unconfirmed accounts work, the
// `confirmed` flag just records state (gate later if abuse shows up).
import { Hono, Context, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendEmail } from './email';
import { normLang, pickLang, t, type Lang } from './i18n';
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
      const b = await c.env.DB.prepare('SELECT banned FROM users WHERE email = ?').bind(decoded.email).first<{ banned: number }>();
      if (b && b.banned) {
        setCookie(c, COOKIE, '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'Strict' });
      } else c.set('user', { email: decoded.email });
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

function sendConfirmEmail(c: Context<AppEnv>, email: string, lang: Lang, confirmToken: string): Promise<boolean> {
  return sendEmail(c.env, email,
    t(lang, { en: 'Confirm your JamWerk account', fr: 'Confirmez votre compte JamWerk', de: 'Bestätige dein JamWerk-Konto', it: 'Conferma il tuo account JamWerk' }),
    t(lang, {
      en: `Welcome to JamWerk!\n\nConfirm your email address:\n{link}\n\nTip: tap the bell in the app header to get gig alerts for your instrument near you.\n\nIf you did not sign up, ignore this message.`,
      fr: `Bienvenue sur JamWerk !\n\nConfirmez votre adresse e-mail :\n{link}\n\nAstuce : touchez la cloche dans l'en-tête de l'app pour recevoir les alertes de concerts près de chez vous.\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez ce message.`,
      de: `Willkommen bei JamWerk!\n\nBestätige deine E-Mail-Adresse:\n{link}\n\nTipp: Tippe auf die Glocke in der App, um Gig-Alerts für dein Instrument in deiner Nähe zu erhalten.\n\nFalls du dich nicht registriert hast, ignoriere diese Nachricht.`,
      it: `Benvenuto su JamWerk!\n\nConferma il tuo indirizzo e-mail:\n{link}\n\nSuggerimento: tocca la campanella nell'app per ricevere avvisi sui concerti vicino a te.\n\nSe non ti sei registrato tu, ignora questo messaggio.`,
    }).replace('{link}', `${baseUrl(c)}/auth/confirm?token=${confirmToken}`), { lang });
}

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
  if (body?.accept_terms !== true) return c.json({ error: 'You must accept the terms of use to create an account', code: 'terms_required' }, 400);
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
      "INSERT INTO users (email, password_hash, display_name, confirm_token, lang, terms_accepted_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).bind(email, hash, displayName, confirmToken, lang).run();
  } catch (err: any) {
    if (String(err?.message || err).includes('UNIQUE')) {
      return c.json({ error: 'An account with this email already exists' }, 409);
    }
    throw err;
  }
  const task = sendConfirmEmail(c, email, lang, confirmToken);
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
  const row = await c.env.DB.prepare('SELECT password_hash, banned FROM users WHERE email = ?')
    .bind(email).first<{ password_hash: string; banned: number }>();
  if (row?.banned) return c.json({ error: 'This account has been suspended', code: 'banned' }, 403);
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
        }).replace('{link}', `${baseUrl(c)}/?reset=${token}`), { lang });
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
// Small preferences that are not part of the musician profile.
auth.post('/prefs', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const body = await c.req.json().catch(() => ({}));
  if (typeof body?.digest === 'boolean') await c.env.DB.prepare('UPDATE users SET digest = ? WHERE email = ?').bind(body.digest ? 1 : 0, user.email).run();
  return c.json({ ok: true });
});

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

auth.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not logged in' }, 401);
  const row = await c.env.DB.prepare('SELECT u.confirmed, u.photo_key, u.display_name, u.digest, m.handle FROM users u LEFT JOIN musician_details m ON m.owner = u.email WHERE u.email = ?').bind(user.email).first<{ confirmed: number; photo_key: string | null; display_name: string | null }>();
  return c.json({ email: user.email, confirmed: !!row?.confirmed, photo: photoUrl(row?.photo_key), name: row?.display_name || '', handle: (row as any)?.handle || null, digest: (row as any)?.digest !== 0 });
});

// Profile photo: the client resizes to a 512px JPEG before upload (see ui.ts),
// we just bound the size, store it in R2 and remember the key on the user.
const PHOTO_MAX = 600 * 1024;
auth.post('/photo', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (!c.env.MEDIA) return c.json({ error: 'Photo storage is not configured' }, 503);
  const type = (c.req.header('content-type') || '').split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return c.json({ error: 'Send a JPEG, PNG or WebP image' }, 415);
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength < 100 || bytes.byteLength > PHOTO_MAX) return c.json({ error: `Image must be under ${Math.round(PHOTO_MAX / 1024)} KB` }, 413);
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const key = `avatars/${crypto.randomUUID()}.${ext}`;
  await c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  const prev = await c.env.DB.prepare('SELECT photo_key FROM users WHERE email = ?').bind(user.email).first<{ photo_key: string | null }>();
  await c.env.DB.prepare('UPDATE users SET photo_key = ? WHERE email = ?').bind(key, user.email).run();
  if (prev?.photo_key) { try { await c.env.MEDIA.delete(prev.photo_key); } catch { /* best effort */ } }
  return c.json({ ok: true, photo: photoUrl(key) });
});

auth.delete('/photo', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const prev = await c.env.DB.prepare('SELECT photo_key FROM users WHERE email = ?').bind(user.email).first<{ photo_key: string | null }>();
  await c.env.DB.prepare('UPDATE users SET photo_key = NULL WHERE email = ?').bind(user.email).run();
  if (prev?.photo_key && c.env.MEDIA) { try { await c.env.MEDIA.delete(prev.photo_key); } catch { /* best effort */ } }
  return c.json({ ok: true });
});

/** Public URL for a stored photo key (null when none). */
export function photoUrl(key: string | null | undefined): string | null {
  return key ? `/img/${key}` : null;
}

// Re-send the confirmation link (soft confirmation: only paid-gig posting is
// gated on it). Always answers ok to avoid leaking account state.
auth.post('/resend-confirm', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  if (await rateLimited(c.env, clientIp(c), 'resend', 3, 60)) {
    return c.json({ error: 'Too many requests — try again later' }, 429);
  }
  const row = await c.env.DB.prepare('SELECT confirmed, lang FROM users WHERE email = ?').bind(user.email).first<{ confirmed: number; lang: string }>();
  if (row && !row.confirmed) {
    const confirmToken = crypto.randomUUID();
    await c.env.DB.prepare('UPDATE users SET confirm_token = ? WHERE email = ?').bind(confirmToken, user.email).run();
    const task = sendConfirmEmail(c, user.email, normLang(row.lang), confirmToken);
    try { c.executionCtx.waitUntil(task); } catch { /* tests */ }
  }
  return c.json({ ok: true });
});

// Your data, as JSON — everything we hold about you.
auth.get('/export', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const me = user.email;
  const q = async (sql: string, ...b: unknown[]) => (await c.env.DB.prepare(sql).bind(...b).all()).results;
  const out = {
    exported_at: new Date().toISOString(),
    account: await c.env.DB.prepare('SELECT email, display_name, lang, confirmed, created_at, terms_accepted_at FROM users WHERE email = ?').bind(me).first(),
    profile: await c.env.DB.prepare('SELECT * FROM musician_details WHERE owner = ?').bind(me).first(),
    gigs_posted: await q('SELECT * FROM gigs WHERE poster_email = ?', me),
    applications: await q('SELECT * FROM gig_applications WHERE musician_email = ?', me),
    bookings: await q('SELECT * FROM bookings WHERE musician_email = ?', me),
    reviews_written: await q('SELECT * FROM gig_reviews WHERE reviewer_email = ?', me),
    reviews_received: await q('SELECT * FROM gig_reviews WHERE reviewee_email = ?', me),
    bands_owned: await q('SELECT * FROM bands WHERE owner_email = ?', me),
    band_seats: await q('SELECT * FROM band_seats WHERE member_email = ?', me),
    messages_sent: await q('SELECT thread_type, thread_id, body, created_at FROM messages WHERE sender_email = ?', me),
    blocks: await q('SELECT blocked_email, created_at FROM user_blocks WHERE blocker_email = ?', me),
  };
  return c.body(JSON.stringify(out, null, 2), 200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="jamwerk-export.json"' });
});

// Delete the account and everything attached to it (FK cascades), plus the photo in R2.
auth.delete('/account', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const body = await c.req.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';
  const row = await c.env.DB.prepare('SELECT password_hash, photo_key FROM users WHERE email = ?').bind(user.email).first<{ password_hash: string; photo_key: string | null }>();
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return c.json({ error: 'Wrong password', code: 'bad_password' }, 403);
  if (row.photo_key && c.env.MEDIA) { try { await c.env.MEDIA.delete(row.photo_key); } catch { /* best effort */ } }
  // Bands owned die with the owner (cascade); other users' threads with this person lose the counterpart (cascade).
  await c.env.DB.prepare('DELETE FROM users WHERE email = ?').bind(user.email).run();
  setCookie(c, COOKIE, '', { path: '/', expires: new Date(0), httpOnly: true, sameSite: 'Strict' });
  return c.json({ ok: true });
});

export default auth;
