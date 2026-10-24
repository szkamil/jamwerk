// Opt-in preview UI at /v2. The production shell (src/ui.ts, src/shell.ts)
// is not used here. Document routes are noindex and omitted from the sitemap.
import { Hono, Context } from 'hono';
import { FONT_FACE_CSS, FONT_PRELOAD } from './font-face';
import { NOTES_LAYER, WAVE_SVG } from './ui';
import { MEDIA_CSS, classifyMedia, mediaHtml, type Media } from './media';
import { GENRES, GENRE_LABELS } from './genres';
import { pickLang, type Lang } from './i18n';
import { fnv1a } from './fnv';
import { notFound } from './not-found';
import type { AppEnv } from './types';
import { V2_CLIENT } from './v2-client';
import { V2_COPY, V2_INSTRUMENTS } from './v2-copy';

const TURNSTILE_SITEKEY = '0x4AAAAAAEYYdK6F0t8OOUQr';
const RADII = [5, 10, 15, 25, 50, 75, 100];
const EMBED_OK = ['https://www.youtube-nocookie.com/', 'https://player.vimeo.com/', 'https://open.spotify.com/', 'https://w.soundcloud.com/'];

export const V2_JS_NAME = `v2.${fnv1a(V2_CLIENT)}.js`;

export function v2Asset(file: string): { body: string; type: string } | null {
  if (file === V2_JS_NAME) return { body: V2_CLIENT, type: 'text/javascript; charset=utf-8' };
  return null;
}

export type V2Tab = 'home' | 'musicians' | 'bands' | 'jams' | 'gigs';

export type Face = {
  handle: string;
  name: string;
  photo: string | null;
  initials: string;
  instruments: string[];
  city: string | null;
  demo: { url: string; kind: string; embed?: string; height?: number; host: string } | null;
};

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}

function initials(name: string): string {
  const s = name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase();
  return s || '?';
}

function safePhoto(key: unknown): string | null {
  return typeof key === 'string' && /^(avatars|covers)\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key) ? `/img/${key}` : null;
}

export async function loadSpotlight(db: D1Database): Promise<Face[]> {
  const { results } = await db.prepare(
    `SELECT m.handle, m.instruments, m.home_city, m.demo_links, u.display_name, u.photo_key
     FROM musician_details m JOIN users u ON u.email = m.owner
     WHERE m.handle IS NOT NULL AND IFNULL(u.banned, 0) = 0
     ORDER BY CASE WHEN m.demo_links IS NOT NULL AND m.demo_links NOT IN ('', '[]') THEN 0 ELSE 1 END,
              u.created_at DESC
     LIMIT 8`
  ).all();
  return (results as Record<string, unknown>[]).map((r) => {
    let instruments: string[] = [];
    let links: unknown[] = [];
    try { instruments = JSON.parse(String(r.instruments || '[]')); } catch { instruments = []; }
    try { links = JSON.parse(String(r.demo_links || '[]')); } catch { links = []; }
    const demo = links.map((l) => (typeof l === 'string' ? classifyMedia(l) : null)).find((m): m is Media => !!m) || null;
    const name = String(r.display_name || '');
    return {
      handle: String(r.handle || ''),
      name,
      photo: safePhoto(r.photo_key),
      initials: initials(name),
      instruments: Array.isArray(instruments) ? instruments.filter((x) => typeof x === 'string') : [],
      city: r.home_city ? String(r.home_city) : null,
      demo: demo ? { url: demo.url, kind: demo.kind, embed: demo.embed, height: demo.height, host: demo.host } : null,
    };
  });
}

function instOptions(lang: Lang, selected: string): string {
  const all = `<option value="">${esc(V2_COPY[lang].all_instruments)}</option>`;
  const rest = V2_INSTRUMENTS.map((i) => `<option value="${esc(i.id)}"${i.id === selected ? ' selected' : ''}>${esc(i[lang])}</option>`).join('');
  return all + rest;
}

function radiusOptions(selected: string): string {
  const sel = RADII.some((n) => String(n) === selected) ? selected : '50';
  return RADII.map((n) => `<option value="${n}"${String(n) === sel ? ' selected' : ''}>${n} km</option>`).join('');
}

function genreOptions(lang: Lang, selected: string): string {
  const all = `<option value="">${esc(V2_COPY[lang].all_genres)}</option>`;
  const rest = GENRES.map((id) => `<option value="${esc(id)}"${id === selected ? ' selected' : ''}>${esc(GENRE_LABELS[id][lang])}</option>`).join('');
  return all + rest;
}

