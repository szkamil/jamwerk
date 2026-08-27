// test/profile-page.spec.ts — public musician pages at /m/:handle.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

async function call(path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}) {
	const headers: Record<string, string> = {};
	if (opts.cookie) headers.Cookie = opts.cookie;
	if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
	const request = new IncomingRequest(`http://localhost${path}`, {
		method: opts.method || 'GET',
		headers,
		body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
	});
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

async function registerAndProfile(email: string, displayName: string) {
	const reg = await call('/auth/register', {
		method: 'POST',
		body: { accept_terms: true, email, password: 'longenough1', display_name: displayName },
	});
	const cookie = (reg.headers.get('set-cookie') || '').split(';')[0];
	const prof = await call('/musicians/me', {
		method: 'POST', cookie,
		body: { instruments: ['bass'], genres: ['jazz'], home_city: 'Bern', level: 'hobby', demo_links: ['https://youtube.com/watch?v=abc'] },
	});
	return ((await prof.json()) as any).handle as string;
}

describe('Public musician pages', () => {
	it('profile save mints a stable handle and the page renders', async () => {
		const handle = await registerAndProfile('luca@example.com', 'Luca Marchetti');
		expect(handle).toMatch(/^luca-marchetti-[a-z0-9-]{4}$/);

		const page = await call(`/m/${handle}`);
		expect(page.status).toBe(200);
		const html = await page.text();
		expect(html).toContain('Luca Marchetti');
		expect(html).toContain('bass');
		expect(html).toContain('youtube.com');
		expect(html).toContain('hobby musician');
		// email is never exposed publicly
		expect(html).not.toContain('luca@example.com');
	});

	it('unknown handles 404', async () => {
		expect((await call('/m/nobody-0000')).status).toBe(404);
		expect((await call('/m/../etc')).status).toBe(404);
	});

	it('escapes user-supplied content', async () => {
		const handle = await registerAndProfile('xss@example.com', 'Evil <script>alert(1)</script>');
		const html = await (await call(`/m/${handle}`)).text();
		expect(html).not.toContain('<script>alert(1)');
		expect(html).toContain('&lt;script&gt;');
	});

	it('shows reviews from completed gigs', async () => {
		const handle = await registerAndProfile('rated@example.com', 'Rated Musician');
		await env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES ('bl@example.com', 'x')").run();
		const gig = await env.DB.prepare(
			"INSERT INTO gigs (poster_email, instrument, genres, gig_date, venue_city, fee_chf, description, status, expires_at) VALUES ('bl@example.com', 'bass', '[]', '2026-09-01', 'Thun', 300, 'x', 'completed', '2026-09-02')"
		).run();
		const booking = await env.DB.prepare(
			"INSERT INTO bookings (gig_id, musician_email, agreed_fee_chf, completed_at) VALUES (?, 'rated@example.com', 300, datetime('now'))"
		).bind(gig.meta.last_row_id).run();
		await env.DB.prepare(
			"INSERT INTO gig_reviews (booking_id, direction, reviewer_email, reviewee_email, rating, comment) VALUES (?, 'poster_to_musician', 'bl@example.com', 'rated@example.com', 5, 'Nailed the whole book.')"
		).bind(booking.meta.last_row_id).run();

		const html = await (await call(`/m/${handle}`)).text();
		expect(html).toContain('★★★★★');
		expect(html).toContain('Nailed the whole book.');
		expect(html).toContain('Thun');
		expect(html).toContain('5 ★');
	});
});
