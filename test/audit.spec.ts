// Guards for the October 2026 audit fixes: logged-out session shape, document
// vs JSON on the shared paths, hashed assets, and fail-closed Turnstile.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index';
import { assetsFresh } from '../src/shell';
import { turnstileOk } from '../src/turnstile';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function get(path: string, headers: Record<string, string> = {}) {
	const ctx = createExecutionContext();
	const res = await worker.fetch(new IncomingRequest('http://localhost' + path, { headers }), env, ctx);
	await waitOnExecutionContext(ctx);
	return res;
}

describe('Audit fixes', () => {
	it('keeps the minified client in sync with src/ui.ts', () => {
		expect(assetsFresh()).toBe(true);
	});

	it('answers /auth/me with 200 and a null user when logged out', async () => {
		const res = await get('/auth/me');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ user: null });
	});

	it('serves the gig board as HTML for a navigation and JSON for the API', async () => {
		const html = await get('/gigs', { 'Sec-Fetch-Dest': 'document', Accept: 'text/html' });
		expect(html.status).toBe(200);
		expect(html.headers.get('content-type')).toContain('text/html');
		const body = await html.text();
		expect(body).toContain('id="landing" hidden');
		expect(body).toContain('id="tab-board"');
		expect(body).not.toContain('id="tab-board" hidden');
		expect(body).toContain('data-tab="board" class="active"');
		expect(html.headers.get('cache-control')).toContain('private');
		expect(html.headers.get('strict-transport-security')).toContain('includeSubDomains');
		expect(html.headers.get('content-security-policy')).toContain("script-src 'self'");
		expect(html.headers.get('content-security-policy')).toContain('challenges.cloudflare.com');

		// The service worker re-fetches navigations without Sec-Fetch-Dest: document.
		const viaSw = await get('/messages', { Accept: 'text/html', 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors' });
		expect(viaSw.status).toBe(200);
		expect(viaSw.headers.get('content-type')).toContain('text/html');
		expect(await viaSw.text()).toContain('id="guestMsgs"');
		const api = await get('/gigs', { Accept: '*/*', 'Sec-Fetch-Dest': 'empty' });
		expect(api.headers.get('content-type')).toContain('application/json');
		const json = await api.json() as { gigs?: unknown };
		expect(Array.isArray(json.gigs)).toBe(true);
	});

	it('serves hashed CSS and JS with a long cache, and self-hosted fonts', async () => {
		const page = await get('/');
		const html = await page.text();
		expect(html).not.toContain('<style>');
		expect(html).not.toContain('fonts.googleapis.com');
		const cssHref = html.match(/href="(\/assets\/app\.[a-f0-9]+\.css)"/)?.[1];
		const font = await get('/fonts/instrument-sans-latin.woff2');
		expect(font.status).toBe(200);
		expect(font.headers.get('content-type')).toContain('font/woff2');
		expect(font.headers.get('cache-control')).toContain('immutable');
		expect(cssHref).toBeTruthy();
		const css = await get(cssHref!);
		expect(css.status).toBe(200);
		expect(css.headers.get('cache-control')).toContain('immutable');
		expect(await css.text()).toMatch(/--muted:\s*#3e3c36/);
	});

	it('does not serve the old Mailjet ownership file', async () => {
		expect((await get('/c9430416e4605ac213d863a7ff83f3f8.txt')).status).toBe(404);
	});

	it('fails closed when Turnstile siteverify throws', async () => {
		const prev = env.TURNSTILE_SECRET_KEY;
		env.TURNSTILE_SECRET_KEY = 'test-secret';
		const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('siteverify down'));
		try {
			expect(await turnstileOk(env, 'token', '203.0.113.5')).toBe(false);
		} finally {
			spy.mockRestore();
			env.TURNSTILE_SECRET_KEY = prev;
		}
	});
});