function facesHtml(faces: Face[], lang: Lang): string {
  return faces.map((f) => {
    const inst = f.instruments.map((id) => V2_INSTRUMENTS.find((i) => i.id === id)?.[lang] || id).join(', ');
    const meta = [inst, f.city || ''].filter(Boolean).join(' · ');
    const av = f.photo
      ? `<span class="avatar"><img src="${esc(f.photo)}" alt=""></span>`
      : `<span class="avatar">${esc(f.initials)}</span>`;
    return `<a class="face" href="/m/${encodeURIComponent(f.handle)}">${av}<span class="who"><strong>${esc(f.name)}</strong><span class="meta">${esc(meta)}</span></span></a>`;
  }).join('');
}

function soundHtml(faces: Face[], listenLabel: string, noDemo: string): string {
  const withDemo = faces.filter((f) => f.demo).slice(0, 2);
  if (!withDemo.length) return faces.length ? `<p class="muted demo-missing">${esc(noDemo)}</p>` : '';
  return withDemo.map((f) => {
    const cap = `${listenLabel} — ${f.name}${f.city ? ' · ' + f.city : ''}`;
    const demo = f.demo!;
    const embed = demo.embed && EMBED_OK.some((p) => demo.embed!.startsWith(p)) ? demo.embed : '';
    const body = embed
      ? mediaHtml({ url: demo.url, kind: demo.kind as Media['kind'], embed, height: demo.height, host: demo.host })
      : `<a class="more" href="${esc(demo.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(demo.host)}</a>`;
    return `<div class="sound"><p class="sound-cap">${esc(cap)}</p>${body}</div>`;
  }).join('');
}

function locFields(prefix: string, cityLabel: string, cityPh: string, city: string, lat: string, lng: string): string {
  return `<div class="field grow">
    <label for="${prefix}City" data-i18n="city">${esc(cityLabel)}</label>
    <input id="${prefix}City" name="city" value="${esc(city)}" autocomplete="off" placeholder="${esc(cityPh)}" data-i18n-ph="city_ph">
    <input type="hidden" id="${prefix}Lat" name="lat" value="${esc(lat)}">
    <input type="hidden" id="${prefix}Lng" name="lng" value="${esc(lng)}">
  </div>`;
}

function nearField(prefix: string, location: string, near: string): string {
  return `<div class="field">
    <span class="lbl" id="${prefix}NearLbl" data-i18n="location">${esc(location)}</span>
    <button type="button" class="near" id="${prefix}Near" aria-labelledby="${prefix}NearLbl"><span aria-hidden="true">📍</span> <span data-i18n="near_me">${esc(near)}</span></button>
  </div>`;
}

function distanceField(prefix: string, distance: string, radius: string): string {
  return `<div class="field">
    <label for="${prefix}Radius" data-i18n="distance">${esc(distance)}</label>
    <select id="${prefix}Radius" name="radius_km" aria-label="${esc(distance)}">${radiusOptions(radius)}</select>
  </div>`;
}

