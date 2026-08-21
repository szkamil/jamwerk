// src/push.ts — Web Push from scratch for Workers: RFC 8291 (aes128gcm)
// payload encryption + RFC 8292 (VAPID) auth, both on WebCrypto. Degrades
// gracefully: without VAPID vars configured, sends are skipped.
import { Hono } from 'hono';
import type { AppEnv, Env } from './types';

function b64u(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(input: string): Uint8Array {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** RFC 8291: encrypt a payload for one subscription (aes128gcm). */
export async function encryptPayload(p256dh: string, auth: string, plaintext: string): Promise<Uint8Array> {
  const uaPub = b64uDecode(p256dh);
  const authSecret = b64uDecode(auth);
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  const enc = new TextEncoder();
  const keyInfo = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPub, ...asPub]);
  const ikm = await hkdf(ecdh, authSecret, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const padded = new Uint8Array([...enc.encode(plaintext), 2]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

  // aes128gcm body header: salt(16) | record size(4) | keyid len(1) | keyid(65)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = 65;
  header.set(asPub, 21);
  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header, 0);
  body.set(ciphertext, header.length);
  return body;
}

/** RFC 8292: VAPID Authorization header for one push endpoint's origin. */
async function vapidAuth(env: Env, endpoint: string): Promise<string> {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK!);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = new TextEncoder();
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:rupert.szewczyk@gmail.com',
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`));
  return `vapid t=${header}.${payload}.${b64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

/** Push to every subscription of one user; dead endpoints are pruned. */
export async function sendPushTo(env: Env, email: string, title: string, body: string): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_JWK) return;
  const { results } = await env.DB.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE owner = ?'
  ).bind(email).all();
  for (const sub of results as any[]) {
    try {
      const payload = await encryptPayload(sub.p256dh, sub.auth, JSON.stringify({ title, body }));
      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          Authorization: await vapidAuth(env, sub.endpoint),
          TTL: '86400',
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          Urgency: 'high',
        },
        body: payload,
      });
      if (res.status === 404 || res.status === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
      } else if (!res.ok) {
        console.error('Push rejected:', res.status, await res.text());
      }
    } catch (err) {
      console.error('Push error:', err);
    }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const push = new Hono<AppEnv>();

push.get('/vapid', (c) => c.json({ key: c.env.VAPID_PUBLIC_KEY || null }));

push.post('/subscribe', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const body = await c.req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth : '';
  let ok = false;
  try {
    ok = new URL(endpoint).protocol === 'https:' && endpoint.length < 1000;
  } catch { /* invalid URL */ }
  if (!ok || !p256dh || !auth) return c.json({ error: 'Invalid push subscription' }, 400);
  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO push_subscriptions (endpoint, owner, p256dh, auth) VALUES (?, ?, ?, ?)'
  ).bind(endpoint, user.email, p256dh, auth).run();
  return c.json({ ok: true }, 201);
});

push.post('/unsubscribe', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  const body = await c.req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND owner = ?')
    .bind(endpoint, user.email).run();
  return c.json({ ok: true });
});

export default push;
