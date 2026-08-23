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
	await env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, confirmed) VALUES (?, 'x', 1)").bind(poster).run();
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

	it('resolves curated places offline and refuses unknown cities', async () => {
		// Zermatt is in the bundled list → coordinates even with geocoding off
		const created = await call('/gigs', { method: 'POST', as: poster, body: { ...bernGig, venue_city: 'Zermatt' } });
		expect(created.status).toBe(201);
		const detail = await call(`/gigs/${created.json.id}`);
		expect(detail.json.venue_lat).toBeCloseTo(46.02, 1);
		// aliases in other languages resolve to the same place
		const genf = await call('/gigs', { method: 'POST', as: poster, body: { ...bernGig, venue_city: 'Genf' } });
		expect(genf.status).toBe(201);
		expect((await call(`/gigs/${genf.json.id}`)).json.venue_lng).toBeCloseTo(6.14, 1);
		// a typo is refused instead of being saved invisibly
		const typo = await call('/gigs', { method: 'POST', as: poster, body: { ...bernGig, venue_city: 'Genve' } });
		expect(typo.status).toBe(400);
		expect(typo.json.code).toBe('city_unknown');
		// coordinates picked in the typeahead are accepted for places outside the list
		const picked = await call('/gigs', { method: 'POST', as: poster, body: { ...bernGig, venue_city: 'Saint-Cergue', venue_lat: 46.446, venue_lng: 6.158 } });
		expect(picked.status).toBe(201);
	});

	it('suggests places: curated list, aliases, prefixes', async () => {
		const r = await call('/places?q=genf');
		expect(r.json.places[0].name).toBe('Genève');
		const r2 = await call('/places?q=st jul');
		expect(r2.json.places.map((p: any) => p.name)).toContain('Saint-Julien-en-Genevois');
		const r3 = await call('/places?q=la');
		expect(r3.json.places.map((p: any) => p.name)).toContain('Lausanne');
		expect((await call('/places?q=x')).json.places).toEqual([]);
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
