// test/admin.spec.ts — reports, minimal admin, ban gate, export, account deletion.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const adminE = 'admin@example.com', u1 = 'adm-u1@example.com', u2 = 'adm-u2@example.com';
const cookieFor = (email: string) => `token=${jwt.sign({ email }, (env as any).JWT_SECRET, { expiresIn: '1h' })}`;
async function raw(path: string, opts: { method?: string; as?: string; body?: unknown } = {}) {
	const headers: Record<string, string> = {};
	if (opts.as) headers.Cookie = cookieFor(opts.as);
	if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
	const request = new IncomingRequest(`http://localhost${path}`, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
	const ctx = createExecutionContext();
	const r = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return r;
}
async function call(path: string, opts: Parameters<typeof raw>[1] = {}) { const r = await raw(path, opts); return { status: r.status, json: (await r.json().catch(() => ({}))) as any }; }
beforeAll(async () => {
	const bcrypt = await import('bcryptjs');
	const hash = await bcrypt.hash('hunter2hunter2', 4);
	await env.DB.batch([
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Admin', 1)").bind(adminE),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, ?, 'User One', 1)").bind(u1, hash),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'User Two', 1)").bind(u2),
		env.DB.prepare("INSERT OR IGNORE INTO musician_details (owner, instruments, handle) VALUES (?, '[\"bass\"]', 'user-two')").bind(u2),
	]);
});
describe('Reports & admin', () => {
	it('users can report; admin sees stats and reports; non-admins get 404', async () => {
		const gig = await env.DB.prepare("INSERT INTO gigs (poster_email, instrument, genres, gig_date, venue_city, fee_chf, description, expires_at) VALUES (?, 'bass', '[]', '2030-01-01', 'Genève', 100, 'x', '2030-01-02')").bind(u2).run();
		expect((await call('/report', { method: 'POST', as: u1, body: { type: 'gig', id: gig.meta.last_row_id, reason: 'Fake listing' } })).status).toBe(201);
		expect((await call('/report', { method: 'POST', body: { type: 'gig', id: 1, reason: 'x' } })).status).toBe(401);
		expect((await raw('/admin', { as: u1 })).status).toBe(404);
		expect((await raw('/admin')).status).toBe(404);
		const st = await call('/admin/stats', { as: adminE });
		expect(st.status).toBe(200); expect(st.json.reports_open).toBeGreaterThanOrEqual(1);
		const page = await (await raw('/admin', { as: adminE })).text();
		expect(page).toContain('Fake listing');
		expect((await call('/admin/hide-gig', { method: 'POST', as: adminE, body: { id: Number(gig.meta.last_row_id) } })).json.changed).toBe(1);
	});
	it('admin page never puts report data into inline JS, and refuses junk targets', async () => {
		expect((await call('/report', { method: 'POST', as: u1, body: { type: 'user', id: "x'); alert(1); ('", reason: 'xss attempt' } })).status).toBe(400);
		expect((await call('/report', { method: 'POST', as: u1, body: { type: 'gig', id: "1'); alert(1); ('", reason: 'xss attempt' } })).status).toBe(400);
		await env.DB.prepare("INSERT INTO reports (reporter_email, target_type, target_id, reason) VALUES (?, 'user', ?, ?)").bind(u1, "evil'); alert(1); ('@example.com", '<img src=x onerror=alert(1)>').run();
		const page = await (await raw('/admin', { as: adminE })).text();
		expect(page).not.toContain("alert(1); ('@example.com'");
		expect(page).not.toContain('onclick=');
		expect(page).not.toContain('<img src=x');
		expect(page).toContain('data-email="evil');
	});
	it('report a user via a DM thread resolves the counterpart', async () => {
		const dm = await call('/messages/dm', { method: 'POST', as: u1, body: { handle: 'user-two', message: 'hello there friend' } });
		expect(dm.status).toBe(201);
		expect((await call('/report', { method: 'POST', as: u1, body: { type: 'user', thread_type: 'dm', thread_id: dm.json.thread_id, reason: 'Spam messages' } })).status).toBe(201);
		const row = await env.DB.prepare("SELECT target_id FROM reports WHERE reason = 'Spam messages'").first<any>();
		expect(row.target_id).toBe(u2);
	});
	it('ban logs the user out and blocks login; unban restores', async () => {
		expect((await call('/admin/ban', { method: 'POST', as: adminE, body: { email: u2 } })).status).toBe(200);
		expect((await call('/auth/me', { as: u2 })).status).toBe(401);
		const login = await call('/auth/login', { method: 'POST', body: { email: u2, password: 'anything' } });
		expect(login.status).toBe(403); expect(login.json.code).toBe('banned');
		expect((await call('/admin/unban', { method: 'POST', as: adminE, body: { email: u2 } })).status).toBe(200);
		expect((await call('/auth/me', { as: u2 })).status).toBe(200);
	});
	it('export returns my data; deletion needs the password and removes everything', async () => {
		const ex = await raw('/auth/export', { as: u1 });
		expect(ex.status).toBe(200);
		const j = (await ex.json()) as any;
		expect(j.account.email).toBe(u1);
		expect((await call('/auth/account', { method: 'DELETE', as: u1, body: { password: 'wrong' } })).json.code).toBe('bad_password');
		expect((await call('/auth/account', { method: 'DELETE', as: u1, body: { password: 'hunter2hunter2' } })).status).toBe(200);
		expect(await env.DB.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(u1).first()).toBeNull();
		expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE sender_email = ?').bind(u1).first<any>()).toMatchObject({ n: 0 });
	});
	it('cron writes a backup to R2 when the bucket exists', async () => {
		const ctx = createExecutionContext();
		await (worker as any).scheduled({ scheduledTime: Date.now(), cron: '17 3 * * *' }, env, ctx);
		await waitOnExecutionContext(ctx);
		if ((env as any).MEDIA) {
			const list = await (env as any).MEDIA.list({ prefix: 'backups/' });
			expect(list.objects.length).toBeGreaterThan(0);
		}
	});
});
