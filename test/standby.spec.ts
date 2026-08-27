// test/standby.spec.ts — replacement vs standby gigs: shortlist, activate, first-to-confirm wins.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const leader = 'sb-leader@example.com', a = 'sb-a@example.com', b = 'sb-b@example.com';
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
const soon = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

beforeAll(async () => {
	await env.DB.batch([
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Lea Leader', 1)").bind(leader),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Ann A', 1)").bind(a),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Ben B', 1)").bind(b),
		env.DB.prepare("INSERT OR IGNORE INTO musician_details (owner, instruments, handle) VALUES (?, '[\"bass\"]', 'ann-a')").bind(a),
		env.DB.prepare("INSERT OR IGNORE INTO musician_details (owner, instruments, handle) VALUES (?, '[\"bass\"]', 'ben-b')").bind(b),
	]);
});
const gigBody = { kind: 'gig', instrument: 'bass', genres: ['soul'], gig_date: soon, venue_city: 'Genève', fee_chf: 300, description: 'Wedding, three sets.' };

describe('Standby gigs', () => {
	it('stores need, exposes my_status, and runs shortlist → activate → first confirm wins', async () => {
		const g = await call('/gigs', { method: 'POST', as: leader, body: { ...gigBody, need: 'standby' } });
		expect(g.status).toBe(201);
		const id = g.json.id;
		expect((await call('/gigs?kind=gig')).json.gigs.find((x: any) => x.id === id).need).toBe('standby');
		expect((await call(`/gigs/${id}/apply`, { method: 'POST', as: a, body: { note: '' } })).status).toBe(201);
		expect((await call(`/gigs/${id}/apply`, { method: 'POST', as: b, body: { note: '' } })).status).toBe(201);
		expect((await call('/gigs?kind=gig', { as: a })).json.gigs.find((x: any) => x.id === id).my_status).toBe('applied');
		// activation without standbys is refused
		expect((await call(`/gigs/${id}/activate-standby`, { method: 'POST', as: leader })).json.code).toBe('no_standby');
		const detail = await call(`/gigs/${id}`, { as: leader });
		const apps = detail.json.applications;
		for (const ap of apps) expect((await call(`/gigs/${id}/applications/${ap.id}/shortlist`, { method: 'POST', as: leader })).status).toBe(200);
		expect((await call('/gigs?kind=gig', { as: b })).json.gigs.find((x: any) => x.id === id).my_status).toBe('shortlisted');
		// confirming before activation is refused
		expect((await call(`/gigs/${id}/confirm`, { method: 'POST', as: a })).status).toBe(409);
		const act = await call(`/gigs/${id}/activate-standby`, { method: 'POST', as: leader });
		expect(act.json.pinged).toBe(2);
		expect((await call('/gigs?kind=gig', { as: a })).json.gigs.find((x: any) => x.id === id).standby_activated_at).toBeTruthy();
		// not a standby → 403; first standby confirms → booked; second → taken
		expect((await call(`/gigs/${id}/confirm`, { method: 'POST', as: leader })).status).toBe(403);
		expect((await call(`/gigs/${id}/confirm`, { method: 'POST', as: b })).status).toBe(200);
		const late = await call(`/gigs/${id}/confirm`, { method: 'POST', as: a });
		expect(late.status).toBe(409); expect(late.json.code).toBe('taken');
		const mine = await call('/gigs/mine', { as: leader });
		const booked = mine.json.posted.find((x: any) => x.id === id);
		expect(booked.status).toBe('booked');
		const bApps = (await call('/gigs/mine', { as: b })).json.applications.find((x: any) => x.id === id);
		expect(bApps.application_status).toBe('accepted');
		expect((await call('/gigs/mine', { as: a })).json.applications.find((x: any) => x.id === id).application_status).toBe('declined');
	});
	it('defaults to a replacement and accepts still works', async () => {
		const g = await call('/gigs', { method: 'POST', as: leader, body: { ...gigBody, gig_date: tomorrow } });
		expect((await call('/gigs?kind=gig')).json.gigs.find((x: any) => x.id === g.json.id).need).toBe('dep');
		await call(`/gigs/${g.json.id}/apply`, { method: 'POST', as: a, body: { note: '' } });
		const apps = (await call(`/gigs/${g.json.id}`, { as: leader })).json.applications;
		expect((await call(`/gigs/${g.json.id}/applications/${apps[0].id}/accept`, { method: 'POST', as: leader })).status).toBe(200);
	});
});
