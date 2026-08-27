// Public band page: GET /b/:id  (also /b/:id-any-slug). Server-rendered like /m/:handle
// so a link shared on WhatsApp / a venue's inbox opens with name, genres, fee and demos
// without needing the app shell. "Contact" deep-links into the app (?band=ID).
import { Hono } from 'hono';
import { WAVE_SVG, NOTES_LAYER } from './ui';
import { pickLang, t } from './i18n';
import type { AppEnv } from './types';
import { notFoundPage } from './not-found';
import { classifyMedia, mediaHtml, MEDIA_CSS } from './media';
import { esc, PAGE_CSS } from './profile-page';
import { normGenres, genreLabel } from './genres';

const EXTRA_CSS = `
  .book { background: var(--accent-tint); border: 1px solid var(--accent-tint-line); border-radius: 12px; padding: 14px; margin-bottom: 14px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .book .fee { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 22px; font-weight: 800; color: var(--accent-deep); }
  .book .fee small { font-size: 12.5px; font-weight: 500; color: var(--muted); display: block; }
  .btn { margin-left: auto; background: var(--accent); color: #fff !important; text-decoration: none; padding: 11px 18px; border-radius: 10px; font-weight: 700; font-size: 14.5px; }
  .btn:hover { background: var(--accent-deep); }
  .lineup { display: flex; gap: 6px; flex-wrap: wrap; }
  .pitch { font-size: 16px; color: #3a382f; margin: 0 0 12px; }
  .desc { white-space: pre-wrap; font-size: 14.5px; color: #3a382f; }
  @media (max-width: 640px) { .btn { margin-left: 0; width: 100%; text-align: center; } }
`;

const bandPage = new Hono<AppEnv>();

