// src/email.ts — outbound email via Mailjet.
//
// ACCOUNT NOTE (see README "Email"): the owner has SEVERAL separate Mailjet
// accounts. JamWerk uses its OWN dedicated account — the one linked to
// gigwerk@hotmail.com — NOT the TrustAxis account. The MAILJET_API_KEY /
// MAILJET_SECRET_KEY Worker secrets must be that account's pair; don't mix
// them up. Default sender: notify@jamwerk.app (domain validated + DKIM-signed; displayed as "JamWerk").
// Once the jamwerk.app domain is verified in that account, switch the sender
// via EMAIL_FROM=notify@jamwerk.app for proper DKIM/deliverability.
//
// Degrades gracefully: with no keys configured, sends are skipped and logged.
import { Context } from 'hono';
import { sendPushTo } from './push';
import { Lang, normLang } from './i18n';
import type { AppEnv, Env } from './types';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function sendEmail(env: Env, to: string, subject: string, text: string, opts: { replyTo?: string } = {}): Promise<boolean> {
  const key = env.MAILJET_API_KEY;
  const secret = env.MAILJET_SECRET_KEY;
  const from = env.EMAIL_FROM || 'gigwerk@hotmail.com';
  if (!key || !secret) {
    console.log(`[EMAIL skipped — no Mailjet keys] to=${to} subject=${JSON.stringify(subject)}${opts.replyTo ? ` replyTo=${opts.replyTo}` : ''} body=${JSON.stringify(text)}`);
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
          ...(opts.replyTo ? { ReplyTo: { Email: opts.replyTo } } : {}),
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

/**
 * Fire-and-forget notification (email + web push) in the recipient's language;
 * non-critical best-effort. Pass the recipient's lang when the caller already
 * has it (saves a lookup); otherwise it is read from users.lang.
 */
export function notify(
  c: Context<AppEnv>,
  to: string,
  build: (lang: Lang) => { subject: string; body: string },
  knownLang?: string
) {
  const task = (async () => {
    let lang = normLang(knownLang);
    if (!knownLang) {
      const row = await c.env.DB.prepare('SELECT lang FROM users WHERE email = ?')
        .bind(to).first<{ lang: string }>();
      lang = normLang(row?.lang);
    }
    const { subject, body } = build(lang);
    await Promise.allSettled([
      sendEmail(c.env, to, subject, body),
      sendPushTo(c.env, to, subject, body),
    ]);
  })();
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    // No execution context (some test setups) — the promise still runs.
  }
}
