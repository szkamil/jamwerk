// test/auth-flows.spec.ts — email confirmation, password reset, rate limiting.
// No Mailjet keys in the test env, so sends are logged and skipped; the flows
// are exercised through the tokens stored in D1.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function post(path: string, body: unknown, ip = '203.0.113.7') {
	const request = new IncomingRequest(`http://localhost${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
		body: JSON.stringify(body),
	});
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return { status: response.status, json: (await response.json().catch(() => ({}))) as any };
}

async function get(path: string) {
	const request = new IncomingRequest(`http://localhost${path}`, { redirect: 'manual' });
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe('Auth flows', () => {
	it('registration stores a confirm token; the link flips confirmed', async () => {
		const r = await post('/auth/register', { accept_terms: true, email: 'confirm-me@example.com', password: 'longenough1' });
		expect(r.status).toBe(201);
		const row = await env.DB.prepare('SELECT confirmed, confirm_token FROM users WHERE email = ?')
			.bind('confirm-me@example.com').first<{ confirmed: number; confirm_token: string }>();
		expect(row!.confirmed).toBe(0);
		expect(row!.confirm_token).toBeTruthy();

		const res = await get(`/auth/confirm?token=${row!.confirm_token}`);
		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toBe('/?confirmed=1');
		const after = await env.DB.prepare('SELECT confirmed FROM users WHERE email = ?')
			.bind('confirm-me@example.com').first<{ confirmed: number }>();
		expect(after!.confirmed).toBe(1);

		const bad = await get('/auth/confirm?token=nope');
		expect(bad.headers.get('location')).toBe('/?confirmed=0');
	});

	it('forgot/reset round-trip changes the password', async () => {
		await post('/auth/register', { accept_terms: true, email: 'resetter@example.com', password: 'oldpassword1' });
		const r = await post('/auth/forgot', { email: 'resetter@example.com' });
		expect(r.status).toBe(200);
		const row = await env.DB.prepare('SELECT reset_token FROM users WHERE email = ?')
			.bind('resetter@example.com').first<{ reset_token: string }>();
		expect(row!.reset_token).toBeTruthy();

		const reset = await post('/auth/reset', { token: row!.reset_token, password: 'newpassword2' });
		expect(reset.status).toBe(200);
		expect(reset.json.email).toBe('resetter@example.com');

		expect((await post('/auth/login', { email: 'resetter@example.com', password: 'oldpassword1' })).status).toBe(401);
		expect((await post('/auth/login', { email: 'resetter@example.com', password: 'newpassword2' })).status).toBe(200);
		// token is single-use
		expect((await post('/auth/reset', { token: row!.reset_token, password: 'thirdpassword3' })).status).toBe(400);
	});

	it('unknown emails get the same ok answer from forgot', async () => {
		const r = await post('/auth/forgot', { email: 'ghost@example.com' });
		expect(r.status).toBe(200);
		expect(r.json.ok).toBe(true);
	});

	it('rate limits registrations per IP', async () => {
		const ip = '198.51.100.42';
		for (let i = 0; i < 5; i++) {
			const r = await post('/auth/register', { accept_terms: true, email: `bulk${i}@example.com`, password: 'longenough1' }, ip);
			expect(r.status).toBe(201);
		}
		const sixth = await post('/auth/register', { accept_terms: true, email: 'bulk5@example.com', password: 'longenough1' }, ip);
		expect(sixth.status).toBe(429);
		// a different IP is unaffected
		const other = await post('/auth/register', { accept_terms: true, email: 'other@example.com', password: 'longenough1' }, '198.51.100.99');
		expect(other.status).toBe(201);
	});
});