const CSS = `
  ${FONT_FACE_CSS}
  ${MEDIA_CSS}
  :root {
    --ink: #14131a; --paper: #f4f2ec; --card: #fffdf8; --line: #e5e1d8;
    --accent: #6440fb; --accent-deep: #4f30d8; --accent-light: #a58bff;
    --accent-tint: #efeaff; --accent-tint-line: #d8cdfd; --muted: #3e3c36; --r: 14px;
  }
  [hidden] { display: none !important; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.5 'Instrument Sans', system-ui, sans-serif; background: var(--paper); color: #1b1a16; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; }
  #bgnotes { position: fixed; inset: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.085; pointer-events: none; }
  a { color: var(--accent-deep); }
  header {
    background-color: var(--ink);
    background-image: radial-gradient(circle at 88% -12%, rgba(100,64,251,0.34), transparent 58%);
    color: #fff; padding: 14px 20px 16px; display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap;
    position: relative; z-index: 2; overflow: hidden;
  }
  header .wave { position: absolute; left: 0; right: 0; bottom: -2px; width: 100%; height: 32px; z-index: -1; opacity: 0.28; }
  .logo { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-size: 25px; font-weight: 800; letter-spacing: -0.5px; color: #fff; text-decoration: none; }
  .logo span { color: var(--accent-light); }
  .v2tag { font-size: 12px; font-weight: 800; letter-spacing: 0.04em; background: var(--accent); color: #fff; border-radius: 999px; padding: 3px 8px; }
  header .spacer { flex: 1; }
  .langswitch { display: flex; align-items: center; gap: 8px; }
  .langswitch .lbl { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.72); }
  .langs { display: flex; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.28); border-radius: 999px; padding: 3px; gap: 2px; }
  .langs button { border: 0; background: transparent; color: #fff; font: inherit; font-weight: 800; font-size: 14px; min-width: 44px; min-height: 40px; border-radius: 999px; cursor: pointer; }
  .langs button[aria-pressed="true"] { background: #fff; color: var(--ink); }
  .langs button:focus-visible, button:focus-visible, a:focus-visible, select:focus-visible, input:focus-visible { outline: 3px solid var(--accent-light); outline-offset: 2px; }
  header .ghost, .textbtn {
    background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.4); border-radius: 10px;
    min-height: 40px; padding: 8px 12px; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer;
  }
  nav.tabs { display: flex; gap: 6px; padding: 14px 20px 0; max-width: 920px; margin: 0 auto; flex-wrap: wrap; }
  nav.tabs button { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 9px 16px; font: inherit; font-size: 15px; font-weight: 650; cursor: pointer; min-height: 44px; color: inherit; }
  nav.tabs button.active { background: var(--ink); color: #fff; border-color: var(--ink); }
  main { flex: 1 0 auto; width: min(920px, calc(100% - 28px)); margin: 16px auto 32px; }
  .display { font-family: 'Bricolage Grotesque', system-ui, sans-serif; }
  .hero {
    background-color: var(--ink);
    background-image: radial-gradient(circle at 85% -20%, rgba(100,64,251,0.45), transparent 60%);
    color: #fff; border-radius: 18px; padding: 28px 22px 26px; position: relative; overflow: hidden; margin-bottom: 12px;
  }
  .hero .wave { position: absolute; left: 0; right: 0; top: 0; width: 100%; height: 36px; opacity: 0.35; }
  .hero h1 { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-size: 34px; line-height: 1.12; letter-spacing: -0.6px; font-weight: 800; margin: 28px 0 10px; }
  .hero .sub { margin: 0 0 18px; color: rgba(255,255,255,0.82); font-size: 17px; max-width: 40rem; }
  .hero-form, .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
  .field { position: relative; display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
  .field.grow { flex: 1 1 180px; }
  .field label, .field .lbl, .row label { font-size: 13px; font-weight: 700; }
  .hero .field label, .hero .field .lbl { color: rgba(255,255,255,0.8); }
  input, select, textarea {
    font: inherit; color: inherit; background: #fff; border: 1px solid var(--line); border-radius: 10px;
    padding: 10px 12px; min-height: 44px; width: 100%;
  }
  .hero input, .hero select { color: #1b1a16; }
  button.near {
    display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 8px 12px; border-radius: 10px;
    border: 1px solid var(--line); background: #fff; color: #1b1a16; font: inherit; font-weight: 700; cursor: pointer; white-space: nowrap;
  }
  .hero button.near { border-color: transparent; }
  button.primary, a.primary {
    display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; border: 0; border-radius: 12px;
    min-height: 48px; padding: 12px 18px; font: inherit; font-weight: 800; text-decoration: none; cursor: pointer;
  }
  button.primary:hover, a.primary:hover { background: var(--accent-deep); }
  .hero-form > .primary { flex: 1 1 100%; margin-top: 4px; }
  .textlink { background: none; border: 0; padding: 0; font: inherit; color: #fff; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .intro .textlink, .card .textlink { color: var(--accent-deep); }
  .hero-side { display: flex; flex-wrap: wrap; gap: 12px 18px; align-items: center; margin-top: 14px; }
  .free { margin: 14px 0 0; font-weight: 700; }
  .loc { min-height: 0; margin: 8px 0 0; font-size: 13.5px; color: var(--muted); }
  .hero .loc { color: rgba(255,255,255,0.8); }
  .loc:empty { display: none; }
  .region, .note { background: var(--accent-tint); border: 1px solid var(--accent-tint-line); color: #2a2148; border-radius: 14px; padding: 12px 14px; margin: 0 0 12px; font-weight: 650; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 16px 16px 18px; margin: 0 0 12px; box-shadow: 0 1px 2px rgba(20,19,26,0.04); }
  .card h2, .intro h1, .subhead { font-family: 'Bricolage Grotesque', system-ui, sans-serif; letter-spacing: -0.3px; margin: 0 0 6px; }
  .intro h1 { font-size: 28px; }
  .muted { color: var(--muted); }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  .card p { margin: 0 0 12px; }
  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .steps li { display: flex; gap: 12px; align-items: flex-start; }
  .num { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; }
  .faces { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
  .face, .person { display: flex; gap: 12px; align-items: center; text-decoration: none; color: inherit; }
  .face { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px; }
  .face:hover, .person:hover strong { color: var(--accent-deep); }
  .avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; overflow: hidden; flex-shrink: 0; }
  .avatar img, img.cover { width: 100%; height: 100%; object-fit: cover; display: block; }
  img.cover { border-radius: 12px; max-height: 180px; margin-bottom: 10px; }
  .who { display: flex; flex-direction: column; min-width: 0; }
  .who strong, .card h3 { font-size: 17px; }
  .card h3 { margin: 0 0 4px; }
  .card h3 a { color: inherit; text-decoration: none; }
  .meta { color: var(--muted); font-size: 14px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chip { background: var(--paper); border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; font-size: 12.5px; color: var(--muted); }
  .chip.hot { background: var(--accent-tint); border-color: var(--accent-tint-line); color: var(--accent-deep); font-weight: 700; }
  .suggest { position: absolute; z-index: 6; top: calc(100% + 4px); left: 0; right: 0; background: #fff; color: #1b1a16; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 10px 28px rgba(20,19,26,0.14); overflow: auto; max-height: 240px; }
  .suggest button { display: block; width: 100%; text-align: left; background: #fff; border: 0; border-bottom: 1px solid var(--line); padding: 10px 12px; font: inherit; cursor: pointer; }
  .suggest button:hover { background: var(--accent-tint); }
  .seg { display: flex; gap: 6px; flex-wrap: wrap; }
  .seg button { border: 1px solid var(--line); background: #fff; border-radius: 999px; min-height: 40px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; }
  .seg button.active { background: var(--ink); color: #fff; border-color: var(--ink); }
  .empty-card { text-align: center; padding: 28px 18px; }
  .empty-card h2 { font-size: 24px; margin: 0 0 8px; }
  .more { font-weight: 700; }
  .sound { margin-top: 12px; }
  .sound-cap { margin: 0 0 6px; font-weight: 700; }
  .filters { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px; margin-bottom: 12px; }
  .flash { border-radius: 12px; padding: 12px 14px; margin: 0 0 12px; }
  .flash.ok { background: #e5f6ee; color: #0a7d4f; }
  .msg { border-radius: 10px; padding: 8px 10px; margin: 0 0 10px; }
  .msg:empty { display: none; }
  .msg.err { background: #fde8e6; color: #b3261e; }
  .msg.ok { background: #e5f6ee; color: #0a7d4f; }
  .row { margin-bottom: 10px; }
  dialog { border: 0; border-radius: 16px; padding: 22px; max-width: 460px; width: calc(100% - 28px); background: var(--card); color: inherit; }
  dialog::backdrop { background: rgba(20,19,26,0.55); }
  dialog h2 { font-family: 'Bricolage Grotesque', system-ui, sans-serif; margin: 0 0 12px; }
  .dlg-x { position: absolute; top: 10px; right: 10px; border: 0; background: transparent; font-size: 26px; line-height: 1; cursor: pointer; color: inherit; }
  dialog { position: relative; }
  dialog ol { margin: 0 0 12px; padding-left: 18px; }
  footer { flex-shrink: 0; background-color: var(--ink); background-image: radial-gradient(circle at 12% 130%, rgba(100,64,251,0.34), transparent 58%); color: rgba(255,255,255,0.72); padding: 22px 20px 32px; position: relative; overflow: hidden; font-size: 14px; }
  footer .wave { position: absolute; left: 0; right: 0; bottom: -2px; width: 100%; height: 32px; z-index: -1; opacity: 0.28; }
  footer .inner { max-width: 920px; margin: 0 auto; display: flex; gap: 8px 18px; align-items: center; flex-wrap: wrap; }
  footer a, footer button { color: rgba(255,255,255,0.84); background: none; border: 0; padding: 0; font: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  footer .brand { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-size: 18px; font-weight: 800; color: #fff; text-decoration: none; }
  footer .brand span { color: var(--accent-light); }
  footer .copy { margin-left: auto; }
  @media (max-width: 720px) {
    .hero h1 { font-size: 28px; }
    .grid2 { grid-template-columns: 1fr; }
    header .spacer, header a.ghost { display: none; }
    .langswitch .lbl { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    nav.tabs { padding-left: 14px; padding-right: 14px; }
    nav.tabs button { flex: 1 1 auto; text-align: center; }
    .hero-form .primary, .filters .primary { flex: 1 1 100%; }
    footer .copy { margin-left: 0; flex-basis: 100%; }
  }
`;

