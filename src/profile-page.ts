// src/profile-page.ts — public, shareable musician profile at /m/:handle.
// Server-rendered (works logged out); shows the musician's public track record
// but never their email. Mirrors the Profile artboard in design/.
import { Hono } from 'hono';
import { WAVE_SVG, NOTES_LAYER } from './ui';
import { pickLang, t } from './i18n';
import type { AppEnv } from './types';
import { notFoundPage } from './not-found';
import { classifyMedia, mediaHtml, MEDIA_CSS } from './media';

export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const PAGE_CSS = `
  :root {
    --ink: #14131a; --paper: #f4f2ec; --card: #fffdf8; --line: #e5e1d8;
    --accent: #6440fb; --accent-deep: #4f30d8; --accent-light: #a58bff;
    --accent-tint: #efeaff; --accent-tint-line: #d8cdfd;
    --muted: #6f6c64; --gold: #b98a00; --r: 14px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.5 'Instrument Sans', system-ui, sans-serif; background: var(--paper); color: #1b1a16; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; }
  #bgnotes { position: fixed; inset: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.085; pointer-events: none; }
  .display { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; }
  a { color: var(--accent); } a:hover { color: var(--accent-deep); }
  header {
    background-color: var(--ink);
    background-image: radial-gradient(circle at 88% -12%, rgba(100,64,251,0.34), transparent 58%);
    color: #fff; padding: 20px; position: relative; z-index: 0; overflow: hidden;
  }
  header .wave { position: absolute; left: 0; right: 0; bottom: -2px; width: 100%; height: 32px; z-index: -1; opacity: 0.28; }
  header .inner, main { max-width: 720px; margin: 0 auto; }
  header a.back { color: rgba(255,255,255,0.65); font-size: 13.5px; text-decoration: none; }
  .hero { display: flex; align-items: center; gap: 16px; margin-top: 14px; }
  .avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 24px; flex-shrink: 0; }
  .hero h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
  .hero .sub { color: rgba(255,255,255,0.65); font-size: 13.5px; }
  .pills { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0 4px; }
  .pill { background: #232230; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: #d8d5e6; }
  .stats { display: flex; background: var(--card); border-bottom: 1px solid var(--line); }
  .stats .inner { display: flex; flex: 1; max-width: 720px; margin: 0 auto; padding: 14px 0; }
  .stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .stat + .stat { border-left: 1px solid var(--line); }
  .stat b { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 19px; font-weight: 800; }
  .stat b.gold { color: var(--gold); }
  .stat span { font-size: 12px; color: var(--muted); }
  main { padding: 16px 20px 64px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .chip { background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; font-size: 12.5px; color: var(--muted); }
  .chip.hot { background: var(--accent-tint); border-color: var(--accent-tint-line); color: var(--accent-deep); font-weight: 600; }
  h2 { font-size: 13px; font-weight: 700; color: #3a382f; text-transform: uppercase; letter-spacing: 0.06em; margin: 18px 0 8px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(20,19,26,0.05); }
  .demo { display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
  .demo .play { width: 36px; height: 36px; border-radius: 50%; background: var(--ink); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .demo .t { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
  .demo .d { font-size: 12.5px; color: var(--muted); }
  .review .head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .stars { color: var(--gold); font-size: 13px; letter-spacing: 2px; }
  .review .ctx { font-size: 12.5px; color: var(--muted); }
  .review p { margin: 0; font-size: 14px; line-height: 1.45; color: #3a382f; }
  .empty { color: var(--muted); font-size: 14px; }
  main { flex: 1 0 auto; width: 100%; }
  footer {
    flex-shrink: 0;
    background-color: #14131a;
    background-image: radial-gradient(circle at 12% 130%, rgba(100,64,251,0.34), transparent 58%);
    color: rgba(255,255,255,0.65); padding: 24px 20px 40px; margin-top: 48px;
    position: relative; overflow: hidden; z-index: 0; font-size: 13.5px;
  }
  footer .wave { position: absolute; left: 0; right: 0; bottom: -2px; width: 100%; height: 32px; z-index: -1; opacity: 0.28; }
  footer .inner { max-width: 860px; margin: 0 auto; display: flex; gap: 8px 18px; align-items: center; flex-wrap: wrap; }
  footer .brand { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 18px; font-weight: 800; letter-spacing: -0.4px; color: #fff; }
  footer .brand span { color: var(--accent-light, #a58bff); }
  footer a { color: rgba(255,255,255,0.75); }
`;

