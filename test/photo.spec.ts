// test/photo.spec.ts — profile photo: upload to R2, expose on /auth/me and /img, delete.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const who = 'photo@example.com';
const cookie = () => `token=${jwt.sign({ email: who }, (env as any).JWT_SECRET, { expiresIn: '1h' })}`;

async function req(path: string, init: RequestInit & { as?: boolean } = {}) {
	const headers = new Headers(init.headers || {});
	if (init.as) headers.set('Cookie', cookie());
	const request = new IncomingRequest(`http://localhost${path}`, { ...init, headers });
	const ctx = createExecutionContext();
	const res = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return res;
}

// Tiny valid PNG (1×1) so the body passes the size floor.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const bigEnough = new Uint8Array(200); bigEnough.set(PNG);

describe('Profile photo', () => {
	it('uploads, serves, exposes and deletes a photo', async () => {
		await env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, 'x')").bind(who).run();
		expect((await req('/auth/photo', { method: 'POST', body: bigEnough, headers: { 'Content-Type': 'image/png' } })).status).toBe(401);
		expect((await req('/auth/photo', { method: 'POST', as: true, body: bigEnough, headers: { 'Content-Type': 'text/plain' } })).status).toBe(415);
		expect((await req('/auth/photo', { method: 'POST', as: true, body: new Uint8Array(700 * 1024), headers: { 'Content-Type': 'image/png' } })).status).toBe(413);

		const up = await req('/auth/photo', { method: 'POST', as: true, body: bigEnough, headers: { 'Content-Type': 'image/png' } });
		expect(up.status).toBe(200);
		const { photo } = (await up.json()) as any;
		expect(photo).toMatch(/^\/img\/avatars\/[a-f0-9-]{36}\.png$/);

		const me = (await (await req('/auth/me', { as: true })).json()) as any;
		expect(me.photo).toBe(photo);

		const img = await req(photo);
		expect(img.status).toBe(200);
		expect(img.headers.get('content-type')).toBe('image/png');
		expect(img.headers.get('cache-control')).toContain('immutable');
		expect((await img.arrayBuffer()).byteLength).toBe(bigEnough.byteLength);

		expect((await req('/auth/photo', { method: 'DELETE', as: true })).status).toBe(200);
		expect(((await (await req('/auth/me', { as: true })).json()) as any).photo).toBeNull();
		expect((await req(photo)).status).toBe(404);
	});
});
