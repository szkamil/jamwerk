// Logged-out shell, search labels, install prompt, and German board copy.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function get(path: string, headers: Record<string, string> = {}) {
	const ctx = createExecutionContext();
	const res = await worker.fetch(new IncomingRequest('http://localhost' + path, { headers }), env, ctx);
	await waitOnExecutionContext(ctx);
	return { status: res.status, text: await res.text(), type: res.headers.get('content-type') || '' };
}

async function clientAssets() {
	const home = await get('/');
	const src = home.text.match(/src="(\/assets\/app\.[a-f0-9]+\.js)"/);
	const cssHref = home.text.match(/href="(\/assets\/app\.[a-f0-9]+\.css)"/);
	expect(src).toBeTruthy();
	expect(cssHref).toBeTruthy();
	const js = await get(src![1]);
	const css = await get(cssHref![1]);
	expect(js.status).toBe(200);
	expect(js.type).toContain('javascript');
	expect(css.type).toContain('css');
	return { home: home.text, js: js.text, css: css.text };
}

describe('current UI shell fixes', () => {
	it('does not expose member-only links or an open install dialog to logged-out visitors', async () => {
		const { home, js, css } = await clientAssets();
		expect(home).not.toMatch(/<a[^>]*href="\/auth\/export"/);
		expect(home).toContain('id="sExport" hidden');
		expect(home).toContain('id="sDelete" hidden');
		expect(home).toMatch(/id="mPublic"[^>]*hidden/);
		expect(home).toContain('id="footInstallWrap" hidden');
		expect(home).toContain('id="footInstall"');
		expect(home).not.toMatch(/<dialog id="installDialog"[^>]*\sopen/);
		expect(css).toContain('dialog:not([open])');
		expect(js).toContain('/auth/export');
		expect(js).toContain('jw-install-dismissed');
		expect(js).toContain('footInstallWrap');
	});

	it('gives the location button and distance menus visible labels in four languages', async () => {
		const { home, js } = await clientAssets();
		expect(home).toContain('data-i18n="near_lbl"');
		expect(home).toContain('>Location<');
		expect(home).toContain('data-i18n="near_me"');
		expect(home).toContain('>Around me<');
		expect(home).toContain('for="fRadius"');
		expect(home).toContain('for="bRadiusF"');
		expect(home).toContain('data-i18n="distance"');
		expect(home).toContain('>Within<');
		expect(js).toContain('near_lbl:"Location"');
		expect(js).toContain('near_lbl:"Lieu"');
		expect(js).toContain('near_lbl:"Ort"');
		expect(js).toContain('near_lbl:"Luogo"');
		expect(js).toContain('distance:"Within"');
		expect(js).toContain('distance:"Rayon"');
		expect(js).toContain('distance:"Umkreis"');
		expect(js).toContain('distance:"Raggio"');
		expect(js).toContain('near_me:"Around me"');
		expect(js).toContain('near_me:"Autour de moi"');
		expect(
			js.includes('near_me:"In meiner Nähe"')
			|| js.includes('near_me:"In meiner N\\xE4he"')
			|| js.includes('near_me:"In meiner N\\u00e4he"'),
		).toBe(true);
		expect(js).toContain('near_me:"Vicino a me"');
	});

	it('localizes the German gig-board tab and browse button', async () => {
		const { home, js } = await clientAssets();
		expect(home).toContain('>Gig board<');
		expect(home).toContain('>Browse the board<');
		expect(js).toContain('nav_board:"Auftritte"');
		expect(js).toContain('nav_board_s:"Auftritte"');
		expect(js).toContain('cta_browse:"Auftritte ansehen"');
		expect(js).not.toContain('Gig-Board');
		expect(js).not.toContain('Anzeigen ansehen');
		expect(js).toContain('cta_browse:"Browse the board"');
		expect(js).toContain('cta_browse:"Voir les annonces"');
		expect(js).toContain('cta_browse:"Guarda gli annunci"');
	});

	it('bumps the service worker so the updated shell replaces the cached one', async () => {
		const sw = await get('/sw.js');
		expect(sw.text).toContain("const VERSION = 'jamwerk-v36'");
	});

	it('keeps the same bugs out of /v2', async () => {
		const en = await get('/v2', { 'Accept-Language': 'en' });
		expect(en.text).not.toContain('/auth/export');
		expect(en.text).not.toContain('View my public page');
		expect(en.text).not.toContain('Download my data');
		expect(en.text).not.toMatch(/<dialog id="a2hsDialog"[^>]*\sopen/);
		expect(en.text).toContain('id="memberExtras" hidden');
		expect(en.text).toContain('>Location<');
		expect(en.text).toContain('>Near me<');
		expect(en.text).toContain('>Within<');
		const de = await get('/v2/gigs', { 'Accept-Language': 'de' });
		expect(de.text).toContain('>Auftritte<');
		expect(de.text).not.toContain('Gig-Board');
		expect(de.text).not.toContain('Anzeigen ansehen');
		expect(de.text).toContain('>Umkreis<');
		expect(de.text).toContain('>In meiner Nähe<');
	});
});
