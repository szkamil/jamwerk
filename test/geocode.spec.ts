// test/geocode.spec.ts — city -> coordinates via the D1 geocode cache, and
// radius search around a geocoded city. GEOCODE_OFF=1 in the test bindings
// keeps Nominatim out of the loop; specs seed the cache directly.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const poster = 'geo-poster@example.com';

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
const bernGig = {
	instrument: 'bass', genres: ['jazz'], gig_date: gigDate, venue_city: 'Bern',
	fee_chf: 300, description: 'Radius-search test gig.',
};

beforeAll(async () => {
	await env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, 'x')").bind(poster).run();
	// Bern and Thun are ~25 km apart.
	await env.DB.batch([
		env.DB.prepare("INSERT OR REPLACE INTO geocode_cache (city_key, lat, lng) VALUES ('bern', 46.948, 7.4474)"),
		env.DB.prepare("INSERT OR REPLACE INTO geocode_cache (city_key, lat, lng) VALUES ('thun', 46.758, 7.628)"),
	]);
});

describe('Geocoding', () => {
	it('fills gig coordinates from the cached city on post', async () => {
		const created = await call('/gigs', { method: 'POST', as: poster, body: bernGig });
		expect(created.status).toBe(201);
		const detail = await call(`/gigs/${created.json.id}`);
		expect(detail.json.venue_lat).toBeCloseTo(46.948, 2);
		expect(detail.json.venue_lng).toBeCloseTo(7.4474, 2);
	});

	it('city filter becomes a radius search around the geocoded city', async () => {
		const created = await call('/gigs', { method: 'POST', as: poster, body: bernGig });
		const id = created.json.id;

		const near = await call('/gigs?city=Thun&radius_km=50');
		const hit = near.json.gigs.find((g: any) => g.id === id);
		expect(hit).toBeTruthy();
		expect(hit.distance_km).toBeGreaterThan(15);
		expect(hit.distance_km).toBeLessThan(35);

		const tight = await call('/gigs?city=Thun&radius_km=10');
		expect(tight.json.gigs.find((g: any) => g.id === id)).toBeUndefined();
	});

	it('falls back to exact city match when the city cannot be geocoded', async () => {
		const created = await call('/gigs', {
			method: 'POST', as: poster,
			body: { ...bernGig, venue_city: 'Zermatt' },
		});
		const id = created.json.id;
		const r = await call('/gigs?city=Zermatt');
		expect(r.json.gigs.find((g: any) => g.id === id)).toBeTruthy();
		const detail = await call(`/gigs/${id}`);
		expect(detail.json.venue_lat).toBeNull();
	});

	it('fills musician home coordinates from the cached city', async () => {
		const r = await call('/musicians/me', {
			method: 'POST', as: poster,
			body: { instruments: ['bass'], genres: ['jazz'], home_city: 'Bern' },
		});
		expect(r.status).toBe(200);
		const me = await call('/musicians/me', { as: poster });
		expect(me.json.home_lat).toBeCloseTo(46.948, 2);
	});
});