const profilePage = new Hono<AppEnv>();

profilePage.get('/:handle', async (c) => {
  const handle = c.req.param('handle');
  if (!/^[a-z0-9-]{1,50}$/.test(handle)) return c.notFound();

  const lang = pickLang(c.req.header('Accept-Language'));
  const baseUrl = c.env.BASE_URL || 'https://jamwerk.app';
  const m = await c.env.DB.prepare(
    `SELECT m.*, u.display_name, u.photo_key, u.created_at AS member_since
     FROM musician_details m JOIN users u ON u.email = m.owner
     WHERE m.handle = ?`
  ).bind(handle).first<any>();
  if (!m) {
    return c.html(notFoundPage(lang, t(lang, { en: 'No such musician.', fr: 'Ce musicien n’existe pas.', de: 'Diesen Musiker gibt es nicht.', it: 'Questo musicista non esiste.' })), 404);
  }

  const stats = await c.env.DB.prepare(
    `SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count
     FROM gig_reviews WHERE reviewee_email = ? AND direction = 'poster_to_musician'`
  ).bind(m.owner).first<{ avg_rating: number | null; review_count: number }>();

  const { results: reviews } = await c.env.DB.prepare(
    `SELECT r.rating, r.comment, r.created_at, g.instrument, g.venue_city, g.gig_date
     FROM gig_reviews r
     JOIN bookings b ON b.id = r.booking_id
     JOIN gigs g ON g.id = b.gig_id
     WHERE r.reviewee_email = ? AND r.direction = 'poster_to_musician'
     ORDER BY r.created_at DESC LIMIT 20`
  ).bind(m.owner).all();

  const name = m.display_name || 'JamWerk musician';
  const initials = name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const instruments: string[] = JSON.parse(m.instruments || '[]');
  const genres: string[] = JSON.parse(m.genres || '[]');
  const demos: string[] = JSON.parse(m.demo_links || '[]');
  const label = (s: string) => s.replace(/_/g, ' ');
  const avg = stats?.avg_rating != null ? Math.round(stats.avg_rating * 10) / 10 : null;

  const levelNames: Record<string, { en: string; fr: string; de: string; it: string }> = {
    hobby: { en: 'hobby musician', fr: 'musicien amateur', de: 'Hobbymusiker:in', it: 'musicista amatoriale' },
    semi_pro: { en: 'semi-pro', fr: 'semi-pro', de: 'semiprofessionell', it: 'semi-professionista' },
    pro: { en: 'professional', fr: 'professionnel', de: 'professionell', it: 'professionista' },
  };
  const lfNames: Record<string, { en: string; fr: string; de: string; it: string }> = {
    dep: { en: 'looking for paid dep gigs', fr: 'cherche des remplacements payés', de: 'sucht bezahlte Ersatz-Gigs', it: 'cerca sostituzioni pagate' },
    jam: { en: 'looking for jam partners', fr: 'cherche des partenaires de jam', de: 'sucht Jam-Partner', it: 'cerca partner per jam' },
    join_band: { en: 'wants to join a band', fr: 'cherche à rejoindre un groupe', de: 'möchte in eine Band einsteigen', it: 'vuole entrare in un gruppo' },
    start_band: { en: 'wants to start a band', fr: 'cherche à monter un groupe', de: 'möchte eine Band gründen', it: 'vuole fondare un gruppo' },
  };
  const lookingFor: string[] = JSON.parse(m.looking_for || '[]');
  const flagChips = [
    ...lookingFor.filter((k) => lfNames[k]).map((k) => `<span class="chip hot">${t(lang, lfNames[k])}</span>`),
    m.level && levelNames[m.level] ? `<span class="chip hot">${t(lang, levelNames[m.level])}</span>` : '',
    m.reads_charts ? '<span class="chip hot">reads charts</span>' : '',
    m.sings_backing ? '<span class="chip">backing vocals</span>' : '',
    m.own_transport ? '<span class="chip">own transport</span>' : '',
    m.own_pa ? '<span class="chip">own PA</span>' : '',
    ...genres.map((x) => `<span class="chip">${esc(x)}</span>`),
  ].filter(Boolean).join('');

  const demoHtml = demos.length
    ? demos.map((u) => { const m = classifyMedia(u); return m ? mediaHtml(m) : ''; }).join('')
    : `<p class="empty">${t(lang, { en: 'No demos yet.', fr: 'Pas encore de démos.', de: 'Noch keine Demos.', it: 'Ancora nessuna demo.' })}</p>`;

  const reviewHtml = (reviews as any[]).length
    ? (reviews as any[]).map((r) => `<div class="card review">
        <div class="head">
          <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          <span class="ctx">${esc(label(r.instrument))} · ${esc(r.venue_city)}${r.gig_date ? ' · ' + esc(r.gig_date) : ''}</span>
        </div>
        ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
      </div>`).join('')
    : `<p class="empty">${t(lang, { en: 'No reviews yet — they appear after completed gigs.', fr: "Pas encore d'avis — ils apparaissent après les concerts effectués.", de: 'Noch keine Bewertungen — sie erscheinen nach abgeschlossenen Gigs.', it: 'Ancora nessuna recensione — appaiono dopo i concerti completati.' })}</p>`;

  const title = `${name} — ${instruments.map(label).join(', ') || 'musician'} | JamWerk`;
  return c.html(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<meta property="og:title" content="${esc(name)} on JamWerk">
<meta property="og:description" content="${esc(instruments.map(label).join(', '))}${m.home_city ? ' · ' + esc(m.home_city) : ''} · ${m.gigs_played} gigs played">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="JamWerk">
<meta property="og:url" content="${esc(baseUrl)}/m/${esc(m.handle)}">
<meta property="og:image" content="${esc(baseUrl)}${m.photo_key ? `/img/${esc(m.photo_key)}` : '/icons/icon-512.png'}">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<meta name="theme-color" content="#14131a">
<style>${MEDIA_CSS}${PAGE_CSS}</style>
</head>
<body>
${NOTES_LAYER}
<header>
  ${WAVE_SVG}
  <div class="inner">
    <a class="back" href="/">&larr; JamWerk</a>
    <div class="hero">
      <div class="avatar">${m.photo_key ? `<img src="/img/${esc(m.photo_key)}" alt="" width="64" height="64" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">` : esc(initials)}</div>
      <div>
        <h1 class="display">${esc(name)}</h1>
        <div class="sub">${esc(m.home_city || '')}${m.home_city ? ' · ' : ''}${t(lang, { en: 'travels', fr: 'se déplace jusqu\u2019à', de: 'reist bis', it: 'si sposta fino a' })} ${m.travel_radius_km} km</div>
      </div>
    </div>
    <div class="pills">${instruments.map((x) => `<span class="pill">${esc(label(x))}</span>`).join('')}</div>
  </div>
</header>
<div class="stats"><div class="inner">
  <div class="stat"><b class="display">${m.gigs_played}</b><span>${t(lang, { en: 'gigs played', fr: 'concerts joués', de: 'gespielte Gigs', it: 'concerti suonati' })}</span></div>
  <div class="stat"><b class="display gold">${avg != null ? avg + ' ★' : '–'}</b><span>${stats?.review_count || 0} ${t(lang, { en: 'reviews', fr: 'avis', de: 'Bewertungen', it: 'recensioni' })}</span></div>
  <div class="stat"><b class="display">${m.rate_min != null ? 'CHF ' + m.rate_min + '+' : '–'}</b><span>${t(lang, { en: 'per gig', fr: 'par concert', de: 'pro Gig', it: 'a concerto' })}</span></div>
</div></div>
<main>
  <div class="chips">${flagChips}</div>
  <h2>${t(lang, { en: 'Demos', fr: 'Démos', de: 'Demos', it: 'Demo' })}</h2>
  ${demoHtml}
  <h2>${t(lang, { en: 'Reviews', fr: 'Avis', de: 'Bewertungen', it: 'Recensioni' })}</h2>
  ${reviewHtml}
</main>
<footer>
  ${WAVE_SVG}
  <div class="inner">
    <a href="/" style="text-decoration: none;"><span class="brand">Jam<span>Werk</span></span></a>
    <span>${t(lang, { en: 'Booked through JamWerk — gigs · jams · bands', fr: 'Réservé via JamWerk — concerts · jams · groupes', de: 'Gebucht über JamWerk — Gigs · Jams · Bands', it: 'Prenotato tramite JamWerk — concerti · jam · band' })}</span>
    <span style="margin-left: auto;">© ${new Date().getFullYear()} JamWerk</span>
  </div>
</footer>
</body>
</html>`);
});

export default profilePage;
