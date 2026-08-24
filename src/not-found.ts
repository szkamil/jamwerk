// src/not-found.ts — friendly 404 for unmatched routes. HTML for browsers,
// JSON for API-style requests. Text in the visitor's language (Accept-Language).
import type { Context } from 'hono';
import type { AppEnv } from './types';
import { pickLang, t } from './i18n';
import { WAVE_SVG } from './ui';

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
  body { margin: 0; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; background: #f6f4fb; color: #14131a; font-family: "Instrument Sans", system-ui, sans-serif; }
  main { flex: 1; display: grid; place-items: center; }
  main > div { max-width: 440px; padding: 40px 28px; text-align: center; }
  footer { background-color: #14131a; background-image: radial-gradient(circle at 12% 130%, rgba(100,64,251,0.34), transparent 58%); color: rgba(255,255,255,0.65); padding: 24px 20px 40px; position: relative; overflow: hidden; z-index: 0; font-size: 13.5px; }
  footer .wave { position: absolute; left: 0; right: 0; bottom: -2px; width: 100%; height: 32px; z-index: -1; opacity: 0.28; }
  footer .inner { max-width: 860px; margin: 0 auto; display: flex; gap: 8px 18px; align-items: center; flex-wrap: wrap; }
  footer .brand { font-weight: 800; font-size: 18px; letter-spacing: -0.4px; color: #fff; text-decoration: none; }
  footer .brand span { color: #a58bff; }
  .code { font-size: 72px; font-weight: 800; letter-spacing: -0.04em; color: #6d4df2; line-height: 1; margin-bottom: 12px; }
  h1 { font-size: 22px; margin: 0 0 10px; }
  p { color: #5b5870; line-height: 1.5; margin: 0 0 24px; }
  a { display: inline-block; background: #6d4df2; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600; }
</style>
</head>
<body>
<main>
  <div>
    <div class="code">404</div>
    <h1>${esc(title)}</h1>
    <p>${esc(body)}</p>
    <a href="/">${esc(back)}</a>
  </div>
</main>
<footer>
  ${WAVE_SVG}
  <div class="inner"><a class="brand" href="/">Jam<span>Werk</span></a><span style="margin-left: auto;">© ${new Date().getFullYear()} JamWerk</span></div>
</footer>
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
