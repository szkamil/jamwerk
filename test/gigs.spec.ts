// test/gigs.spec.ts
// JamWerk gig lifecycle. NB: vitest-pool-workers rolls D1 back after each
// `it` (isolated storage), so state written in one test never survives into
// the next — the lifecycle therefore runs as one flow test, and the smaller
// tests each set up exactly what they need.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const poster = 'bandleader@example.com';
const bassist = 'bassist@example.com';
const drummer = 'drummer@example.com';

function cookieFor(email: string): string {
	const token = jwt.sign({ email, user_type: 'seeker' }, (env as any).JWT_SECRET, { expiresIn: '1h' });
	return `token=${token}`;
}

async function call(path: string, opts: { method?: string; as?: string; body?: unknown } = {}) {
	const headers: Record<string, string> = {};
	if (opts.as) headers.Cookie = cookieFor(opts.as);
	if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
	const request = new IncomingRequest(`http://localhost${path}`, {
		method: opts.method || 'GET',
		headers,
		body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
	});
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return { status: response.status, json: (await response.json()) as any };
}

// A date safely in the future regardless of when the suite runs.
const gigDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

const validGig = {
	instrument: 'bass',
	genres: ['jazz'],
	gig_date: gigDate,
	venue_city: 'Bern',
	fee_chf: 300,
	description: 'Wedding gig, two 45min sets, charts provided.',
	requirements: { reads_charts: true },
};

const bassistProfile = {
	instruments: ['bass', 'double_bass'],
	genres: ['jazz', 'funk'],
	reads_charts: true,
	travel_radius_km: 50,
	home_city: 'Bern',
	demo_links: ['https://youtube.com/watch?v=abc'],
};

beforeAll(async () => {
	await env.DB.batch([
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, 'x')").bind(poster),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name) VALUES (?, 'x', 'Luca Marchetti')").bind(bassist),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, 'x')").bind(drummer),
	]);
});

