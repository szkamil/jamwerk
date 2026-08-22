// src/not-found.ts — friendly 404 for unmatched routes. HTML for browsers,
// JSON for API-style requests. Text in the visitor's language (Accept-Language).
import type { Context } from 'hono';
import type { AppEnv } from './types';
import { pickLang, t } from './i18n';

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

export function notFoundPage(lang: ReturnType<typeof pickLang>, message?: string): string {
  const title = t(lang, { en: 'Page not found', fr: 'Page introuvable', de: 'Seite nicht gefunden', it: 'Pagina non trovata' });
  const body = message ?? t(lang, {
    en: 'This link leads nowhere — the listing may have expired or the address is mistyped.',
    fr: 'Ce lien ne mène nulle part — l’annonce a peut-être expiré ou l’adresse est erronée.',
    de: 'Dieser Link führt ins Leere — die Anzeige ist vielleicht abgelaufen oder die Adresse ist falsch.',
    it: 'Questo link non porta da nessuna parte — l’annuncio potrebbe essere scaduto o l’indirizzo è errato.',
  });
  const back = t(lang, { en: 'Back to JamWerk', fr: 'Retour à JamWerk', de: 'Zurück zu JamWerk', it: 'Torna a JamWerk' });
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} — JamWerk</title>
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<meta name="theme-color" content="#14131a">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f4fb; color: #14131a; font-family: "Instrument Sans", system-ui, sans-serif; }
  main { max-width: 440px; padding: 40px 28px; text-align: center; }
  .code { font-size: 72px; font-weight: 800; letter-spacing: -0.04em; color: #6d4df2; line-height: 1; margin-bottom: 12px; }
  h1 { font-size: 22px; margin: 0 0 10px; }
  p { color: #5b5870; line-height: 1.5; margin: 0 0 24px; }
  a { display: inline-block; background: #6d4df2; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600; }
</style>
</head>
<body>
<main>
  <div class="code">404</div>
  <h1>${esc(title)}</h1>
  <p>${esc(body)}</p>
  <a href="/">${esc(back)}</a>
</main>
</body>
</html>`;
}

export function notFound(c: Context<AppEnv>) {
  const accept = c.req.header('Accept') || '';
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return c.json({ error: 'Not found' }, 404);
  }
  return c.html(notFoundPage(pickLang(c.req.header('Accept-Language'))), 404);
}