export function renderV2Page(opts: {
  lang: Lang;
  tab: V2Tab;
  authed: boolean;
  q: Record<string, string>;
  faces: Face[];
  base: string;
}): string {
  const lang = opts.lang;
  const t = V2_COPY[lang];
  const tab = opts.tab;
  const q = opts.q;
  const titles: Record<V2Tab, string> = {
    home: t.title_home, musicians: t.title_musicians, bands: t.title_bands, jams: t.title_jams, gigs: t.title_gigs,
  };
  const canonPath: Record<V2Tab, string> = { home: '/', musicians: '/musicians', bands: '/bands', jams: '/jams', gigs: '/gigs' };
  const boot = {
    lang,
    tab,
    authed: opts.authed,
    turnstile: TURNSTILE_SITEKEY,
    copy: V2_COPY,
    instruments: V2_INSTRUMENTS,
    genres: GENRES.map((id) => ({ id, ...GENRE_LABELS[id] })),
  };
  const bootJson = JSON.stringify(boot).replace(/</g, '\\u003c');
  const city = q.city || '';
  const lat = q.lat || '';
  const lng = q.lng || '';
  const radius = q.radius_km || '50';
  const instrument = q.instrument || '';
  const genre = q.genre || '';
  const bookable = q.bookable === '1';
  const on = (name: V2Tab) => (tab === name ? '' : ' hidden');
  const pressed = (code: Lang) => code === lang ? 'true' : 'false';
  const searchBtn = `<button class="primary" type="submit"><span data-i18n="search">${esc(t.search)}</span></button>`;
  const instField = (prefix: string, selected: string) => `<div class="field">
    <label for="${prefix}Inst" data-i18n="instrument">${esc(t.instrument)}</label>
    <select class="inst" id="${prefix}Inst" name="instrument">${instOptions(lang, selected)}</select>
  </div>`;

  return `<!doctype html>
<html lang="${lang}" data-v2="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(titles[tab])}</title>
<meta name="description" content="${esc(t.desc_home)}">
<link rel="canonical" href="${esc(opts.base + canonPath[tab])}">
${FONT_PRELOAD}
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<meta name="theme-color" content="#14131a">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>
<script src="/assets/${V2_JS_NAME}" defer></script>
<style>${CSS}</style>
</head>
<body>
${NOTES_LAYER}
<header>
  ${WAVE_SVG}
  <a class="logo" id="logoHome" href="/v2">Jam<span>Werk</span></a>
  <span class="v2tag">v2</span>
  <span class="spacer"></span>
  <div class="langswitch">
    <span class="lbl" id="langLbl" data-i18n="language">${esc(t.language)}</span>
    <div class="langs" id="langs" role="group" aria-labelledby="langLbl">
      <button type="button" data-lang="en" aria-pressed="${pressed('en')}">EN</button>
      <button type="button" data-lang="fr" aria-pressed="${pressed('fr')}">FR</button>
      <button type="button" data-lang="de" aria-pressed="${pressed('de')}">DE</button>
      <button type="button" data-lang="it" aria-pressed="${pressed('it')}">IT</button>
    </div>
  </div>
  <a class="ghost" href="/" data-i18n="current_site">${esc(t.current_site)}</a>
  <button type="button" class="ghost" id="authBtn">${esc(opts.authed ? t.logout : t.login)}</button>
</header>
<nav class="tabs" aria-label="JamWerk">
  <button type="button" data-go="musicians"${tab === 'musicians' ? ' class="active" aria-current="page"' : ''} data-i18n="nav_musicians">${esc(t.nav_musicians)}</button>
  <button type="button" data-go="bands"${tab === 'bands' ? ' class="active" aria-current="page"' : ''} data-i18n="nav_bands">${esc(t.nav_bands)}</button>
  <button type="button" data-go="jams"${tab === 'jams' ? ' class="active" aria-current="page"' : ''} data-i18n="nav_jams">${esc(t.nav_jams)}</button>
  <button type="button" data-go="gigs"${tab === 'gigs' ? ' class="active" aria-current="page"' : ''} data-i18n="nav_gigs">${esc(t.nav_gigs)}</button>
</nav>
<main>
  <div id="flash" class="flash" hidden></div>
  <div id="page-home"${on('home')}>
    <section class="hero">
      ${WAVE_SVG}
      <h1 class="display" data-i18n="hero_h">${esc(t.hero_h)}</h1>
      <p class="sub" data-i18n="hero_sub">${esc(t.hero_sub)}</p>
      <form id="heroSearch" class="hero-form" action="/v2/musicians" method="get">
        ${instField('h', '')}
        ${locFields('h', t.city, t.city_ph, '', '', '')}
        ${nearField('h', t.location, t.near_me)}
        ${distanceField('h', t.distance, '50')}
        <button class="primary" type="submit" data-i18n="find_near">${esc(t.find_near)}</button>
      </form>
      <p class="loc" id="hLoc" aria-live="polite"></p>
      <div class="hero-side">
        <button type="button" class="textlink" id="heroJoin" data-i18n="create_profile">${esc(t.create_profile)}</button>
      </div>
      <p class="free" data-i18n="free_line">${esc(t.free_line)}</p>
    </section>
    <p class="region" data-i18n="region">${esc(t.region)}</p>
    <section id="faces"${opts.faces.length ? '' : ' hidden'}>
      <div class="card">
        <h2 class="display" data-i18n="faces_h">${esc(t.faces_h)}</h2>
        <p class="muted" data-i18n="faces_sub">${esc(t.faces_sub)}</p>
        <div class="faces" id="faceRow">${facesHtml(opts.faces, lang)}</div>
        <div id="soundBlock">${soundHtml(opts.faces, t.listen, t.no_demo)}</div>
      </div>
    </section>
    <div class="grid2">
      <div class="card">
        <h2 class="display" data-i18n="aud_jam_t">${esc(t.aud_jam_t)}</h2>
        <p class="muted" data-i18n="aud_jam_p">${esc(t.aud_jam_p)}</p>
        <button type="button" class="primary" data-go="jams" data-i18n="cta_jam">${esc(t.cta_jam)}</button>
      </div>
      <div class="card">
        <h2 class="display" data-i18n="aud_pro_t">${esc(t.aud_pro_t)}</h2>
        <p class="muted" data-i18n="aud_pro_p">${esc(t.aud_pro_p)}</p>
        <button type="button" class="primary" data-go="gigs" data-i18n="cta_gigs">${esc(t.cta_gigs)}</button>
      </div>
    </div>
    <div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <h2 class="display" data-i18n="aud_event_t">${esc(t.aud_event_t)}</h2>
        <p class="muted" data-i18n="aud_event_p">${esc(t.aud_event_p)}</p>
      </div>
      <button type="button" class="primary" data-go="bands" data-i18n="cta_hire">${esc(t.cta_hire)}</button>
    </div>
    <div class="card" id="how">
      <h2 class="display" data-i18n="how">${esc(t.how)}</h2>
      <ol class="steps">
        <li><span class="num">1</span><div><b data-i18n="step1_t">${esc(t.step1_t)}</b><div class="muted" data-i18n="step1_p">${esc(t.step1_p)}</div></div></li>
        <li><span class="num">2</span><div><b data-i18n="step2_t">${esc(t.step2_t)}</b><div class="muted" data-i18n="step2_p">${esc(t.step2_p)}</div></div></li>
        <li><span class="num">3</span><div><b data-i18n="step3_t">${esc(t.step3_t)}</b><div class="muted" data-i18n="step3_p">${esc(t.step3_p)}</div></div></li>
      </ol>
    </div>
    <div id="memberExtras"${opts.authed ? '' : ' hidden'}>
      <div class="card">
        <h2 class="display" data-i18n="alerts_t">${esc(t.alerts_t)}</h2>
        <p class="muted" data-i18n="alerts_p">${esc(t.alerts_p)}</p>
        <button type="button" class="primary" id="alertsBtn" data-i18n="alerts_btn">${esc(t.alerts_btn)}</button>
      </div>
      <div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <h2 class="display" data-i18n="invite_t">${esc(t.invite_t)}</h2>
          <p class="muted" data-i18n="invite_p">${esc(t.invite_p)}</p>
        </div>
        <button type="button" class="primary" id="inviteBtn" data-i18n="invite_btn">${esc(t.invite_btn)}</button>
      </div>
      <div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <h2 class="display" data-i18n="a2hs_card_t">${esc(t.a2hs_card_t)}</h2>
          <p class="muted" data-i18n="a2hs_card_p">${esc(t.a2hs_card_p)}</p>
        </div>
        <button type="button" class="primary" id="a2hsBtn" data-i18n="a2hs_btn">${esc(t.a2hs_btn)}</button>
      </div>
    </div>
  </div>

  <div id="page-musicians"${on('musicians')}>
    <div class="card intro">
      <h1 data-i18n="mus_intro_t">${esc(t.mus_intro_t)}</h1>
      <p class="muted" data-i18n="mus_intro_p">${esc(t.mus_intro_p)}</p>
      <button type="button" class="textlink" id="musJoin" data-i18n="create_profile">${esc(t.create_profile)}</button>
    </div>
    <form id="musForm" class="filters" action="/v2/musicians" method="get">
      ${instField('mus', tab === 'musicians' ? instrument : '')}
      ${locFields('mus', t.city, t.city_ph, tab === 'musicians' ? city : '', tab === 'musicians' ? lat : '', tab === 'musicians' ? lng : '')}
      ${nearField('mus', t.location, t.near_me)}
      ${distanceField('mus', t.distance, tab === 'musicians' ? radius : '50')}
      ${searchBtn}
      <p class="loc" id="musLoc" aria-live="polite"></p>
    </form>
    <div id="musResults" class="results" aria-live="polite"></div>
  </div>

  <div id="page-bands"${on('bands')}>
    <div class="card intro">
      <h1 data-i18n="bands_intro_t">${esc(t.bands_intro_t)}</h1>
      <p class="muted" data-i18n="bands_intro_p">${esc(t.bands_intro_p)}</p>
      <a class="primary" href="/bands" data-i18n="list_band">${esc(t.list_band)}</a>
    </div>
    <form id="bandForm" class="filters" action="/v2/bands" method="get">
      <div class="field">
        <span class="lbl" data-i18n="show">${esc(t.show)}</span>
        <div class="seg" id="bandSeg">
          <button type="button" data-bookable="" class="${bookable && tab === 'bands' ? '' : 'active'}" data-i18n="all">${esc(t.all)}</button>
          <button type="button" data-bookable="1" class="${bookable && tab === 'bands' ? 'active' : ''}" data-i18n="bookable">${esc(t.bookable)}</button>
        </div>
      </div>
      <div class="field">
        <label for="bandGenre" data-i18n="genre">${esc(t.genre)}</label>
        <select id="bandGenre" name="genre">${genreOptions(lang, tab === 'bands' ? genre : '')}</select>
      </div>
      ${locFields('band', t.city, t.city_ph, tab === 'bands' ? city : '', tab === 'bands' ? lat : '', tab === 'bands' ? lng : '')}
      ${nearField('band', t.location, t.near_me)}
      ${distanceField('band', t.distance, tab === 'bands' ? radius : '50')}
      ${searchBtn}
      <p class="loc" id="bandLoc" aria-live="polite"></p>
    </form>
    <div id="bandResults" class="results" aria-live="polite"></div>
  </div>

  <div id="page-jams"${on('jams')}>
    <div class="card intro">
      <h1 data-i18n="jams_intro_t">${esc(t.jams_intro_t)}</h1>
      <p class="muted" data-i18n="jams_intro_p">${esc(t.jams_intro_p)}</p>
      <a class="primary" href="/jams" data-i18n="post_jam">${esc(t.post_jam)}</a>
    </div>
    <form id="jamForm" class="filters" action="/v2/jams" method="get">
      ${instField('jam', tab === 'jams' ? instrument : '')}
      ${locFields('jam', t.city, t.city_ph, tab === 'jams' ? city : '', tab === 'jams' ? lat : '', tab === 'jams' ? lng : '')}
      ${nearField('jam', t.location, t.near_me)}
      ${distanceField('jam', t.distance, tab === 'jams' ? radius : '50')}
      ${searchBtn}
      <p class="loc" id="jamLoc" aria-live="polite"></p>
    </form>
    <div id="jamResults" class="results" aria-live="polite"></div>
  </div>

  <div id="page-gigs"${on('gigs')}>
    <div class="card intro">
      <h1 data-i18n="gigs_intro_t">${esc(t.gigs_intro_t)}</h1>
      <p class="muted" data-i18n="gigs_intro_p">${esc(t.gigs_intro_p)}</p>
      <a class="primary" href="/post" data-i18n="post_gig">${esc(t.post_gig)}</a>
    </div>
    <form id="gigForm" class="filters" action="/v2/gigs" method="get">
      ${instField('gig', tab === 'gigs' ? instrument : '')}
      ${locFields('gig', t.city, t.city_ph, tab === 'gigs' ? city : '', tab === 'gigs' ? lat : '', tab === 'gigs' ? lng : '')}
      ${nearField('gig', t.location, t.near_me)}
      ${distanceField('gig', t.distance, tab === 'gigs' ? radius : '50')}
      ${searchBtn}
      <p class="loc" id="gigLoc" aria-live="polite"></p>
    </form>
    <div id="gigResults" class="results" aria-live="polite"></div>
  </div>
</main>
<footer>
  ${WAVE_SVG}
  <div class="inner">
    <a class="brand" href="/v2">Jam<span>Werk</span></a>
    <a href="/?feedback=1" data-i18n="feedback">${esc(t.feedback)}</a>
    <button type="button" id="footHow" data-i18n="how">${esc(t.how)}</button>
    <a href="/about" data-i18n="about">${esc(t.about)}</a>
    <a href="/" data-i18n="current_site">${esc(t.current_site)}</a>
    <span class="copy">© ${new Date().getFullYear()} JamWerk</span>
  </div>
</footer>
<dialog id="authDialog">
  <button type="button" class="dlg-x" id="authClose" aria-label="${esc(t.close)}">&times;</button>
  <form id="authForm">
    <h2 id="authTitle">${esc(t.auth_login_h)}</h2>
    <div id="authMsg" class="msg"></div>
    <div class="row"><label for="aEmail" data-i18n="email">${esc(t.email)}</label><input id="aEmail" type="email" autocomplete="username" required></div>
    <div class="row"><label for="aPassword" data-i18n="password">${esc(t.password)}</label><input id="aPassword" type="password" minlength="8" autocomplete="current-password" required></div>
    <div class="row" id="nameRow" hidden><label for="aName" data-i18n="name">${esc(t.name)}</label><input id="aName" type="text" autocomplete="name"></div>
    <div class="row" id="tsRow" hidden><div id="tsBox"></div></div>
    <div class="row" id="termsRow" hidden><label style="display:flex;gap:8px;align-items:flex-start;font-weight:500;"><input id="aTerms" type="checkbox"> <span id="termsText"></span></label></div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
      <button class="primary" id="authSubmit" type="submit">${esc(t.login)}</button>
      <button type="button" class="textlink" id="authSwitch" style="color:var(--accent-deep)">${esc(t.need_account)}</button>
      <button type="button" class="textlink" id="authForgot" style="color:var(--muted)" data-i18n="forgot">${esc(t.forgot)}</button>
    </div>
  </form>
</dialog>
<dialog id="a2hsDialog">
  <button type="button" class="dlg-x" id="a2hsClose" aria-label="${esc(t.close)}">&times;</button>
  <h2 data-i18n="a2hs_t">${esc(t.a2hs_t)}</h2>
  <p class="muted" data-i18n="a2hs_card_p">${esc(t.a2hs_card_p)}</p>
  <ol>
    <li data-i18n="a2hs_ios_1">${esc(t.a2hs_ios_1)}</li>
    <li data-i18n="a2hs_ios_2">${esc(t.a2hs_ios_2)}</li>
    <li data-i18n="a2hs_and_1">${esc(t.a2hs_and_1)}</li>
    <li data-i18n="a2hs_and_2">${esc(t.a2hs_and_2)}</li>
    <li data-i18n="a2hs_desk">${esc(t.a2hs_desk)}</li>
  </ol>
  <button type="button" class="primary" id="a2hsInstall" hidden data-i18n="a2hs_btn">${esc(t.a2hs_btn)}</button>
</dialog>
<script type="application/json" id="v2-boot">${bootJson}</script>
</body>
</html>`;
}