bandPage.get('/:id', async (c) => {
  const raw = c.req.param('id');
  const idMatch = /^(\d{1,9})(?:-[a-z0-9-]*)?$/.exec(raw);
  if (!idMatch) return c.notFound();
  const id = Number(idMatch[1]);
  const lang = pickLang(c.req.header('Accept-Language'));
  const baseUrl = c.env.BASE_URL || 'https://jamwerk.app';

  const b = await c.env.DB.prepare(
    'SELECT b.*, (SELECT AVG(rating) FROM band_reviews r WHERE r.band_id = b.id) AS avg_rating, (SELECT COUNT(*) FROM band_reviews r WHERE r.band_id = b.id) AS review_count, u.display_name AS owner_name, (SELECT handle FROM musician_details md WHERE md.owner = b.owner_email) AS owner_handle FROM bands b JOIN users u ON u.email = b.owner_email WHERE b.id = ?'
  ).bind(id).first<any>();
  if (!b) {
    return c.html(notFoundPage(lang, t(lang, { en: 'No such band.', fr: 'Ce groupe n’existe pas.', de: 'Diese Band gibt es nicht.', it: 'Questo gruppo non esiste.' })), 404);
  }
  const { results: seats } = await c.env.DB.prepare(
    `SELECT s.instrument, s.status, u.display_name AS member_name, md.handle AS member_handle
     FROM band_seats s LEFT JOIN users u ON u.email = s.member_email LEFT JOIN musician_details md ON md.owner = s.member_email
     WHERE s.band_id = ? ORDER BY s.id`
  ).bind(id).all();

  const genres: string[] = normGenres(JSON.parse(b.genres || '[]'));
  const { results: reviews } = await c.env.DB.prepare('SELECT r.rating, r.comment, r.created_at, u.display_name FROM band_reviews r JOIN users u ON u.email = r.reviewer_email WHERE r.band_id = ? ORDER BY r.id DESC LIMIT 20').bind(id).all();
  const avg = b.avg_rating != null ? Math.round(b.avg_rating * 10) / 10 : null;
  const links: string[] = JSON.parse(b.links || '[]');
  const label = (s: string) => s.replace(/_/g, ' ');
  const isJam = b.kind === 'jam';
  const initials = String(b.name).split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const open = (seats as any[]).filter((s) => s.status === 'open');
  const filled = (seats as any[]).filter((s) => s.status === 'filled');

  const feeLine = b.fee_from
    ? `${t(lang, { en: 'from', fr: 'dès', de: 'ab', it: 'da' })} ${esc(b.fee_currency || 'CHF')} ${Number(b.fee_from).toLocaleString('de-CH')}`
    : t(lang, { en: 'fee on request', fr: 'tarif sur demande', de: 'Gage auf Anfrage', it: 'tariffa su richiesta' });
  const contactLabel = b.bookable
    ? t(lang, { en: 'Book this band', fr: 'Réserver ce groupe', de: 'Diese Band buchen', it: 'Prenota questo gruppo' })
    : t(lang, { en: 'Contact the band', fr: 'Contacter le groupe', de: 'Band kontaktieren', it: 'Contatta il gruppo' });
  const bookHtml = `<div class="book">
      <div class="fee">${b.bookable ? feeLine : t(lang, { en: 'Not taking bookings', fr: 'Ne prend pas de réservations', de: 'Nimmt keine Buchungen an', it: 'Non accetta prenotazioni' })}
        <small>${b.bookable
          ? t(lang, { en: 'available for events — weddings, parties, corporate', fr: 'disponible pour événements — mariages, soirées, entreprises', de: 'für Events buchbar — Hochzeiten, Partys, Firmenanlässe', it: 'disponibile per eventi — matrimoni, feste, aziende' })
          : (isJam
            ? t(lang, { en: 'a jam / practice group — ask to join', fr: 'un groupe de jam / répétition — demandez à rejoindre', de: 'eine Jam-/Probegruppe — frag nach einem Platz', it: 'un gruppo jam / di prova — chiedi di unirti' })
            : t(lang, { en: 'you can still say hello', fr: 'vous pouvez quand même dire bonjour', de: 'du kannst trotzdem hallo sagen', it: 'puoi comunque salutare' }))}</small>
      </div>
      <a class="btn" href="/?band=${b.id}">${contactLabel}</a>
    </div>`;

  const demoHtml = links.length
    ? links.map((u) => { const m = classifyMedia(u); return m ? mediaHtml(m) : ''; }).join('')
    : `<p class="empty">${t(lang, { en: 'No demos yet.', fr: 'Pas encore de démos.', de: 'Noch keine Demos.', it: 'Ancora nessuna demo.' })}</p>`;

  const person = (name: string, handle: string | null, extra: string) => handle
    ? `<a class="chip hot" href="/m/${esc(handle)}" style="text-decoration: none;">${esc(name)}${extra}</a>`
    : `<span class="chip hot">${esc(name)}${extra}</span>`;
  const lineupHtml = [
    person(b.owner_name || b.owner_email.split('@')[0], b.owner_handle, ''),
    ...filled.map((s) => person(s.member_name || '', s.member_handle, ' · ' + esc(label(s.instrument)))),
    ...open.map((s) => `<span class="chip">${t(lang, { en: 'open seat', fr: 'place libre', de: 'freier Platz', it: 'posto libero' })}: ${esc(label(s.instrument))}</span>`),
  ].join('');

  const kindLabel = isJam
    ? t(lang, { en: 'Jam / practice group', fr: 'Groupe de jam / répétition', de: 'Jam-/Probegruppe', it: 'Gruppo jam / di prova' })
    : t(lang, { en: 'Band', fr: 'Groupe', de: 'Band', it: 'Gruppo' });
  const title = `${b.name} — ${genres.map((x) => genreLabel(lang, x)).join(', ') || kindLabel} | JamWerk`;
  const ogDesc = `${kindLabel}${b.home_city ? ' · ' + b.home_city : ''}${b.bookable ? ' · ' + feeLine : ''}${b.pitch ? ' — ' + b.pitch : ''}`;
  return c.html(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:title" content="${esc(b.name)} on JamWerk">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="JamWerk">
<meta property="og:url" content="${esc(baseUrl)}/b/${b.id}">
<meta property="og:image" content="${esc(baseUrl)}${b.cover_key ? '/img/' + esc(b.cover_key) : '/icons/icon-512.png'}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<meta name="theme-color" content="#14131a">
<style>${MEDIA_CSS}${PAGE_CSS}${EXTRA_CSS}</style>
</head>
<body>
${NOTES_LAYER}
<header${b.cover_key ? ` style="background-image: linear-gradient(rgba(20,19,26,0.55), rgba(20,19,26,0.85)), url('/img/${esc(b.cover_key)}'); background-size: cover; background-position: center;"` : ''}>
  ${WAVE_SVG}
  <div class="inner">
    <a class="back" href="/?tab=band">&larr; JamWerk · ${t(lang, { en: 'Bands', fr: 'Groupes', de: 'Bands', it: 'Gruppi' })}</a>
    <div class="hero">
      <div class="avatar">${esc(initials)}</div>
      <div>
        <h1 class="display">${esc(b.name)}</h1>
        <div class="sub">${kindLabel}${b.home_city ? ' · ' + esc(b.home_city) : ''}</div>
      </div>
    </div>
    <div class="pills">${genres.map((x) => `<span class="pill">${esc(genreLabel(lang, x))}</span>`).join('')}</div>
  </div>
</header>
<main>
  ${bookHtml}
  ${b.pitch ? `<p class="pitch">${esc(b.pitch)}</p>` : ''}
  ${b.description ? `<div class="card desc">${esc(b.description)}</div>` : ''}
  <h2>${t(lang, { en: 'Demos', fr: 'Démos', de: 'Demos', it: 'Demo' })}</h2>
  ${demoHtml}
  <h2>${t(lang, { en: 'Line-up', fr: 'Formation', de: 'Besetzung', it: 'Formazione' })}</h2>
  <div class="lineup">${lineupHtml}</div>
  <h2>${t(lang, { en: 'Reviews', fr: 'Avis', de: 'Bewertungen', it: 'Recensioni' })}${avg != null ? ` · ★ ${avg} (${b.review_count})` : ''}</h2>
  ${(reviews as any[]).length ? (reviews as any[]).map((r) => `<div class="card review"><div class="head"><span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span><span class="ctx">${esc(r.display_name || '')}</span></div>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}</div>`).join('') : `<p class="empty">${t(lang, { en: 'No reviews yet — organisers can leave one after the band played for them.', fr: 'Pas encore d’avis — les organisateurs peuvent en laisser un après la prestation.', de: 'Noch keine Bewertungen — Veranstalter:innen können nach dem Auftritt eine abgeben.', it: 'Ancora nessuna recensione — gli organizzatori possono lasciarne una dopo l’esibizione.' })}</p>`}
</main>
<footer>
  ${WAVE_SVG}
  <div class="inner">
    <a href="/" style="text-decoration: none;"><span class="brand">Jam<span>Werk</span></span></a>
    <span>${t(lang, { en: 'Booked through JamWerk — gigs · jams · bands', fr: 'Réservé via JamWerk — concerts · jams · groupes', de: 'Gebucht über JamWerk — Gigs · Jams · Bands', it: 'Prenotato tramite JamWerk — concerti · jam · band' })}</span>
    <a href="/about">${t(lang, { en: 'About', fr: 'À propos', de: 'Über uns', it: 'Chi siamo' })}</a>
    <span style="margin-left: auto;">© ${new Date().getFullYear()} JamWerk</span>
  </div>
</footer>
</body>
</html>`);
});

export default bandPage;
