// src/ratelimit.ts — per-IP fixed-window rate limiting backed by D1.
import { Context } from 'hono';
import type { AppEnv, Env } from './types';

export async function rateLimited(env: Env, ip: string, action: string, max: number, windowMinutes: number): Promise<boolean> {
  const cutoff = `-${windowMinutes} minutes`;
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM rate_limits WHERE ip = ? AND action = ? AND attempted_at > datetime('now', ?)"
  ).bind(ip, action, cutoff).first<{ n: number }>();
  if ((row?.n ?? 0) >= max) return true;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO rate_limits (ip, action) VALUES (?, ?)').bind(ip, action),
    env.DB.prepare("DELETE FROM rate_limits WHERE ip = ? AND action = ? AND attempted_at < datetime('now', '-1 day')").bind(ip, action),
  ]);
  return false;
}

export function clientIp(c: Context<AppEnv>): string {
  return c.req.header('CF-Connecting-IP') || 'unknown';
}
