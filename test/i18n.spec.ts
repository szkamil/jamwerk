// test/i18n.spec.ts — language capture, preference endpoint, localized pages.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';
import { pickLang, normLang } from '../src/i18n';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function req(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
	const request = new IncomingRequest(`http://localhost${path}`, init);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe('i18n', () => {
	it('pickLang and normLang behave', () => {
		expect(pickLang('fr-CH,fr;q=0.9,en;q=0.8')).toBe('fr');
		expect(pickLang('de-DE')).toBe('de');
		expect(pickLang('pt-BR,es;q=0.9')).toBe('en');
		expect(pickLang(null)).toBe('en');
		expect(normLang('it')).toBe('it');
		expect(normLang('xx')).toBe('en');
	});

	it('registration stores the browser language; /auth/lang updates it', async () => {
		const reg = await req('/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Accept-Language': 'fr-CH,fr;q=0.9' },
			body: JSON.stringify({ accept_terms: true, email: 'romand@example.com', password: 'longenough1' }),
		});
		expect(reg.status).toBe(201);
		const row = await env.DB.prepare("SELECT lang FROM users WHERE email = 'romand@example.com'").first<{ lang: string }>();
		expect(row!.lang).toBe('fr');

		const cookie = (reg.headers.get('set-cookie') || '').split(';')[0];
		const upd = await req('/auth/lang', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ lang: 'de' }),
		});
		expect(upd.status).toBe(200);
		const after = await env.DB.prepare("SELECT lang FROM users WHERE email = 'romand@example.com'").first<{ lang: string }>();
		expect(after!.lang).toBe('de');

		const bad = await req('/auth/lang', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ lang: 'xx' }),
		});
		expect(bad.status).toBe(400);
	});

	it('public profile page renders in the visitor language', async () => {
		const reg = await req('/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accept_terms: true, email: 'seiten@example.com', password: 'longenough1', display_name: 'Anna Keller' }),
		});
		const cookie = (reg.headers.get('set-cookie') || '').split(';')[0];
		const prof = await req('/musicians/me', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ instruments: ['drums'], genres: ['rock'] }),
		});
		const { handle } = (await prof.json()) as any;

		const de = await (await req(`/m/${handle}`, { headers: { 'Accept-Language': 'de-CH' } })).text();
		expect(de).toContain('gespielte Gigs');
		expect(de).toContain('Bewertungen');
		const it_ = await (await req(`/m/${handle}`, { headers: { 'Accept-Language': 'it' } })).text();
		expect(it_).toContain('concerti suonati');
		const en = await (await req(`/m/${handle}`)).text();
		expect(en).toContain('gigs played');
	});
});
