// src/email.ts — outbound email via Mailjet.
//
// ACCOUNT NOTE (see README "Email"): JamWerk deliberately reuses the existing
// TrustAxis Mailjet account for now — same MAILJET_API_KEY / MAILJET_SECRET_KEY
// pair, and the TrustAxis-verified sender outreach@trustaxis.ch (displayed as
// "JamWerk"). When the app gets traction, move to a dedicated Mailjet account:
// new keys, verify the jamwerk.app domain, set EMAIL_FROM=notify@jamwerk.app.
//
// Degrades gracefully: with no keys configured, sends are skipped and logged.
import { Context } from 'hono';
import { sendPushTo } from './push';
import type { AppEnv, Env } from './types';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function sendEmail(env: Env, to: string, subject: string, text: string): Promise<boolean> {
  const key = env.MAILJET_API_KEY;
  const secret = env.MAILJET_SECRET_KEY;
  const from = env.EMAIL_FROM || 'outreach@trustaxis.ch';
  if (!key || !secret) {
    console.log(`[EMAIL skipped — no Mailjet keys] to=${to} subject=${JSON.stringify(subject)} body=${JSON.stringify(text)}`);
    return false;
  }
  try {
    const res = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + btoa(`${key}:${secret}`),
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: from, Name: 'JamWerk' },
          To: [{ Email: to }],
          Subject: subject,
          TextPart: text,
          HTMLPart: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
        }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error('Mailjet send failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Mailjet send error:', err);
    return false;
  }
}

/** Fire-and-forget notification (email + web push); non-critical best-effort. */
export function notify(c: Context<AppEnv>, to: string, subject: string, body: string) {
  const task = Promise.allSettled([
    sendEmail(c.env, to, subject, body),
    sendPushTo(c.env, to, subject, body),
  ]);
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    // No execution context (some test setups) — the promise still runs.
  }
}
