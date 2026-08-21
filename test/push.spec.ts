// test/push.spec.ts — push subscription endpoints and payload encryption shape.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';
import { encryptPayload } from '../src/push';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const user = 'pusher@example.com';

async function call(path: string, opts: { method?: string; as?: boolean; body?: unknown } = {}) {
	const headers: Record<string, string> = {};
	if (opts.as) {
		const token = jwt.sign({ email: user }, (env as any).JWT_SECRET, { expiresIn: '1h' });
		headers.Cookie = `token=${token}`;
	}
	if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
	const request = new IncomingRequest(`http://localhost${path}`, {
		method: opts.method || 'GET',
		headers,
		body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
	});
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return { status: response.status, json: (await response.json()) as any };
}

function b64u(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// A real browser subscription carries a valid P-256 public key — make one.
async function makeKeys() {
	const kp = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
	return {
		p256dh: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))),
		auth: b64u(crypto.getRandomValues(new Uint8Array(16))),
	};
}

const SUB = {
	endpoint: 'https://push.example.net/send/abc123',
	keys: { p256dh: '', auth: '' },
};

describe('Web push', () => {
	it('serves the VAPID public key', async () => {
		SUB.keys = await makeKeys();
		const r = await call('/push/vapid');
		expect(r.status).toBe(200);
		expect(typeof r.json.key).toBe('string');
		expect(r.json.key.length).toBeGreaterThan(80);
	});

	it('subscribe requires auth and validates the subscription', async () => {
		SUB.keys = await makeKeys();
		expect((await call('/push/subscribe', { method: 'POST', body: SUB })).status).toBe(401);
		await env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, 'x')").bind(user).run();
		expect((await call('/push/subscribe', { method: 'POST', as: true, body: { endpoint: 'http://insecure', keys: SUB.keys } })).status).toBe(400);
		expect((await call('/push/subscribe', { method: 'POST', as: true, body: SUB })).status).toBe(201);
		const row = await env.DB.prepare('SELECT owner FROM push_subscriptions WHERE endpoint = ?')
			.bind(SUB.endpoint).first<{ owner: string }>();
		expect(row!.owner).toBe(user);

		expect((await call('/push/unsubscribe', { method: 'POST', as: true, body: { endpoint: SUB.endpoint } })).status).toBe(200);
		const gone = await env.DB.prepare('SELECT 1 FROM push_subscriptions WHERE endpoint = ?').bind(SUB.endpoint).first();
		expect(gone).toBeNull();
	});

	it('encrypts payloads in aes128gcm shape', async () => {
		const keys = await makeKeys();
		const text = JSON.stringify({ title: 'Gig: bass in Bern - CHF 300', body: 'Sat, Bern' });
		const out = await encryptPayload(keys.p256dh, keys.auth, text);
		// header: salt 16 + rs 4 + idlen 1 + key 65 = 86; body: plaintext + pad(1) + GCM tag(16)
		expect(out.length).toBe(86 + text.length + 1 + 16);
		expect(out[20]).toBe(65);
		expect(new DataView(out.buffer).getUint32(16)).toBe(4096);
	});
});
