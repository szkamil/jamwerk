// The /v2 preview is opt-in. These checks pin both sides: production HTML
// stays the current shell, and /v2 is a separate noindex document.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';
import { V2_CLIENT } from '../src/v2-client';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function get(path: string, headers: Record<string, string> = {}) {
	const ctx = createExecutionContext();
	const res = await worker.fetch(new IncomingRequest('http://localhost' + path, { headers }), env, ctx);
	await waitOnExecutionContext(ctx);
	return { status: res.status, text: await res.text(), type: res.headers.get('content-type') || '', robots: res.headers.get('x-robots-tag') || '' };
}

describe('v2 preview UI', () => {
	it('parses as a script and does not install the production service worker', () => {
		expect(() => new Function(V2_CLIENT)).not.toThrow();
		expect(V2_CLIENT).not.toContain('serviceWorker.register');
		expect(V2_CLIENT).toContain('loadMusicians');
		expect(V2_CLIENT).toContain('empty_bands_h');
		expect(V2_CLIENT).toContain("show(tabFromLocation())");
	});

	it('leaves the production homepage unchanged', async () => {
		const home = await get('/');
		expect(home.status).toBe(200);
		expect(home.text).toContain('Find a dep. Join a jam. Start a band.');
		expect(home.text).toContain('Gig board');
		expect(home.text).toContain('Create your free profile');
		expect(home.text).toContain('See who');
		expect(home.text).toContain('Browse the board');
		expect(home.text).toContain('Invite via WhatsApp');
		expect(home.text).toContain('manifest.webmanifest');
		expect(home.text).toContain('id="footInstall"');
		expect(home.text).not.toContain('data-v2');
		expect(home.text).not.toContain('name="robots" content="noindex');
		expect(home.text).not.toContain('Find musicians to jam, gig or start a band');
	});

	it('serves /v2 as noindex, with one hero search and no install prompt', async () => {
		const page = await get('/v2', { 'Accept-Language': 'en' });
		expect(page.status).toBe(200);
		expect(page.robots).toContain('noindex');
		expect(page.text).toContain('name="robots" content="noindex, nofollow"');
		expect(page.text).toContain('data-v2="1"');
		expect(page.text).toContain('Find musicians to jam, gig or start a band');
		expect(page.text).toContain('Find musicians near me');
		expect(page.text).toContain('Create free profile');
		expect(page.text).toContain('Just getting started around Lake Geneva');
		expect(page.text).toContain('id="memberExtras" hidden');
		expect(page.text).not.toContain('manifest.webmanifest');
		expect(page.text).not.toContain('apple-mobile-web-app-capable');
		expect(page.text).not.toContain('<dialog id="a2hsDialog" open');
		expect(page.text).not.toContain('/auth/export');
		expect(page.text).not.toContain('Find a dep');
		expect(page.text).toContain('src="/assets/v2.');
		const src = page.text.match(/src="(\/assets\/v2\.[^"]+\.js)"/);
		expect(src).toBeTruthy();
		const asset = await get(src![1]);
		expect(asset.status).toBe(200);
		expect(asset.type).toContain('javascript');
		expect(asset.text).toContain('loadMusicians');
	});

	it('picks Accept-Language, then the v2 cookie, then ?lang=', async () => {
		const de = await get('/v2', { 'Accept-Language': 'de-CH,de;q=0.9,en;q=0.5' });
		expect(de.text).toContain('<html lang="de"');
		expect(de.text).toContain('Finde Musiker:innen zum Jammen, für Auftritte oder eine Band');
		expect(de.text).toContain('>Auftritte<');
		expect(de.text).toContain('Einspringer');
		expect(de.text).not.toMatch(/\bDep\b/);
		expect(de.text).not.toContain('Gig-Board');

		const cookie = await get('/v2', { 'Accept-Language': 'de', Cookie: 'jw-v2-lang=it' });
		expect(cookie.text).toContain('<html lang="it"');
		expect(cookie.text).toContain('Trova musicisti per una jam');

		const query = await get('/v2?lang=fr', { 'Accept-Language': 'de', Cookie: 'jw-v2-lang=it' });
		expect(query.text).toContain('<html lang="fr"');
		expect(query.text).toContain('Trouvez des musiciens pour jammer');
	});

	it('labels distance and location on the musicians page and hides zero counts', async () => {
		const page = await get('/v2/musicians', { 'Accept-Language': 'en' });
		expect(page.text).toContain('name="robots" content="noindex, nofollow"');
		expect(page.text).toContain('data-i18n="distance"');
		expect(page.text).toContain('>Within<');
		expect(page.text).toContain('>Near me<');
		expect(page.text).toContain('data-i18n="location"');
		expect(page.text).toContain('Just launched around Lake Geneva — be the first musician here.');
		expect(page.text).not.toContain('0 listings');
		expect(page.text).not.toContain('>0<');
		const de = await get('/v2/gigs', { 'Accept-Language': 'de' });
		expect(de.text).toContain('>Umkreis<');
		expect(de.text).toContain('>In meiner Nähe<');
		expect(de.text).toContain('Einspringer-Gigs');
	});

	it('renders real musicians and a demo on the homepage, and via the spotlight API', async () => {
		await env.DB.prepare("INSERT INTO users (email, password_hash, display_name) VALUES ('face@example.com', 'x', 'Paskstone')").run();
		await env.DB.prepare(
			`INSERT INTO musician_details (owner, instruments, genres, demo_links, home_city, handle)
			 VALUES ('face@example.com', '["guitar"]', '["rock"]', ?, 'Annecy', 'paskstone')`
		).bind(JSON.stringify(['https://www.youtube.com/watch?v=dQw4w9WgXcQ'])).run();
		const page = await get('/v2');
		expect(page.text).toContain('Paskstone');
		expect(page.text).toContain('Annecy');
		expect(page.text).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
		expect(page.text).not.toContain('id="faces" hidden');
		const api = await get('/v2/api/spotlight');
		expect(api.status).toBe(200);
		expect(api.robots).toContain('noindex');
		const body = JSON.parse(api.text);
		expect(body.musicians[0].name).toBe('Paskstone');
		expect(body.musicians[0].demo.embed).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
		expect(body.musicians[0].instruments).toContain('guitar');
	});

	it('shows alerts, invite and add-to-home-screen only once someone is logged in', async () => {
		const ctx = createExecutionContext();
		const reg = await worker.fetch(new IncomingRequest('http://localhost/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accept_terms: true, email: 'v2member@example.com', password: 'longenough1', display_name: 'Ada' }),
		}), env, ctx);
		await waitOnExecutionContext(ctx);
		expect(reg.status).toBe(201);
		const cookie = (reg.headers.get('set-cookie') || '').split(';')[0];
		const page = await get('/v2', { Cookie: cookie });
		expect(page.text).toContain('id="memberExtras"');
		expect(page.text).not.toContain('id="memberExtras" hidden');
		expect(page.text).toContain('Invite via WhatsApp');
		expect(page.text).toContain('Add to Home Screen');
		expect(page.text).not.toContain('/auth/export');
		expect(page.text).not.toContain('View my public page');
		expect(page.text).not.toContain('<dialog id="a2hsDialog" open');
	});

	it('stays out of the sitemap and robots, and 404s unknown /v2 paths', async () => {
		const robots = await get('/robots.txt');
		expect(robots.text).toContain('Disallow: /m/');
		expect(robots.text).toContain('Disallow: /v2');
		const sm = await get('/sitemap.xml');
		expect(sm.text).toContain('/musicians');
		expect(sm.text).not.toContain('/v2');
		const missing = await get('/v2/nope');
		expect(missing.status).toBe(404);
	});
});
