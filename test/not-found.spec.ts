// test/not-found.spec.ts — unmatched routes: localized HTML 404 for browsers, JSON for API clients.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function get(path: string, headers: Record<string, string> = {}) {
	const request = new IncomingRequest(`http://localhost${path}`, { headers });
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe('Not found', () => {
	it('renders a localized HTML 404 for browsers', async () => {
		const res = await get('/no-such-page', { Accept: 'text/html', 'Accept-Language': 'de-CH,de;q=0.9' });
		expect(res.status).toBe(404);
		expect(res.headers.get('content-type')).toContain('text/html');
		const html = await res.text();
		expect(html).toContain('Seite nicht gefunden');
		expect(html).toContain('href="/"');
	});

	it('returns JSON for API clients', async () => {
		const res = await get('/no-such-page', { Accept: 'application/json' });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'Not found' });
	});

	it('front page carries Open Graph tags with an absolute image', async () => {
		const html = await (await get('/')).text();
		expect(html).toContain('<meta property="og:title"');
		expect(html).toContain('content="https://jamwerk.app/icons/icon-512.png"');
		expect(html).toContain('<meta name="description"');
	});
});

describe('Geo language hint', () => {
	it('front page renders without a geo hint when cf is absent', async () => {
		const html = await (await get('/')).text();
		expect(html).toContain('<html lang="en">');
		expect(html).not.toContain('data-geo');
	});
});