function chosenLang(c: Context<AppEnv>): Lang {
  const q = c.req.query('lang');
  if (q === 'en' || q === 'fr' || q === 'de' || q === 'it') return q;
  const cookie = c.req.header('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)jw-v2-lang=(en|fr|de|it)(?:;|$)/);
  if (m) return m[1] as Lang;
  return pickLang(c.req.header('Accept-Language'));
}

async function page(c: Context<AppEnv>, tab: V2Tab) {
  const base = (c.env.BASE_URL || 'https://jamwerk.app').replace(/\/$/, '');
  const html = renderV2Page({
    lang: chosenLang(c),
    tab,
    authed: !!c.get('user'),
    q: c.req.query(),
    faces: tab === 'home' ? await loadSpotlight(c.env.DB) : [],
    base,
  });
  return c.html(html, 200, {
    'Cache-Control': 'private, max-age=60',
    Vary: 'Cookie, Accept-Language',
    'X-Robots-Tag': 'noindex',
  });
}

export const v2Routes = new Hono<AppEnv>();
v2Routes.get('/api/spotlight', async (c) => {
  const musicians = await loadSpotlight(c.env.DB);
  return c.json({ musicians }, 200, { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'private, max-age=30' });
});
v2Routes.get('/', (c) => page(c, 'home'));
v2Routes.get('/musicians', (c) => page(c, 'musicians'));
v2Routes.get('/bands', (c) => page(c, 'bands'));
v2Routes.get('/jams', (c) => page(c, 'jams'));
v2Routes.get('/gigs', (c) => page(c, 'gigs'));
v2Routes.get('/gigs/:id', (c) => page(c, 'gigs'));
v2Routes.all('*', (c) => notFound(c));
