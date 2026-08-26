// test/bands-directory.spec.ts — bands as a directory: kind / bookable / fee, filters,
// owner edit, booking inquiries as 'band' message threads, public /b page.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const owner = 'dir-owner@example.com';
const client = 'dir-client@example.com';
const unconfirmed = 'dir-unconfirmed@example.com';

function cookieFor(email: string): string {
	return `token=${jwt.sign({ email }, (env as any).JWT_SECRET, { expiresIn: '1h' })}`;
}
async function raw(path: string, opts: { method?: string; as?: string; body?: unknown; headers?: Record<string, string> } = {}) {
	const headers: Record<string, string> = { ...(opts.headers || {}) };
	if (opts.as) headers.Cookie = cookieFor(opts.as);
	if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
	const request = new IncomingRequest(`http://localhost${path}`, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}
async function call(path: string, opts: Parameters<typeof raw>[1] = {}) {
	const r = await raw(path, opts);
	return { status: r.status, json: (await r.json()) as any };
}

beforeAll(async () => {
	await env.DB.batch([
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Olivia Owner', 1)").bind(owner),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Chris Client', 1)").bind(client),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Uma Unconfirmed', 0)").bind(unconfirmed),
	]);
});

const soulBand = {
	name: 'Lake Soul Collective', genres: ['soul', 'funk'], home_city: 'Genève',
	description: 'Five-piece, three sets.', links: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
	kind: 'band', bookable: true, fee_from: 1500, fee_currency: 'CHF', pitch: 'Soul & funk for weddings and parties',
};