describe('Gig marketplace', () => {
	it('rejects unauthenticated gig creation', async () => {
		const r = await call('/gigs', { method: 'POST', body: {} });
		expect(r.status).toBe(401);
	});

	it('musician profile: create, read back, and validation', async () => {
		const r = await call('/musicians/me', { method: 'POST', as: bassist, body: bassistProfile });
		expect(r.status).toBe(200);
		const me = await call('/musicians/me', { as: bassist });
		expect(me.status).toBe(200);
		expect(me.json.instruments).toEqual(['bass', 'double_bass']);
		expect(me.json.gigs_played).toBe(0);

		const bad = await call('/musicians/me', {
			method: 'POST',
			as: drummer,
			body: { instruments: ['kazoo-orchestra!'], genres: ['rock'] },
		});
		expect(bad.status).toBe(400);
	});

	it('rejects an invalid gig with per-field errors', async () => {
		const bad = await call('/gigs', {
			method: 'POST',
			as: poster,
			body: { instrument: 'bass', genres: [], gig_date: 'not-a-date', venue_city: '', fee_chf: -5, description: '' },
		});
		expect(bad.status).toBe(400);
		expect(bad.json.details.length).toBeGreaterThan(0);
	});

	it('guards: no musician profile, own gig, closed gig, wrong accepter', async () => {
		const created = await call('/gigs', { method: 'POST', as: poster, body: validGig });
		expect(created.status).toBe(201);
		const gigId = created.json.id;

		// applying without a musician profile
		const noProfile = await call(`/gigs/${gigId}/apply`, { method: 'POST', as: drummer, body: {} });
		expect(noProfile.status).toBe(403);

		// poster applying to their own gig
		const own = await call(`/gigs/${gigId}/apply`, { method: 'POST', as: poster, body: {} });
		expect(own.status).toBe(403);

		// non-poster accepting
		await call('/musicians/me', { method: 'POST', as: bassist, body: bassistProfile });
		await call(`/gigs/${gigId}/apply`, { method: 'POST', as: bassist, body: {} });
		const detail = await call(`/gigs/${gigId}`, { as: poster });
		const appId = detail.json.applications[0].id;
		const wrongAccepter = await call(`/gigs/${gigId}/applications/${appId}/accept`, { method: 'POST', as: bassist });
		expect(wrongAccepter.status).toBe(403);

		// reviews before completion
		const early = await call(`/gigs/${gigId}/review`, { method: 'POST', as: poster, body: { rating: 5 } });
		expect(early.status).toBe(409);
	});

	it('runs the full lifecycle: post, feed, apply, accept, complete, review', async () => {
		const created = await call('/gigs', { method: 'POST', as: poster, body: validGig });
		expect(created.status).toBe(201);
		const gigId = created.json.id;

		// visible in the filtered feed, poster identity hidden
		const feed = await call('/gigs?instrument=bass&city=bern');
		const found = feed.json.gigs.find((g: any) => g.id === gigId);
		expect(found).toBeTruthy();
		expect(found.fee_chf).toBe(300);
		expect(found.poster_email).toBeUndefined();

		// bassist applies; duplicate application is a conflict
		await call('/musicians/me', { method: 'POST', as: bassist, body: bassistProfile });
		const applied = await call(`/gigs/${gigId}/apply`, {
			method: 'POST', as: bassist, body: { note: 'I know the repertoire.' },
		});
		expect(applied.status).toBe(201);
		const dup = await call(`/gigs/${gigId}/apply`, { method: 'POST', as: bassist, body: {} });
		expect(dup.status).toBe(409);

		// applications visible to the poster only; name shown, contact hidden until booked
		const asPoster = await call(`/gigs/${gigId}`, { as: poster });
		expect(asPoster.json.applications).toHaveLength(1);
		expect(asPoster.json.applications[0].display_name).toBe('Luca Marchetti');
		expect(asPoster.json.applications[0].musician_email).toBeUndefined();
		expect(asPoster.json.applications[0].avg_rating).toBeNull();
		const asStranger = await call(`/gigs/${gigId}`, { as: drummer });
		expect(asStranger.json.applications).toBeUndefined();

		// accept books the gig
		const appId = asPoster.json.applications[0].id;
		const accepted = await call(`/gigs/${gigId}/applications/${appId}/accept`, { method: 'POST', as: poster });
		expect(accepted.status).toBe(200);
		expect(accepted.json.musician_email).toBe(bassist);

		// contact is revealed on the accepted application
		const afterBooking = await call(`/gigs/${gigId}`, { as: poster });
		expect(afterBooking.json.applications[0].musician_email).toBe(bassist);

		// same application cannot be accepted twice; late applications bounce
		const again = await call(`/gigs/${gigId}/applications/${appId}/accept`, { method: 'POST', as: poster });
		expect(again.status).toBe(404);
		await call('/musicians/me', { method: 'POST', as: drummer, body: { instruments: ['drums'], genres: ['rock'] } });
		const late = await call(`/gigs/${gigId}/apply`, { method: 'POST', as: drummer, body: {} });
		expect(late.status).toBe(409);

		// complete: gig counter increments
		const completed = await call(`/gigs/${gigId}/complete`, { method: 'POST', as: poster });
		expect(completed.status).toBe(200);
		const me = await call('/musicians/me', { as: bassist });
		expect(me.json.gigs_played).toBe(1);

		// two-sided reviews, once each, participants only
		const p = await call(`/gigs/${gigId}/review`, { method: 'POST', as: poster, body: { rating: 5, comment: 'Nailed it.' } });
		expect(p.status).toBe(201);
		const m = await call(`/gigs/${gigId}/review`, { method: 'POST', as: bassist, body: { rating: 4, comment: 'Well organised.' } });
		expect(m.status).toBe(201);
		// the poster's review now shows on the musician's applicant card stats
		const rated = await call(`/gigs/${gigId}`, { as: poster });
		expect(rated.json.applications[0].avg_rating).toBe(5);
		expect(rated.json.applications[0].review_count).toBe(1);

		const dupReview = await call(`/gigs/${gigId}/review`, { method: 'POST', as: poster, body: { rating: 1 } });
		expect(dupReview.status).toBe(409);
		const stranger = await call(`/gigs/${gigId}/review`, { method: 'POST', as: drummer, body: { rating: 3 } });
		expect(stranger.status).toBe(403);

		// completed gigs cannot be cancelled
		const cancel = await call(`/gigs/${gigId}/cancel`, { method: 'POST', as: poster, body: { reason: 'nope' } });
		expect(cancel.status).toBe(409);

		// /gigs/mine reflects both roles
		const mine = await call('/gigs/mine', { as: poster });
		expect(mine.json.posted.some((g: any) => g.id === gigId && g.status === 'completed')).toBe(true);
		const mineMusician = await call('/gigs/mine', { as: bassist });
		const app = mineMusician.json.applications.find((a: any) => a.id === gigId);
		expect(app.application_status).toBe('accepted');
	});

	it('cancelling an open gig works and blocks further actions', async () => {
		const created = await call('/gigs', { method: 'POST', as: poster, body: validGig });
		const gigId = created.json.id;
		const r = await call(`/gigs/${gigId}/cancel`, { method: 'POST', as: poster, body: { reason: 'venue closed' } });
		expect(r.status).toBe(200);
		await call('/musicians/me', { method: 'POST', as: bassist, body: bassistProfile });
		const apply = await call(`/gigs/${gigId}/apply`, { method: 'POST', as: bassist, body: {} });
		expect(apply.status).toBe(409);
	});
});

