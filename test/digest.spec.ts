import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { sendWeeklyDigests } from '../src/digest';
describe('Weekly digest', () => {
	it('mails located users without push when something new is nearby, once per week', async () => {
		await env.DB.batch([
			env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed, lang) VALUES ('dg@example.com', 'x', 'Dee', 1, 'fr')"),
			env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash) VALUES ('poster@example.com', 'x')"),
			env.DB.prepare("INSERT OR IGNORE INTO musician_details (owner, instruments, handle, home_city, home_lat, home_lng, travel_radius_km) VALUES ('dg@example.com', '[\"bass\"]', 'dee', 'Genève', 46.2044, 6.1432, 30)"),
			env.DB.prepare("INSERT INTO gigs (poster_email, kind, instrument, genres, gig_date, venue_city, venue_lat, venue_lng, fee_chf, description, expires_at) VALUES ('poster@example.com', 'gig', 'bass', '[]', '2030-01-01', 'Carouge', 46.18, 6.14, 300, 'x', '2030-01-02')"),
		]);
		expect(await sendWeeklyDigests(env as any, { force: false, now: new Date('2026-08-25T03:17:00Z') })).toBe(0); // Tuesday → nothing
		const n = await sendWeeklyDigests(env as any, { force: true });
		// sendEmail returns false without Mailjet keys, so count is 0, but the marker must be set exactly for the eligible user
		expect(n).toBe(0);
		const row = await env.DB.prepare("SELECT digest_sent_at FROM users WHERE email = 'dg@example.com'").first<any>();
		expect(row.digest_sent_at).toBeTruthy();
		expect((await env.DB.prepare("SELECT digest_sent_at FROM users WHERE email = 'poster@example.com'").first<any>()).digest_sent_at).toBeNull();
		// second run within the week: skipped (marker unchanged)
		await sendWeeklyDigests(env as any, { force: true });
		expect((await env.DB.prepare("SELECT digest_sent_at FROM users WHERE email = 'dg@example.com'").first<any>()).digest_sent_at).toBe(row.digest_sent_at);
	});
});
