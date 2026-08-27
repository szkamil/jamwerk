import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
async function page(path: string, accept?: string) {
	const ctx = createExecutionContext();
	const r = await worker.fetch(new IncomingRequest('http://localhost' + path, { headers: accept ? { 'Accept-Language': accept } : {} }), env, ctx);
	await waitOnExecutionContext(ctx);
	return { status: r.status, html: await r.text() };
}

describe('About page', () => {
	it('renders story, free line, feedback link and legal notice in all four languages', async () => {
		const fr = await page('/about', 'fr');
		expect(fr.status).toBe(200);
		expect(fr.html).toContain('À propos de JamWerk');
		expect(fr.html).toContain('100 % gratuit pour les musiciens');
		expect(fr.html).toContain('id="terms"');
		expect(fr.html).toContain('Limitation de responsabilité');
		expect(fr.html).not.toContain('Éditeur');
		expect(fr.html).not.toContain('Hébergement');
		expect(fr.html).toContain('/?feedback=1');
		expect((await page('/about?lang=de')).html).toContain('Haftungsbeschränkung');
		expect((await page('/about?lang=it')).html).toContain('Limitazione di responsabilità');
		expect((await page('/about?lang=en')).html).toContain('Limitation of liability');
	});
	it('is linked from the app footer and the public pages', async () => {
		expect((await page('/')).html).toContain('href="/about"');
	});
});
