// test/dm.spec.ts — direct messages between musicians: gates, opt-out, reuse, threads.
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const alice = 'dm-alice@example.com', bob = 'dm-bob@example.com', carol = 'dm-carol@example.com', newbie = 'dm-newbie@example.com';
const cookieFor = (email: string) => `token=${jwt.sign({ email }, (env as any).JWT_SECRET, { expiresIn: '1h' })}`;
async function raw(path: string, opts: { method?: string; as?: string; body?: unknown } = {}) {
	const headers: Record<string, string> = {};
	if (opts.as) headers.Cookie = cookieFor(opts.as);
	if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
	const request = new IncomingRequest(`http://localhost${path}`, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}
async function call(path: string, opts: Parameters<typeof raw>[1] = {}) { const r = await raw(path, opts); return { status: r.status, json: (await r.json()) as any }; }

beforeAll(async () => {
	await env.DB.batch([
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Alice Alto', 1)").bind(alice),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Bob Bass', 1)").bind(bob),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Carol Closed', 1)").bind(carol),
		env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'Nina New', 0)").bind(newbie),
		env.DB.prepare("INSERT OR IGNORE INTO musician_details (owner, instruments, handle, accepts_dm) VALUES (?, '[\"sax\"]', 'alice-alto', 1)").bind(alice),
		env.DB.prepare("INSERT OR IGNORE INTO musician_details (owner, instruments, handle, accepts_dm) VALUES (?, '[\"bass\"]', 'bob-bass', 1)").bind(bob),
		env.DB.prepare("INSERT OR IGNORE INTO musician_details (owner, instruments, handle, accepts_dm) VALUES (?, '[\"drums\"]', 'carol-closed', 0)").bind(carol),
	]);
});

describe('Direct messages', () => {
	it('gates: login, confirmed email, valid handle, not yourself, recipient opt-out', async () => {
		expect((await call('/messages/dm', { method: 'POST', body: { handle: 'bob-bass', message: 'hello there' } })).status).toBe(401);
		const unc = await call('/messages/dm', { method: 'POST', as: newbie, body: { handle: 'bob-bass', message: 'hello there' } });
		expect(unc.status).toBe(403); expect(unc.json.code).toBe('email_unconfirmed');
		expect((await call('/messages/dm', { method: 'POST', as: alice, body: { handle: 'nobody-here', message: 'hello there' } })).status).toBe(404);
		expect((await call('/messages/dm', { method: 'POST', as: alice, body: { handle: 'alice-alto', message: 'hello me' } })).status).toBe(400);
		const closed = await call('/messages/dm', { method: 'POST', as: alice, body: { handle: 'carol-closed', message: 'hello there' } });
		expect(closed.status).toBe(403); expect(closed.json.code).toBe('dm_closed');
	});

	it('opens one thread per pair, visible to both, and reuses it from either side', async () => {
		const a = await call('/messages/dm', { method: 'POST', as: alice, body: { handle: 'bob-bass', message: 'Fancy a jam on Tuesday?' } });
		expect(a.status).toBe(201); expect(a.json.thread_type).toBe('dm'); expect(a.json.counterpart).toBe('Bob Bass');
		const b = await call('/messages/dm', { method: 'POST', as: bob, body: { handle: 'alice-alto', message: 'Sure, 19h at the Usine?' } });
		expect(b.json.thread_id).toBe(a.json.thread_id);
		const aliceThreads = await call('/messages/threads', { as: alice });
		const th = aliceThreads.json.threads.find((t: any) => t.thread_type === 'dm');
		expect(th.counterpart).toBe('Bob Bass'); expect(th.unread).toBe(1); expect(th.context).toBe('');
		const bobThreads = await call('/messages/threads', { as: bob });
		expect(bobThreads.json.threads.find((t: any) => t.thread_type === 'dm').counterpart).toBe('Alice Alto');
		const thread = await call(`/messages/dm/${a.json.thread_id}`, { as: alice });
		expect(thread.json.messages.length).toBe(2);
		expect((await call(`/messages/dm/${a.json.thread_id}`, { method: 'POST', as: bob, body: { body: 'See you there.' } })).status).toBe(201);
		expect((await call(`/messages/dm/${a.json.thread_id}`, { as: carol })).status).toBe(403);
	});

	it('caps new conversations at 3 per day', async () => {
		for (let i = 0; i < 4; i++) {
			const e = `dm-target${i}@example.com`;
			await env.DB.prepare("INSERT OR IGNORE INTO users (email, password_hash, display_name, confirmed) VALUES (?, 'x', 'T', 1)").bind(e).run();
			await env.DB.prepare("INSERT OR IGNORE INTO musician_details (owner, handle) VALUES (?, ?)").bind(e, 'target' + i).run();
		}
		const statuses: number[] = [];
		for (let i = 0; i < 4; i++) statuses.push((await call('/messages/dm', { method: 'POST', as: alice, body: { handle: 'target' + i, message: 'hello number ' + i } })).status);
		expect(statuses).toEqual([201, 201, 201, 429]);
	});

	it('directory exposes accepts_dm/is_me; profile save toggles opt-out; public page shows the button only when open', async () => {
		const dir = await call('/musicians', { as: alice });
		const me = dir.json.musicians.find((m: any) => m.handle === 'alice-alto');
		expect(me.is_me).toBe(true);
		expect(dir.json.musicians.find((m: any) => m.handle === 'carol-closed').accepts_dm).toBe(false);
		const save = await call('/musicians/me', { method: 'POST', as: bob, body: { instruments: ['bass'], genres: ['jazz'], demo_links: [], accepts_dm: false } });
		expect(save.status).toBe(200);
		expect((await call('/musicians/me', { as: bob })).json.accepts_dm).toBe(0);
		expect(await (await raw('/m/alice-alto')).text()).toContain('/?dm=alice-alto');
		expect(await (await raw('/m/bob-bass')).text()).not.toContain('/?dm=bob-bass');
	});
});

