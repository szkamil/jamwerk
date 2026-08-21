// test/cron.spec.ts — the daily housekeeping job.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

describe('Housekeeping cron', () => {
	it('expires stale open listings and leaves live ones alone', async () => {
		await env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES ('cron@example.com', 'x')").run();
		const stale = await env.DB.prepare(
			"INSERT INTO gigs (poster_email, instrument, genres, gig_date, venue_city, fee_chf, description, status, expires_at) VALUES ('cron@example.com', 'bass', '[]', '2026-01-10', 'Bern', 300, 'x', 'open', '2026-01-11')"
		).run();
		const live = await env.DB.prepare(
			"INSERT INTO gigs (poster_email, instrument, genres, gig_date, venue_city, fee_chf, description, status, expires_at) VALUES ('cron@example.com', 'bass', '[]', date('now', '+30 days'), 'Bern', 300, 'x', 'open', date('now', '+31 days'))"
		).run();
		const booked = await env.DB.prepare(
			"INSERT INTO gigs (poster_email, instrument, genres, gig_date, venue_city, fee_chf, description, status, expires_at) VALUES ('cron@example.com', 'bass', '[]', '2026-01-10', 'Bern', 300, 'x', 'booked', '2026-01-11')"
		).run();

		const ctx = createExecutionContext();
		await worker.scheduled({ scheduledTime: Date.now(), cron: '17 3 * * *' } as any, env as any, ctx as any);
		await waitOnExecutionContext(ctx);

		const status = async (id: number | bigint) =>
			(await env.DB.prepare('SELECT status FROM gigs WHERE id = ?').bind(id).first<{ status: string }>())!.status;
		expect(await status(stale.meta.last_row_id)).toBe('expired');
		expect(await status(live.meta.last_row_id)).toBe('open');
		// booked gigs are never auto-expired, even past their date
		expect(await status(booked.meta.last_row_id)).toBe('booked');
	});
});