describe('Practice partners', () => {
	const practiceListing = {
		kind: 'practice',
		instrument: 'drums',
		genres: ['rock'],
		venue_city: 'Bern',
		description: 'Weekly jam, Tuesdays 19:00, rehearsal room near the station.',
	};

	it('rejects a practice listing with a fee, and a paid gig without one', async () => {
		const withFee = await call('/gigs', {
			method: 'POST', as: poster, body: { ...practiceListing, fee_chf: 100 },
		});
		expect(withFee.status).toBe(400);
		const noFee = await call('/gigs', {
			method: 'POST', as: poster, body: { ...validGig, fee_chf: undefined },
		});
		expect(noFee.status).toBe(400);
	});

	it('posts a practice listing without fee or date; it appears only on the practice feed', async () => {
		const created = await call('/gigs', { method: 'POST', as: poster, body: practiceListing });
		expect(created.status).toBe(201);
		const id = created.json.id;

		const practiceFeed = await call('/gigs?kind=practice');
		const found = practiceFeed.json.gigs.find((g: any) => g.id === id);
		expect(found).toBeTruthy();
		expect(found.fee_chf).toBeNull();
		expect(found.gig_date).toBeNull();

		const gigFeed = await call('/gigs');
		expect(gigFeed.json.gigs.find((g: any) => g.id === id)).toBeUndefined();
	});

	it('connects multiple partners, listing stays open; no completion or reviews', async () => {
		const created = await call('/gigs', { method: 'POST', as: poster, body: practiceListing });
		const id = created.json.id;

		await call('/musicians/me', { method: 'POST', as: bassist, body: bassistProfile });
		await call('/musicians/me', { method: 'POST', as: drummer, body: { instruments: ['drums'], genres: ['rock'] } });
		await call(`/gigs/${id}/apply`, { method: 'POST', as: bassist, body: {} });
		await call(`/gigs/${id}/apply`, { method: 'POST', as: drummer, body: {} });

		const detail = await call(`/gigs/${id}`, { as: poster });
		expect(detail.json.applications).toHaveLength(2);
		for (const a of detail.json.applications) {
			const r = await call(`/gigs/${id}/applications/${a.id}/accept`, { method: 'POST', as: poster });
			expect(r.status).toBe(200);
		}

		// both accepted, none declined, listing still open for more partners
		const after = await call(`/gigs/${id}`, { as: poster });
		expect(after.json.status).toBe('open');
		expect(after.json.applications.every((a: any) => a.status === 'accepted')).toBe(true);

		const complete = await call(`/gigs/${id}/complete`, { method: 'POST', as: poster });
		expect(complete.status).toBe(409);
		const review = await call(`/gigs/${id}/review`, { method: 'POST', as: bassist, body: { rating: 5 } });
		expect(review.status).toBe(409);

		// close it; applying afterwards bounces
		const close = await call(`/gigs/${id}/cancel`, { method: 'POST', as: poster, body: {} });
		expect(close.status).toBe(200);
		const late = await call('/musicians/me', { method: 'POST', as: drummer, body: { instruments: ['drums'], genres: ['rock'] } })
			.then(() => call(`/gigs/${id}/apply`, { method: 'POST', as: drummer, body: {} }));
		expect(late.status).toBe(409);
	});
});