describe('Blocking', () => {
	it('blocked user cannot DM, reply or inquire; blocker hides the thread; unblock restores', async () => {
		const a = await call('/messages/dm', { method: 'POST', as: alice, body: { handle: 'bob-bass', message: 'hello bob, jam soon?' } });
		expect(a.status).toBe(201);
		const blk = await call('/messages/block', { method: 'POST', as: bob, body: { thread_type: 'dm', thread_id: a.json.thread_id } });
		expect(blk.json.blocked).toBe(true);
		expect((await call('/messages/blocks', { as: bob })).json.blocks[0].handle).toBe('alice-alto');
		expect((await call(`/messages/dm/${a.json.thread_id}`, { method: 'POST', as: alice, body: { body: 'still there?' } })).json.code).toBe('blocked');
		expect((await call('/messages/dm', { method: 'POST', as: alice, body: { handle: 'bob-bass', message: 'hello again' } })).json.code).toBe('blocked');
		expect((await call('/messages/threads', { as: bob })).json.threads.some((t: any) => t.thread_type === 'dm')).toBe(false);
		expect((await call('/messages/threads', { as: alice })).json.threads.some((t: any) => t.thread_type === 'dm')).toBe(true);
		const band = await call('/bands', { method: 'POST', as: bob, body: { name: 'Bob Band', genres: ['rock'], home_city: 'Bern', bookable: true } });
		expect((await call(`/bands/${band.json.id}/inquire`, { method: 'POST', as: alice, body: { message: 'want to book you please' } })).json.code).toBe('blocked');
		const un = await call('/messages/block', { method: 'POST', as: bob, body: { handle: 'alice-alto', unblock: true } });
		expect(un.json.blocked).toBe(false);
		expect((await call(`/messages/dm/${a.json.thread_id}`, { method: 'POST', as: alice, body: { body: 'phew, thanks' } })).status).toBe(201);
		expect((await call(`/messages/dm/${a.json.thread_id}`, { as: alice })).json.blocked_by_me).toBe(false);
	});
});
