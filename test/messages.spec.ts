// test/messages.spec.ts — application-scoped messaging with privacy rules.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const poster = 'msg-poster@example.com';
const musician = 'msg-musician@example.com';
const stranger = 'msg-stranger@example.com';

function cookieFor(email: string): string {
	const token = jwt.sign({ email }, (env as any).JWT_SECRET, { expiresIn: '1h' });
	return `token=${token}`;
}

async function call(path: string, opts: { method?: string; as?: string; body?: unknown } = {}) {
	const headers: Record<string, string> = {};
	if (opts.as) headers.Cookie = cookieFor(opts.as);
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

const gigDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

beforeAll(async () => {
	await env.DB.batch([
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Paula Poster', 1)").bind(poster),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Mia Musician')").bind(musician),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, 'x')").bind(stranger),
	]);
});

async function makeGigApplication(): Promise<number> {
	const gig = await call('/gigs', {
		method: 'POST', as: poster,
		body: { instrument: 'bass', genres: ['jazz'], gig_date: gigDate, venue_city: 'Bern', fee_chf: 300, description: 'Messaging test gig.' },
	});
	await call('/musicians/me', { method: 'POST', as: musician, body: { instruments: ['bass'], genres: ['jazz'] } });
	await call(`/gigs/${gig.json.id}/apply`, { method: 'POST', as: musician, body: {} });
	const detail = await call(`/gigs/${gig.json.id}`, { as: poster });
	return detail.json.applications[0].id;
}

describe('Messaging', () => {
	it('participants can talk on a gig application; reads clear unread', async () => {
		const appId = await makeGigApplication();

		const sent = await call(`/messages/gig/${appId}`, { method: 'POST', as: poster, body: { body: 'Can you bring an amp?' } });
		expect(sent.status).toBe(201);

		// musician sees the thread with an unread marker and a name, not an email
		const threads = await call('/messages/threads', { as: musician });
		const th = threads.json.threads.find((x: any) => x.thread_type === 'gig' && x.thread_id === appId);
		expect(th.unread).toBe(1);
		expect(th.counterpart).toBe('Paula Poster');
		expect(JSON.stringify(threads.json)).not.toContain(poster);
		expect(threads.json.unread_total).toBe(1);

		// reading marks it read; replying works
		const conv = await call(`/messages/gig/${appId}`, { as: musician });
		expect(conv.json.messages).toHaveLength(1);
		expect(conv.json.messages[0].mine).toBe(false);
		const after = await call('/messages/threads', { as: musician });
		expect(after.json.unread_total).toBe(0);

		expect((await call(`/messages/gig/${appId}`, { method: 'POST', as: musician, body: { body: 'Yes, tube amp.' } })).status).toBe(201);
		const posterConv = await call(`/messages/gig/${appId}`, { as: poster });
		expect(posterConv.json.messages).toHaveLength(2);
		expect(posterConv.json.messages[1].mine).toBe(false);
	});

	it('non-participants are rejected; empty bodies are rejected', async () => {
		const appId = await makeGigApplication();
		expect((await call(`/messages/gig/${appId}`, { as: stranger })).status).toBe(403);
		expect((await call(`/messages/gig/${appId}`, { method: 'POST', as: stranger, body: { body: 'hi' } })).status).toBe(403);
		expect((await call(`/messages/gig/${appId}`, { method: 'POST', as: poster, body: { body: '   ' } })).status).toBe(400);
		expect((await call('/messages/gig/999999', { as: poster })).status).toBe(404);
	});

	it('band-seat applications get threads too', async () => {
		const band = await call('/bands', {
			method: 'POST', as: poster,
			body: { name: 'Thread Test Band', genres: ['rock'], seats: ['bass'] },
		});
		const feed = await call('/bands');
		const seat = feed.json.bands.find((b: any) => b.id === band.json.id).open_seats[0];
		await call('/musicians/me', { method: 'POST', as: musician, body: { instruments: ['bass'], genres: ['rock'] } });
		await call(`/bands/seats/${seat.id}/apply`, { method: 'POST', as: musician, body: {} });
		const detail = await call(`/bands/${band.json.id}`, { as: poster });
		const appId = detail.json.applications[0].id;

		expect((await call(`/messages/seat/${appId}`, { method: 'POST', as: musician, body: { body: 'What is the rehearsal schedule?' } })).status).toBe(201);
		const threads = await call('/messages/threads', { as: poster });
		const th = threads.json.threads.find((x: any) => x.thread_type === 'seat' && x.thread_id === appId);
		expect(th.context).toContain('Thread Test Band');
		expect(th.unread).toBe(1);
	});
});
