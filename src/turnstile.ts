// src/turnstile.ts — Cloudflare Turnstile server-side verification.
//
// The "jamwerk.app forms" widget (managed mode) was created via the Cloudflare
// API; its public sitekey is hardcoded in src/ui.ts and its secret lives as
// the TURNSTILE_SECRET_KEY Worker secret. Protects /auth/register and
// /feedback. With no secret configured (tests, local dev) verification is
// skipped; if the siteverify service itself is unreachable we fail open —
// the per-IP rate limits still apply either way.
import type { Env } from './types';

export async function turnstileOk(env: Env, token: unknown, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (typeof token !== 'string' || !token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return true;
  }
}
