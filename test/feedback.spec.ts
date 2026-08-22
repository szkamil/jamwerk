// test/feedback.spec.ts — footer feedback form endpoint.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function post(body: unknown, ip = '203.0.113.9') {
	const request = new IncomingRequest('http://localhost/feedback', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
		body: JSON.stringify(body),
	});
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe('Feedback', () => {
	it('stores a submission with an optional reply email', async () => {
		const res = await post({ message: 'The gig board is great, add a map view!', email: 'fan@example.com' });
		expect(res.status).toBe(200);
		const row = await env.DB.prepare('SELECT email, body FROM feedback ORDER BY id DESC LIMIT 1').first<any>();
		expect(row.body).toBe('The gig board is great, add a map view!');
		expect(row.email).toBe('fan@example.com');
	});

	it('accepts anonymous submissions', async () => {
		const res = await post({ message: 'Anonymous but useful feedback.' });
		expect(res.status).toBe(200);
		const row = await env.DB.prepare('SELECT email FROM feedback ORDER BY id DESC LIMIT 1').first<any>();
		expect(row.email).toBe('');
	});

	it('rejects too-short messages and rate limits floods', async () => {
		expect((await post({ message: 'hi' })).status).toBe(400);
		expect((await post({})).status).toBe(400);
		const ip = '203.0.113.77';
		for (let i = 0; i < 5; i++) {
			expect((await post({ message: `flood message number ${i}` }, ip)).status).toBe(200);
		}
		expect((await post({ message: 'one too many for this window' }, ip)).status).toBe(429);
	});
});
