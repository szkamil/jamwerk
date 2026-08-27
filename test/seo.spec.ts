import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
async function get(path: string) { const ctx = createExecutionContext(); const r = await worker.fetch(new IncomingRequest('http://localhost' + path), env, ctx); await waitOnExecutionContext(ctx); return { status: r.status, text: await r.text(), type: r.headers.get('content-type') || '' }; }
describe('SEO', () => {
	it('serves robots.txt and a sitemap with landing, about and band pages; app shell is indexable', async () => {
		await env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES ('seo@example.com', 'x')").run();
		await env.DB.prepare("INSERT INTO bands (owner_email, name, genres) VALUES ('seo@example.com', 'Lémanic Soul', '[\"soul\"]')").run();
		const robots = await get('/robots.txt');
		expect(robots.text).toContain('Sitemap:'); expect(robots.text).toContain('Disallow: /m/');
		const sm = await get('/sitemap.xml');
		expect(sm.status).toBe(200); expect(sm.type).toContain('xml');
		expect(sm.text).toContain('/about'); expect(sm.text).toMatch(/\/b\/\d+-lemanic-soul/);
		expect((await get('/')).text).not.toContain('name="robots" content="noindex"');
	});
});
