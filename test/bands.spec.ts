// test/bands.spec.ts — band formation: create, seats, applications, fill.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const founder = 'founder@example.com';
const drummer = 'band-drummer@example.com';
const keys = 'band-keys@example.com';

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

beforeAll(async () => {
	await env.DB.batch([
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Frank Founder')").bind(founder),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Dana Drums')").bind(drummer),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, 'x')").bind(keys),
	]);
});

const newBand = {
	name: 'The Midnight Keys',
	genres: ['soul', 'funk'],
	home_city: 'Bern',
	description: 'Weekly rehearsals, gigging monthly.',
	seats: ['drums', 'keys'],
};

describe('Bands', () => {
	it('creates a band with open seats; it appears on the feed', async () => {
		const created = await call('/bands', { method: 'POST', as: founder, body: newBand });
		expect(created.status).toBe(201);
		const feed = await call('/bands');
		const band = feed.json.bands.find((b: any) => b.id === created.json.id);
		expect(band).toBeTruthy();
		expect(band.member_count).toBe(1);
		expect(band.open_seats.map((s: any) => s.instrument).sort()).toEqual(['drums', 'keys']);
	});

	it('runs the seat lifecycle: apply, accept fills the seat, others declined', async () => {
		const created = await call('/bands', { method: 'POST', as: founder, body: newBand });
		const bandId = created.json.id;
		const feed = await call('/bands');
		const seat = feed.json.bands.find((b: any) => b.id === bandId).open_seats.find((s: any) => s.instrument === 'drums');

		// needs a musician profile
		const noProfile = await call(`/bands/seats/${seat.id}/apply`, { method: 'POST', as: drummer, body: {} });
		expect(noProfile.status).toBe(403);
		await call('/musicians/me', { method: 'POST', as: drummer, body: { instruments: ['drums'], genres: ['soul'] } });
		await call('/musicians/me', { method: 'POST', as: keys, body: { instruments: ['drums'], genres: ['funk'] } });

		expect((await call(`/bands/seats/${seat.id}/apply`, { method: 'POST', as: drummer, body: { note: 'Pocket player.' } })).status).toBe(201);
		expect((await call(`/bands/seats/${seat.id}/apply`, { method: 'POST', as: keys, body: {} })).status).toBe(201);
		// duplicate application
		expect((await call(`/bands/seats/${seat.id}/apply`, { method: 'POST', as: drummer, body: {} })).status).toBe(409);
		// founder cannot apply to own band
		expect((await call(`/bands/seats/${seat.id}/apply`, { method: 'POST', as: founder, body: {} })).status).toBe(403);

		// owner sees enriched applications, emails hidden pre-acceptance
		const detail = await call(`/bands/${bandId}`, { as: founder });
		const apps = detail.json.applications.filter((a: any) => a.seat_id === seat.id);
		expect(apps).toHaveLength(2);
		expect(apps[0].display_name).toBe('Dana Drums');
		expect(apps[0].musician_email).toBeUndefined();

		// only the owner can accept
		expect((await call(`/bands/seats/${seat.id}/applications/${apps[0].id}/accept`, { method: 'POST', as: drummer })).status).toBe(403);

		const accepted = await call(`/bands/seats/${seat.id}/applications/${apps[0].id}/accept`, { method: 'POST', as: founder });
		expect(accepted.status).toBe(200);
		expect(accepted.json.musician_email).toBe(drummer);

		const after = await call(`/bands/${bandId}`, { as: founder });
		const filledSeat = after.json.seats.find((s: any) => s.id === seat.id);
		expect(filledSeat.status).toBe('filled');
		expect(filledSeat.member.display_name).toBe('Dana Drums');
		const otherApp = after.json.applications.find((a: any) => a.seat_id === seat.id && a.id !== apps[0].id);
		expect(otherApp.status).toBe('declined');

		// member count reflects the fill; late applications bounce
		const feed2 = await call('/bands');
		expect(feed2.json.bands.find((b: any) => b.id === bandId).member_count).toBe(2);
		expect((await call(`/bands/seats/${seat.id}/apply`, { method: 'POST', as: keys, body: {} })).status).toBe(409);
	});

	it('owner can add and close seats; others cannot', async () => {
		const created = await call('/bands', { method: 'POST', as: founder, body: { ...newBand, seats: [] } });
		const bandId = created.json.id;
		expect((await call(`/bands/${bandId}/seats`, { method: 'POST', as: drummer, body: { instrument: 'bass' } })).status).toBe(403);
		const added = await call(`/bands/${bandId}/seats`, { method: 'POST', as: founder, body: { instrument: 'bass' } });
		expect(added.status).toBe(201);
		expect((await call(`/bands/seats/${added.json.id}/close`, { method: 'POST', as: drummer })).status).toBe(403);
		expect((await call(`/bands/seats/${added.json.id}/close`, { method: 'POST', as: founder })).status).toBe(200);
		await call('/musicians/me', { method: 'POST', as: drummer, body: { instruments: ['bass'], genres: ['soul'] } });
		expect((await call(`/bands/seats/${added.json.id}/apply`, { method: 'POST', as: drummer, body: {} })).status).toBe(409);
	});
});
