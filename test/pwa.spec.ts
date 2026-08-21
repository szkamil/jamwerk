// test/pwa.spec.ts — installable-app layer: manifest, icons, service worker.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function get(path: string) {
	const request = new IncomingRequest(`http://localhost${path}`);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe('PWA', () => {
	it('serves a valid manifest', async () => {
		const res = await get('/manifest.webmanifest');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('application/manifest+json');
		const m = (await res.json()) as any;
		expect(m.name).toBe('JamWerk');
		expect(m.display).toBe('standalone');
		expect(m.icons.length).toBeGreaterThanOrEqual(3);
		// every icon the manifest declares must actually be served
		for (const icon of m.icons) {
			const iconRes = await get(icon.src);
			expect(iconRes.status).toBe(200);
			expect(iconRes.headers.get('content-type')).toBe('image/png');
			const bytes = new Uint8Array(await iconRes.arrayBuffer());
			// PNG magic
			expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
		}
	});

	it('serves the service worker as JS and the page registers it', async () => {
		const sw = await get('/sw.js');
		expect(sw.status).toBe(200);
		expect(sw.headers.get('content-type')).toContain('javascript');
		expect(await sw.text()).toContain('addEventListener');

		const page = await get('/');
		const html = await page.text();
		expect(html).toContain('manifest.webmanifest');
		expect(html).toContain("serviceWorker' in navigator");
		expect(html).toContain('apple-touch-icon');
	});

	it('serves the apple-touch icon and favicon', async () => {
		expect((await get('/icons/icon-180.png')).status).toBe(200);
		const fav = await get('/favicon.ico');
		expect(fav.status).toBe(200);
		expect(fav.headers.get('content-type')).toBe('image/png');
	});

	it('unknown icon 404s', async () => {
		expect((await get('/icons/icon-999.png')).status).toBe(404);
	});
});
