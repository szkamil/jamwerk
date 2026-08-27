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

const FOOT = {
  en: { tag: 'gigs · jams · bands', why: 'You receive this e-mail because you have an account on jamwerk.app. Alerts can be managed in the app (Profile › Alerts).', open: 'Open JamWerk', confirm: 'Confirm my e-mail address', reset: 'Choose a new password', about: 'About' },
  fr: { tag: 'concerts · jams · groupes', why: 'Vous recevez cet e-mail parce que vous avez un compte sur jamwerk.app. Les alertes se gèrent dans l’app (Profil › Alertes).', open: 'Ouvrir JamWerk', confirm: 'Confirmer mon adresse e-mail', reset: 'Choisir un nouveau mot de passe', about: 'À propos' },
  de: { tag: 'Gigs · Jams · Bands', why: 'Du erhältst diese E-Mail, weil du ein Konto auf jamwerk.app hast. Alerts verwaltest du in der App (Profil › Alerts).', open: 'JamWerk öffnen', confirm: 'E-Mail-Adresse bestätigen', reset: 'Neues Passwort wählen', about: 'Über uns' },
  it: { tag: 'concerti · jam · band', why: 'Ricevi questa e-mail perché hai un account su jamwerk.app. Gli avvisi si gestiscono nell’app (Profilo › Avvisi).', open: 'Apri JamWerk', confirm: 'Conferma il mio indirizzo e-mail', reset: 'Scegli una nuova password', about: 'Chi siamo' },
} as const;

/**
 * Branded HTML for every e-mail: ink header with the wordmark, paper background,
 * one card with the message, a violet button for the first link in the text,
 * and a quiet footer. Table layout + inline styles so mail clients behave.
 */
export function renderEmail(subject: string, text: string, lang: Lang = 'en'): string {
  const f = FOOT[lang] || FOOT.en;
  const urlMatch = text.match(/https?:\/\/[^\s<>"]+/);
  const url = urlMatch ? urlMatch[0] : 'https://jamwerk.app';
  const label = /[?&]confirm=|\/confirm/.test(url) ? f.confirm : /[?&]reset=/.test(url) ? f.reset : f.open;
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => p === url ? '' : escapeHtml(p).replace(escapeHtml(url), `<a href="${escapeHtml(url)}" style="color:#4f30d8;">${escapeHtml(url)}</a>`).replace(/\n/g, '<br>'))
    .filter(Boolean)
    .map((p) => `<p style="font-family:'Instrument Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;margin:0 0 14px;font-size:16px;line-height:1.55;color:#1b1a16;">${p}</p>`).join('');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f2ec;font-family:'Instrument Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f2ec;"><tr><td align="center" style="padding:20px 12px 32px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
  <tr><td style="background:#14131a;border-radius:16px 16px 0 0;padding:20px 24px 16px;">
    <span style="font-family:'Bricolage Grotesque','Avenir Next Condensed',Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">Jam<span style="color:#a58bff;">Werk</span></span>
    <span style="font-family:'Instrument Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;display:block;font-size:12.5px;color:rgba(255,255,255,0.6);margin-top:2px;">${f.tag}</span>
  </td></tr>
  <tr><td style="height:4px;background:#6440fb;background-image:linear-gradient(90deg,#6440fb,#a58bff 60%,#6440fb);font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="background:#fffdf8;border:1px solid #e5e1d8;border-top:0;border-radius:0 0 16px 16px;padding:24px 24px 22px;">
    <h1 style="margin:0 0 14px;font-family:'Bricolage Grotesque','Avenir Next Condensed',Helvetica,Arial,sans-serif;font-size:21px;line-height:1.3;font-weight:800;letter-spacing:-0.3px;color:#14131a;">${escapeHtml(subject)}</h1>
    ${paragraphs}
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 4px;"><tr><td style="background:#6440fb;border-radius:10px;">
      <a href="${escapeHtml(url)}" style="font-family:'Instrument Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;display:inline-block;padding:13px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${label} &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="font-family:'Instrument Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;padding:16px 10px 0;font-size:12px;line-height:1.5;color:#6f6c64;text-align:center;">
    ${f.why}<br>
    <a href="https://jamwerk.app/about" style="color:#6f6c64;">${f.about}</a> &nbsp;·&nbsp; © ${new Date().getFullYear()} JamWerk
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function sendEmail(env: Env, to: string, subject: string, text: string, opts: { replyTo?: string; lang?: Lang } = {}): Promise<boolean> {
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
          HTMLPart: renderEmail(subject, text, opts.lang || 'en'),
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
/** Same as notify() but without a request context — for cron jobs. Returns the promise. */
export async function notifyEnv(env: Env, to: string, build: (lang: Lang) => { subject: string; body: string }, knownLang?: string): Promise<void> {
  let lang = normLang(knownLang);
  if (!knownLang) {
    const row = await env.DB.prepare('SELECT lang FROM users WHERE email = ?').bind(to).first<{ lang: string }>();
    lang = normLang(row?.lang);
  }
  const { subject, body } = build(lang);
  await Promise.allSettled([
    sendEmail(env, to, subject, body, { lang }),
    sendPushTo(env, to, subject, body),
  ]);
}

export function notify(
  c: Context<AppEnv>,
  to: string,
  build: (lang: Lang) => { subject: string; body: string },
  knownLang?: string
) {
  const task = notifyEnv(c.env, to, build, knownLang);
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    // No execution context (some test setups) — the promise still runs.
  }
}