describe('Bands directory', () => {
	it('creates a bookable band with fee, pitch and slug; jam groups are never bookable', async () => {
		const created = await call('/bands', { method: 'POST', as: owner, body: soulBand });
		expect(created.status).toBe(201);
		const jam = await call('/bands', { method: 'POST', as: owner, body: { name: 'Tuesday Jazz Jam', genres: ['jazz'], home_city: 'Lausanne', kind: 'jam', bookable: true, fee_from: 500 } });
		expect(jam.status).toBe(201);
		const feed = await call('/bands');
		const b = feed.json.bands.find((x: any) => x.id === created.json.id);
		expect(b.bookable).toBe(true);
		expect(b.fee_from).toBe(1500);
		expect(b.fee_currency).toBe('CHF');
		expect(b.pitch).toBe('Soul & funk for weddings and parties');
		expect(b.slug).toBe('lake-soul-collective');
		expect(b.media[0].kind).toBe('youtube');
		const j = feed.json.bands.find((x: any) => x.id === jam.json.id);
		expect(j.kind).toBe('jam');
		expect(j.bookable).toBe(false);
		expect(j.fee_from).toBeNull();
	});

	it('filters by bookable, kind, genre and city radius', async () => {
		await call('/bands', { method: 'POST', as: owner, body: soulBand });
		await call('/bands', { method: 'POST', as: owner, body: { name: 'Tuesday Jazz Jam', genres: ['jazz'], home_city: 'Lausanne', kind: 'jam' } });
		await call('/bands', { method: 'POST', as: owner, body: { name: 'Bern Rockers', genres: ['rock'], home_city: 'Bern' } });
		const bookable = await call('/bands?bookable=1');
		expect(bookable.json.bands.every((b: any) => b.bookable)).toBe(true);
		expect(bookable.json.bands.some((b: any) => b.name === 'Lake Soul Collective')).toBe(true);
		const jams = await call('/bands?kind=jam');
		expect(jams.json.bands.length).toBeGreaterThan(0);
		expect(jams.json.bands.every((b: any) => b.kind === 'jam')).toBe(true);
		const funk = await call('/bands?genre=funk');
		expect(funk.json.bands.every((b: any) => b.genres.includes('funk'))).toBe(true);
		const nearGeneva = await call('/bands?city=Genf&radius_km=10');
		expect(nearGeneva.json.bands.some((b: any) => b.name === 'Lake Soul Collective')).toBe(true);
		expect(nearGeneva.json.bands.some((b: any) => b.name === 'Tuesday Jazz Jam')).toBe(false);
		expect(nearGeneva.json.bands[0].distance_km).toBeLessThanOrEqual(10);
	});

	it('lets only the owner edit the band', async () => {
		const created = await call('/bands', { method: 'POST', as: owner, body: { ...soulBand, name: 'Edit Me' } });
		const forbidden = await call('/bands/' + created.json.id, { method: 'PUT', as: client, body: { pitch: 'hijack' } });
		expect(forbidden.status).toBe(403);
		const ok = await call('/bands/' + created.json.id, { method: 'PUT', as: owner, body: { name: 'Edited', genres: ['rock'], bookable: false, links: [] } });
		expect(ok.status).toBe(200);
		const detail = await call('/bands/' + created.json.id);
		expect(detail.json.name).toBe('Edited');
		expect(detail.json.bookable).toBe(false);
		expect(detail.json.genres).toEqual(['rock']);
		const badCity = await call('/bands/' + created.json.id, { method: 'PUT', as: owner, body: { home_city: 'Xyzzyville' } });
		expect(badCity.json.code).toBe('city_unknown');
	});

	it('booking inquiry needs login + confirmed email, opens a band thread both sides can use', async () => {
		const created = await call('/bands', { method: 'POST', as: owner, body: { ...soulBand, name: 'Inquiry Band' } });
		const id = created.json.id;
		expect((await call(`/bands/${id}/inquire`, { method: 'POST', body: { message: 'Hello there, are you free?' } })).status).toBe(401);
		const unc = await call(`/bands/${id}/inquire`, { method: 'POST', as: unconfirmed, body: { message: 'Hello there, are you free?' } });
		expect(unc.status).toBe(403);
		expect(unc.json.code).toBe('email_unconfirmed');
		expect((await call(`/bands/${id}/inquire`, { method: 'POST', as: owner, body: { message: 'Talking to myself here' } })).status).toBe(400);
		expect((await call(`/bands/${id}/inquire`, { method: 'POST', as: client, body: { message: 'short' } })).status).toBe(400);

		const first = await call(`/bands/${id}/inquire`, { method: 'POST', as: client, body: { message: 'Wedding on 12 Sept in Nyon, 120 guests, budget 2000.' } });
		expect(first.status).toBe(201);
		expect(first.json.thread_type).toBe('band');
		const again = await call(`/bands/${id}/inquire`, { method: 'POST', as: client, body: { message: 'Forgot to say: outdoor stage.' } });
		expect(again.json.thread_id).toBe(first.json.thread_id);

		const ownerThreads = await call('/messages/threads', { as: owner });
		const th = ownerThreads.json.threads.find((t: any) => t.thread_type === 'band' && t.thread_id === first.json.thread_id);
		expect(th.counterpart).toBe('Chris Client');
		expect(th.context).toBe('Inquiry Band');
		expect(th.unread).toBe(2);
		const thread = await call(`/messages/band/${first.json.thread_id}`, { as: owner });
		expect(thread.status).toBe(200);
		expect(thread.json.messages.length).toBe(2);
		const reply = await call(`/messages/band/${first.json.thread_id}`, { method: 'POST', as: owner, body: { body: 'Yes, we are free — let us talk.' } });
		expect(reply.status).toBe(201);
		const clientThreads = await call('/messages/threads', { as: client });
		expect(clientThreads.json.threads.find((t: any) => t.thread_type === 'band').counterpart).toBe('Olivia Owner');
		expect((await call(`/messages/band/${first.json.thread_id}`, { as: unconfirmed })).status).toBe(403);
	});

	it('caps new inquiries at 3 per day', async () => {
		const ids: number[] = [];
		for (let i = 0; i < 4; i++) ids.push((await call('/bands', { method: 'POST', as: owner, body: { ...soulBand, name: 'Cap Band ' + i } })).json.id);
		const spammer = 'dir-spammer@example.com';
		await env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, confirmed) VALUES (?, 'x', 1)").bind(spammer).run();
		const statuses: number[] = [];
		for (const id of ids) statuses.push((await call(`/bands/${id}/inquire`, { method: 'POST', as: spammer, body: { message: 'Message number for band ' + id } })).status);
		expect(statuses).toEqual([201, 201, 201, 429]);
	});

	it('serves a public band page with fee, demos and line-up; 404 for unknown ids', async () => {
		const created = await call('/bands', { method: 'POST', as: owner, body: { ...soulBand, name: 'Page Band', seats: ['bass'] } });
		const res = await raw(`/b/${created.json.id}-page-band`, { headers: { 'Accept-Language': 'fr' } });
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('Page Band');
		expect(html).toContain('dès CHF');
		expect(html).toMatch(/1\D?500/); // de-CH grouping
		expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
		expect(html).toContain('place libre');
		expect(html).toContain(`/?band=${created.json.id}`);
		expect(html).toContain('og:title');
		expect((await raw('/b/999999')).status).toBe(404);
		expect((await raw('/b/not-an-id')).status).toBe(404);
	});
});
