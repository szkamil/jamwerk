// test/musicians.spec.ts — public musician directory + "looking for".
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const cookieFor = (email: string) => `token=${jwt.sign({ email }, (env as any).JWT_SECRET, { expiresIn: '1h' })}`;

async function call(path: string, opts: { method?: string; as?: string; body?: unknown } = {}) {
	const headers: Record<string, string> = {};
	if (opts.as) headers.Cookie = cookieFor(opts.as);
	if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
	const request = new IncomingRequest(`http://localhost${path}`, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return { status: response.status, json: (await response.json()) as any };
}

describe('Musicians directory', () => {
	it('is public, filters by instrument / radius / looking_for, and shows what people want', async () => {
		const a = 'bassist-gva@example.com', b = 'drummer-lsn@example.com';
		await env.DB.batch([
			env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Ana Bass')").bind(a),
			env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Dan Drums')").bind(b),
		]);
		expect((await call('/musicians/me', { method: 'POST', as: a, body: { instruments: ['bass'], genres: ['samba'], home_city: 'Genève', looking_for: ['dep', 'jam'] } })).status).toBe(200);
		expect((await call('/musicians/me', { method: 'POST', as: b, body: { instruments: ['drums'], genres: ['rock'], home_city: 'Lausanne', looking_for: ['join_band'] } })).status).toBe(200);

		const all = await call('/musicians');            // no cookie: public
		expect(all.status).toBe(200);
		const names = all.json.musicians.map((m: any) => m.display_name);
		expect(names).toEqual(expect.arrayContaining(['Ana Bass', 'Dan Drums']));
		const ana = all.json.musicians.find((m: any) => m.display_name === 'Ana Bass');
		expect(ana.looking_for).toEqual(['dep', 'jam']);
		expect(ana.handle).toBeTruthy();

		expect((await call('/musicians?instrument=bass')).json.musicians.map((m: any) => m.display_name)).toEqual(['Ana Bass']);
		const near = await call('/musicians?city=Gen%C3%A8ve&radius_km=30');
		expect(near.json.musicians.map((m: any) => m.display_name)).toEqual(['Ana Bass']);
		expect(near.json.musicians[0].distance_km).toBeLessThan(5);
		expect((await call('/musicians?looking_for=join_band')).json.musicians.map((m: any) => m.display_name)).toEqual(['Dan Drums']);

		const me = await call('/musicians/me', { as: a });
		expect(me.json.looking_for).toEqual(['dep', 'jam']);
	});
});
