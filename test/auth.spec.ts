// test/auth.spec.ts — register/login/session round-trip.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function post(path: string, body: unknown, cookie?: string) {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (cookie) headers.Cookie = cookie;
	const request = new IncomingRequest(`http://localhost${path}`, {
		method: 'POST', headers, body: JSON.stringify(body),
	});
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe('Auth', () => {
	it('register -> me -> login round-trip; bad creds rejected', async () => {
		const reg = await post('/auth/register', { email: 'sam@example.com', password: 'hunter2hunter2' });
		expect(reg.status).toBe(201);
		const cookie = (reg.headers.get('set-cookie') || '').split(';')[0];
		expect(cookie).toMatch(/^token=/);

		const meReq = new IncomingRequest('http://localhost/auth/me', { headers: { Cookie: cookie } });
		const ctx = createExecutionContext();
		const me = await worker.fetch(meReq, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(me.status).toBe(200);
		expect(((await me.json()) as any).email).toBe('sam@example.com');

		const dup = await post('/auth/register', { email: 'sam@example.com', password: 'hunter2hunter2' });
		expect(dup.status).toBe(409);
		const bad = await post('/auth/login', { email: 'sam@example.com', password: 'wrong-password' });
		expect(bad.status).toBe(401);
		const good = await post('/auth/login', { email: 'sam@example.com', password: 'hunter2hunter2' });
		expect(good.status).toBe(200);
	});

	it('rejects weak passwords and bad emails', async () => {
		expect((await post('/auth/register', { email: 'not-an-email', password: 'hunter2hunter2' })).status).toBe(400);
		expect((await post('/auth/register', { email: 'ok@example.com', password: 'short' })).status).toBe(400);
	});

	it('serves the UI page at /', async () => {
		const request = new IncomingRequest('http://localhost/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('JamWerk');
		expect(html).toContain('Gig board');
		// logged-out landing pitch is part of the page
		expect(html).toContain('Just here to jam?');
		expect(html).toContain('Create your free profile');
	});
});
