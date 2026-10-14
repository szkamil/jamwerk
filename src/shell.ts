// Turns the SPA template into a small HTML document plus hashed CSS/JS.
// Minified bytes live in src/generated/client-assets.ts (scripts/emit-assets.mjs).
// If that file drifts from src/ui.ts, the worker serves the source instead of
// a stale bundle and logs; tests fail on assetsFresh().
import { PAGE } from './ui';
import { fnv1a } from './fnv';
import { APP_CSS, APP_JS, RAW_CSS_HASH, RAW_JS_HASH } from './generated/client-assets';

const cssMatch = PAGE.match(/<style>([\s\S]*?)<\/style>/);
const jsMatch = PAGE.match(/<script>([\s\S]*?)<\/script>/);
if (!cssMatch || !jsMatch) throw new Error('PAGE is missing a style or script block');

const rawCss = cssMatch[1];
const rawJs = jsMatch[1];

export function assetsFresh(): boolean {
  return fnv1a(rawCss) === RAW_CSS_HASH && fnv1a(rawJs) === RAW_JS_HASH;
}

const fresh = assetsFresh();
if (!fresh) console.error('JamWerk client assets are stale — serving unminified CSS/JS. Run: node scripts/emit-assets.mjs');

const css = fresh ? APP_CSS : rawCss;
const js = fresh ? APP_JS : rawJs;
const cssName = `app.${fnv1a(css)}.css`;
const jsName = `app.${fnv1a(js)}.js`;

const BASE = PAGE
  .replace(/<style>[\s\S]*?<\/style>/, `<link rel="stylesheet" href="/assets/${cssName}">`)
  .replace(/<script>[\s\S]*?<\/script>/, `<script src="/assets/${jsName}" defer></script>`);

export function assetBody(file: string): { body: string; type: string } | null {
  if (file === cssName) return { body: css, type: 'text/css; charset=utf-8' };
  if (file === jsName) return { body: js, type: 'text/javascript; charset=utf-8' };
  return null;
}

const TAB_META: Record<string, { title: string; description: string }> = {
  musicians: {
    title: 'Musicians — JamWerk',
    description: 'Local musicians by instrument and city. Message them inside JamWerk.',
  },
  bands: {
    title: 'Bands — JamWerk',
    description: 'Bands with demos and a starting fee. Filter by genre and city, then message the band.',
  },
  jams: {
    title: 'Jams — JamWerk',
    description: 'Free jam and practice partners near you. No fees, no ratings.',
  },
  board: {
    title: 'Paid dep gigs — JamWerk',
    description: 'A dep is a paid stand-in gig: you cover for another musician for one date, and the fee is shown up front.',
  },
  post: {
    title: 'Post a gig — JamWerk',
    description: 'Post a paid dep gig or a jam. Matching musicians get an alert.',
  },
  msgs: {
    title: 'Messages — JamWerk',
    description: 'Your JamWerk conversations.',
  },
  profile: {
    title: 'Profile — JamWerk',
    description: 'Your JamWerk musician profile.',
  },
};

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function appHtml(opts: {
  tab: string | null;
  authed: boolean;
  geo?: string;
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
}): string {
  let html = BASE;
  if (opts.geo) html = html.replace('<html lang="en">', `<html lang="en" data-geo="${escAttr(opts.geo)}">`);
  if (opts.authed) html = html.replace('<body>', '<body class="authed">');
  if (opts.tab) {
    html = html.replace('<div id="landing">', '<div id="landing" hidden>');
    html = html.replace(`id="tab-${opts.tab}" hidden`, `id="tab-${opts.tab}"`);
    html = html.replace(`<button data-tab="${opts.tab}">`, `<button data-tab="${opts.tab}" class="active">`);
  }
  const meta = opts.tab ? TAB_META[opts.tab] : undefined;
  const title = opts.title || meta?.title;
  const description = opts.description || meta?.description;
  if (title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(title)}</title>`);
    html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escAttr(title)}">`);
  }
  if (description) {
    html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escAttr(description)}">`);
    html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escAttr(description)}">`);
  }
  if (opts.canonical) {
    html = html.replace('href="https://jamwerk.app/"', `href="${escAttr(opts.canonical)}"`);
    html = html.replace('<meta property="og:url" content="https://jamwerk.app/">', `<meta property="og:url" content="${escAttr(opts.canonical)}">`);
  }
  if (opts.robots) html = html.replace('</head>', `<meta name="robots" content="${escAttr(opts.robots)}">\n</head>`);
  return html;
}
