// src/ui.ts
// Single-page UI over the JSON API. Server ships static HTML + vanilla JS;
// all state lives in the API. Rendering uses DOM building (textContent),
// never innerHTML with user data.
// Ambient layers for the "backstage editorial" theme (mirrors design/):
// an audio-waveform strip along the header's bottom edge, and a faint violet
// scatter of notation behind the page. Deterministic — same field every load.
import { MEDIA_CSS } from './media';
import { PLACES_JSON } from './places';
import { GENRES, GENRE_LABELS } from './genres';

export const WAVE_SVG = (() => {
  const heights = [8, 14, 10, 22, 30, 18, 12, 26, 36, 24, 14, 20, 32, 16, 10, 24, 34, 28, 16, 12, 22, 38, 26, 14, 18, 30, 20, 10, 16, 28, 36, 22, 12, 20, 26, 18, 32, 14, 8];
  let bars = '';
  for (let i = 0; i < 120; i++) {
    const h = heights[i % heights.length];
    bars += `<rect x="${i * 10 + 2}" y="${40 - h}" width="6" height="${h}" rx="2"></rect>`;
  }
  return `<svg class="wave" viewBox="0 0 1200 40" preserveAspectRatio="none" fill="#a58bff" aria-hidden="true">${bars}</svg>`;
})();

export const NOTES_LAYER = (() => {
  let seed = 33;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const defs =
    '<g id="note8">' +
    '<ellipse cx="0" cy="0" rx="5.5" ry="4" transform="rotate(-20)"></ellipse>' +
    '<rect x="4.4" y="-28" width="1.7" height="28"></rect>' +
    '<path d="M6.1 -28 C 12 -24 14.5 -17 10.5 -10 C 13.5 -17 11 -23 6.1 -24.5 Z"></path>' +
    '</g>' +
    '<g id="note2x">' +
    '<ellipse cx="0" cy="0" rx="5.2" ry="3.8" transform="rotate(-20)"></ellipse>' +
    '<ellipse cx="17" cy="-3" rx="5.2" ry="3.8" transform="rotate(-20 17 -3)"></ellipse>' +
    '<rect x="4.2" y="-25" width="1.6" height="25"></rect>' +
    '<rect x="21.2" y="-28" width="1.6" height="25"></rect>' +
    '<path d="M4.2 -25 L22.8 -28.4 L22.8 -24.4 L4.2 -21 Z"></path>' +
    '</g>';
  let uses = '';
  let i = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * 50 + 30 + Math.round(rnd() * 24 - 12);
      const y = row * 70 + 45 + Math.round(rnd() * 28 - 14);
      const glyph = i % 3 ? 'note8' : 'note2x';
      const sc = (0.42 + rnd() * 0.3).toFixed(2);
      const rot = Math.round(rnd() * 60 - 30);
      uses += `<use href="#${glyph}" transform="translate(${x} ${y}) rotate(${rot}) scale(${sc})"></use>`;
      i++;
    }
  }
  return `<svg id="bgnotes" fill="#6440fb" aria-hidden="true"><defs>${defs}<pattern id="notesP" width="220" height="240" patternUnits="userSpaceOnUse">${uses}</pattern></defs><rect width="100%" height="100%" fill="url(#notesP)"></rect></svg>`;
})();

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>JamWerk — paid gigs, jam partners & bands for local musicians</title>
<meta name="description" content="JamWerk connects local musicians: paid dep gigs with public CHF fees, free jam partners and bands with open seats — filtered by your instrument and region. Swiss, in EN/FR/DE/IT.">
<link rel="canonical" href="https://jamwerk.app/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="JamWerk">
<meta property="og:title" content="JamWerk — paid gigs, jam partners & bands for local musicians">
<meta property="og:description" content="Find a dep. Join a jam. Start a band. Local musicians, public fees, alerts for your instrument near you.">
<meta property="og:url" content="https://jamwerk.app/">
<meta property="og:image" content="https://jamwerk.app/icons/icon-512.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta name="twitter:card" content="summary">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#14131a">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="JamWerk">
<style>
  :root {
    --ink: #14131a; --paper: #f4f2ec; --card: #fffdf8; --line: #e5e1d8;
    --accent: #6440fb; --accent-deep: #4f30d8; --accent-light: #a58bff;
    --accent-tint: #efeaff; --accent-tint-line: #d8cdfd; --accent-ink: #ffffff;
    --ok: #0a7d4f; --warn: #b3261e; --muted: #6f6c64; --gold: #b98a00; --r: 14px;
  }
  * { box-sizing: border-box; }
  /* Column layout so the footer sits at the bottom even on short pages
     (e.g. an empty tab); main stretches, footer never floats mid-screen. */
  body { margin: 0; font: 16px/1.5 'Instrument Sans', system-ui, sans-serif; background: var(--paper); color: #1b1a16; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; }
  main { flex: 1 0 auto; width: 100%; }
  footer { flex-shrink: 0; }
  #bgnotes { position: fixed; inset: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.085; pointer-events: none; }
  header {
    background-color: var(--ink);
    background-image: radial-gradient(circle at 88% -12%, rgba(100,64,251,0.34), transparent 58%);
    color: #fff; padding: 16px 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    position: relative; z-index: 0; overflow: hidden;
  }
  header .wave { position: absolute; left: 0; right: 0; bottom: -2px; width: 100%; height: 32px; z-index: -1; opacity: 0.28; }
  header h1 { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 25px; font-weight: 800; margin: 0; letter-spacing: -0.5px; cursor: pointer; }
  header h1 span { color: var(--accent-light); }
  header .spacer, footer .spacer { flex: 1; }
  footer {
    background-color: var(--ink);
    background-image: radial-gradient(circle at 12% 130%, rgba(100,64,251,0.34), transparent 58%);
    color: rgba(255,255,255,0.65); padding: 24px 20px 28px; margin-top: 48px;
    position: relative; overflow: hidden; z-index: 0; font-size: 13.5px;
  }
  /* Same orientation as the header: bars stand on the footer's bottom edge. */
  footer .wave { position: absolute; left: 0; right: 0; bottom: -2px; width: 100%; height: 32px; z-index: -1; opacity: 0.28; }
  footer .inner { max-width: 860px; margin: 0 auto; display: flex; gap: 8px 18px; align-items: center; flex-wrap: wrap; }
  footer a { color: rgba(255,255,255,0.75); text-underline-offset: 3px; }
  footer .flinks { display: flex; gap: 6px 18px; flex-wrap: wrap; align-items: center; margin-left: 12px; }
  footer .copy { margin-left: auto; white-space: nowrap; }
  @media (max-width: 640px) {
    footer .inner { gap: 10px 0; }
    footer .brand { flex-basis: 100%; }
    footer .flinks { flex-basis: 100%; margin-left: 0; gap: 8px 16px; }
    footer .copy { flex-basis: 100%; text-align: right; margin-left: 0; }
  }
  footer .brand { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 18px; font-weight: 800; letter-spacing: -0.4px; color: #fff; cursor: pointer; }
  footer .brand span { color: var(--accent-light); }
  footer button { background: none; border: 0; padding: 0; font: inherit; color: rgba(255,255,255,0.75); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  header .who { font-size: 14px; opacity: .8; }
  /* Language picker: custom chevron so the text/arrow padding is symmetric
     across browsers (native arrows add uneven space). */
  header #langSel { -webkit-appearance: none; appearance: none; width: auto; min-height: 40px; background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.35); border-radius: 10px; padding: 7px 30px 7px 14px; font: inherit; font-size: 14px; font-weight: 500; line-height: 1; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
  header #langSel option { color: #1b1a16; background: #fff; }
  header #notifBtn.on { color: var(--accent-light) !important; border-color: var(--accent-light) !important; }
  nav { display: flex; gap: 6px; padding: 14px 20px 0; max-width: 860px; margin: 0 auto; flex-wrap: wrap; }
  nav button { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 9px 16px; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; min-height: 44px; }
  nav button.active { background: var(--ink); color: #fff; border-color: var(--ink); font-weight: 600; }
  nav button svg, nav button .ls, .mobile-only, #profileBtn { display: none; }
  #profileBtn { position: relative; }
  .ask-line { margin: 18px 0 6px; text-align: center; font-size: 13.5px; color: var(--muted); }
  .ask-line button { background: none; border: 0; padding: 0; font: inherit; color: var(--accent-deep); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  button.danger { background: #b3261e !important; }
  .tag.urgent { background: #fde8e6; color: #b3261e; border-color: #f5c2bd; font-weight: 700; }
  .tag.standby { background: var(--accent-tint); color: var(--accent-deep); border-color: var(--accent-tint-line); font-weight: 700; }
  .state-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 10px; background: var(--paper); border: 1px solid var(--line); font-size: 14px; color: var(--muted); }
  .state-chip.good { background: #e7f6ec; border-color: #bfe5cb; color: #1e6b3a; font-weight: 600; }
  .onboard ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .onboard li { display: flex; gap: 12px; align-items: center; }
  .onboard .tick { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--line); display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; color: var(--muted); }
  .onboard .tick.done { background: var(--ok); border-color: var(--ok); color: #fff; }
  .onboard .txt { flex: 1; font-size: 15px; }
  .onboard .txt.done { text-decoration: line-through; color: var(--muted); }
  body.help-mode nav#tabs { display: none !important; }
  body.help-mode main { padding-bottom: 24px; }
  #helpClose { display: none; }
  body.help-mode #helpClose { display: flex; }
  .profile-hero { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
  .profile-hero .avatar { width: 72px; height: 72px; font-size: 26px; overflow: hidden; flex-shrink: 0; }
  .profile-hero .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .profile-hero .who { flex: 1; min-width: 160px; }
  .hero-actions { display: flex; gap: 8px; flex-wrap: wrap; flex-basis: 100%; }
  .recent { display: flex; flex-direction: column; gap: 6px; }
  .recent .rrow { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--paper); border: 1px solid var(--line); border-radius: 10px; font-size: 14px; cursor: pointer; }
  .recent .rrow .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button.ghost.accent { color: var(--accent-deep) !important; border-color: var(--accent-tint-line) !important; background: var(--accent-tint) !important; font-weight: 700; }
  .settings { padding: 4px 0; }
  .srow { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; background: transparent; border: 0; border-bottom: 1px solid var(--line); padding: 14px 16px; font: inherit; font-size: 15.5px; color: var(--ink); text-align: left; cursor: pointer; min-height: 50px; }
  .srow:last-child { border-bottom: 0; }
  .srow .val { color: var(--muted); font-size: 15px; }
  .srow select { width: auto; margin: 0; padding: 6px 30px 6px 10px; font-size: 14.5px; min-height: 0; }
  .logout { width: 100%; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; font: inherit; font-size: 15.5px; font-weight: 700; color: #c0392b; cursor: pointer; margin: 4px 0 20px; min-height: 48px; }
  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .steps li { display: flex; gap: 14px; align-items: flex-start; }
  .steps .num { width: 40px; height: 40px; border-radius: 50%; background: var(--accent); color: #fff; font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 800; font-size: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .steps b { display: block; font-size: 16.5px; margin-bottom: 2px; }
  .steps .muted { font-size: 14.5px; }
  .m-instruments { font-size: 14px; color: var(--ink); margin-top: 1px; }
  .m-meta { font-size: 13px; color: var(--muted); margin-top: 3px; }
  #mPublic:not([hidden]) { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px 16px; font-weight: 600; color: var(--ink); min-height: 44px; }
  @media (max-width: 640px) { #mPublic:not([hidden]) { width: 100%; } }
  .card.hilite { box-shadow: 0 0 0 3px var(--accent-light); }
  .tag.band-tag { background: var(--ink); color: #fff; border-color: var(--ink); text-decoration: none; }
  nav button[data-tab=post] { display: none !important; }
  #profileDot { position: absolute; top: -3px; right: -3px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: #e0432a; color: #fff; font-size: 10.5px; line-height: 16px; font-weight: 700; text-align: center; border: 2px solid var(--ink); }
  #msgBadge, #actBadge { background: var(--accent); color: #fff; border-radius: 999px; padding: 1px 8px; font-size: 12px; margin-left: 6px; }
  main { max-width: 860px; margin: 0 auto; padding: 16px 20px 64px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(20,19,26,0.05); }
${MEDIA_CSS}
  .gig-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .gig-head strong { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 19px; font-weight: 700; }
  .gig-head .fee { margin-left: auto; font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-weight: 800; font-size: 20px; color: var(--accent); }
  .tag { display: inline-block; background: var(--paper); border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; font-size: 12.5px; color: var(--muted); }
  .tag.status-open { color: var(--ok); border-color: var(--ok); }
  .tag.status-booked, .tag.status-completed { color: var(--accent-deep); border-color: var(--accent-tint-line); background: var(--accent-tint); }
  .tag.status-cancelled, .tag.status-expired { color: var(--warn); border-color: var(--warn); }
  .muted { color: var(--muted); font-size: 14px; }
  h2 { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 18px; font-weight: 700; margin: 20px 0 10px; }
  form .row { margin-bottom: 12px; }
  label { display: block; font-size: 13.5px; font-weight: 600; margin-bottom: 5px; color: #3a382f; }
  input[type=text], input[type=email], input[type=password], input[type=date], input[type=time], input[type=number], textarea, select {
    width: 100%; padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; font: inherit; background: var(--card);
  }
  input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
  textarea { min-height: 90px; resize: vertical; }
  /* iOS Safari: date/time inputs keep an intrinsic width and ignore width:100%
     unless the native appearance is reset; grid cells must allow shrinking. */
  input[type=date], input[type=time] { -webkit-appearance: none; appearance: none; display: block; width: 100%; min-width: 0; max-width: 100%; min-height: 46px; }
  input[type=date]::-webkit-date-and-time-value, input[type=time]::-webkit-date-and-time-value { text-align: left; }
  .grid2 > *, .row, .place-wrap { min-width: 0; }
  .place-wrap input { width: 100%; max-width: 100%; }
  input, select, textarea { max-width: 100%; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .aud-cta { align-self: flex-start; }
  @media (max-width: 560px) { .grid2 { grid-template-columns: 1fr; } }
  /* Phones: header collapses to one row (logo · lang · bell · login/avatar);
     the section tabs become a fixed bottom bar with icons + short labels so
     nothing is hidden behind a sideways scroll. Profile lives behind the
     header avatar; its tab button is hidden from the bar. */
  @media (max-width: 380px) { header h1 { font-size: 24px !important; } }
  @media (max-width: 640px) {
    header { flex-wrap: nowrap; gap: 8px; padding: 12px 14px; }
    header h1 { font-size: 27px; letter-spacing: -0.6px; }
    header .tagline, header .who { display: none; }
    header #langSel { padding: 7px 26px 7px 11px; font-size: 13.5px; background-position: right 9px center; }
    header #notifBtn { padding: 7px 10px; min-width: 40px; justify-content: center; }
    header #notifBtn #notifLabel { display: none; }
    header #authBtn { padding: 7px 12px; white-space: nowrap; }
    body.authed header #authBtn { display: none; }
    body.authed #profileBtn { display: flex; }
    #profileBtn { width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.35); background: var(--accent); color: #fff; font: inherit; font-weight: 700; font-size: 15px; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
    .mobile-only { display: flex !important; }
    nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; max-width: none; margin: 0; padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); gap: 0;
      display: grid; grid-template-columns: repeat(5, 1fr); background: var(--card); border-top: 1px solid var(--line); box-shadow: 0 -4px 16px rgba(20,19,26,0.06); }
    nav button { border: 0; background: transparent; border-radius: 10px; padding: 5px 2px; min-height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 11px; font-weight: 500; color: var(--muted); position: relative; line-height: 1.1; }
    nav button svg { display: block; }
    nav button .lf { display: none; }
    nav button .ls { display: block; white-space: nowrap; }
    nav button.active { background: var(--accent-tint); color: var(--accent-deep); font-weight: 600; }
    nav button[data-tab=profile] { display: none; }
    nav #msgBadge, nav #actBadge { position: absolute; top: 4px; left: calc(50% + 6px); margin: 0; padding: 0 5px; min-width: 16px; height: 16px; font-size: 10.5px; line-height: 16px; }
    /* Tab bar is 63px tall (+ safe area); the footer's bottom padding hides
       under it exactly, and the waveform stands on the tab bar's top edge. */
    footer { padding-bottom: calc(63px + 28px + env(safe-area-inset-bottom)); margin-top: 32px; }
    footer .wave { bottom: calc(63px + env(safe-area-inset-bottom) - 2px); }
    .actions { flex-direction: column; }
    .actions > button { width: 100%; }
    .aud-cta { align-self: stretch; width: 100%; }
    #landing .cta-row { flex-direction: column; }
    #landing .cta-row > button { width: 100%; }
    .filters button.ghost, .filters button.primary { flex: 1 1 100%; }
  }
  button.primary { background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 10px; padding: 12px 20px; font: inherit; font-weight: 600; cursor: pointer; min-height: 46px; }
  button.primary:hover { background: var(--accent-deep); }
  button.ghost { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px 16px; font: inherit; color: inherit; cursor: pointer; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  button.small { padding: 7px 14px; font-size: 14px; min-height: 40px; }
  button.linkish { background: none; border: 0; padding: 0; font: inherit; font-size: inherit; color: var(--accent-deep); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .checks { display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .checks label { font-weight: 400; display: flex; align-items: center; gap: 5px; font-size: 14px; margin: 0; }
  .msg { padding: 10px 14px; border-radius: 10px; margin-bottom: 12px; font-size: 14.5px; display: none; }
  .msg.err { display: block; background: #fdecea; color: var(--warn); }
  .msg.ok { display: block; background: #e7f6ef; color: var(--ok); }
  .msg.warn { background: #fff6e0; color: #7a5200; border: 1px solid #f3dfae; }
  .msg.warn:not([hidden]) { display: flex !important; }
  /* The page-level toast floats above the content so confirmations are seen
     wherever the user is scrolled (e.g. the footer feedback form). */
  /* Floating toast in the backstage style: ink pill, icon disc, draining
     accent bar. Inline .msg boxes inside forms keep the flat look. */
  #flash { position: fixed; top: 14px; left: 50%; transform: translateX(-50%) translateY(-10px); z-index: 3000; margin: 0; max-width: min(92vw, 480px);
    display: flex !important; align-items: center; gap: 11px; padding: 10px 16px 10px 10px; border-radius: 14px; overflow: hidden;
    background-color: var(--ink); background-image: radial-gradient(circle at 88% -40%, rgba(100,64,251,0.45), transparent 60%);
    color: #fff; font-size: 14.5px; font-weight: 500; box-shadow: 0 14px 38px rgba(20,19,26,0.35);
    opacity: 0; pointer-events: none; transition: opacity 0.18s ease, transform 0.18s ease; }
  #flash.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  #flash .fi { flex: 0 0 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; }
  #flash.ok .fi { background: var(--ok); color: #fff; }
  #flash.err .fi { background: #e0524a; color: #fff; }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; align-items: stretch; }
  /* City typeahead (see attachPlaces) */
  .place-wrap { position: relative; }
  .filters .place-wrap { flex: 1 1 150px; display: flex; }
  .filters .place-wrap input { width: 100%; }
  .places { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 8px 24px rgba(20,19,26,0.12); max-height: 260px; overflow: auto; }
  .places div { padding: 10px 12px; cursor: pointer; display: flex; justify-content: space-between; gap: 8px; font-size: 14.5px; }
  .places div.on, .places div:hover { background: var(--accent-tint); }
  .places small { color: var(--muted); white-space: nowrap; }
  .place-hint { color: var(--warn); font-size: 13px; margin-top: 4px; }
  .install-step { display: flex; gap: 10px; align-items: baseline; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 15px; counter-increment: step; }
  .install-step::before { content: counter(step); flex: 0 0 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
  #installSteps { counter-reset: step; margin-bottom: 14px; }
  .step-icon { display: inline-flex; vertical-align: -4px; margin-left: 2px; color: var(--accent-deep); background: var(--accent-tint); border: 1px solid var(--accent-tint-line); border-radius: 6px; padding: 3px; }
  .filters select, .filters input { width: auto; flex: 1 1 150px; border-radius: 999px; padding: 8px 16px; min-height: 46px; color: inherit; }
  .filters select {
    appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2314131a' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 15px center; padding-right: 38px;
  }
  .filters #fRadius { flex: 0 1 auto; min-width: 106px; }
  .filters button.ghost, .filters button.primary { min-height: 46px; border-radius: 999px; }
  .filters button.busy { opacity: .6; }
  .board-summary { margin: 0 0 10px; font-size: 13.5px; }
  .card.musician { cursor: pointer; }
  .card.musician .mname { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 17px; font-weight: 700; color: inherit; text-decoration: none; }
  .card.musician .chips { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
  .tag.hot { color: var(--accent-deep); border-color: var(--accent-tint-line); background: var(--accent-tint); }
  .alerts-on-line { color: var(--ok); font-weight: 600; margin: 0 0 12px; }
  .seg { display: flex; background: #232230; border-radius: 12px; padding: 4px; gap: 4px; flex: 1 1 100%; max-width: 360px; }
  .msg-pill { display: inline-flex; align-items: center; gap: 6px; align-self: center; flex-shrink: 0; margin-left: auto; background: var(--accent-tint); color: var(--accent-deep); border: 1px solid var(--accent-tint-line); border-radius: 999px; padding: 6px 12px; min-height: 0; font: inherit; font-size: 13px; font-weight: 600; line-height: 1; cursor: pointer; width: auto; }
  .msg-pill:hover { background: var(--accent-tint-line); }
  .seg[hidden], .seg button[hidden] { display: none; }
  .seg button { flex: 1; border: 0; background: transparent; color: #b9b6c9; border-radius: 9px; padding: 10px 0; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; min-height: 42px; }
  .seg button.active { background: var(--accent); color: #fff; font-weight: 600; }
  .empty { text-align: center; padding: 36px 10px; color: var(--muted); }
  dialog { border: 0; box-shadow: 0 0 0 1px var(--line), 0 24px 48px rgba(20,19,26,0.25); border-radius: var(--r); padding: 20px; max-width: 420px; width: 92%; background: var(--card); background-clip: padding-box; overflow: auto; -webkit-mask-image: -webkit-radial-gradient(white, black); }
  dialog::backdrop { background: rgba(20,19,26,.5); }
  dialog { position: relative; }
  .dlg-x { position: absolute; top: 10px; right: 10px; width: 36px; height: 36px; border: 0; border-radius: 50%; background: transparent; color: var(--muted); font: inherit; font-size: 26px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .dlg-x:hover { background: var(--paper); color: #1b1a16; }
  dialog h2 { padding-right: 36px; }
  .application { border-top: 1px solid var(--line); padding-top: 12px; margin-top: 12px; }
  .thread { display: flex; align-items: center; gap: 12px; cursor: pointer; }
  .bubble { max-width: 80%; padding: 10px 14px; border-radius: 14px; margin-bottom: 8px; font-size: 14.5px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
  .bubble.mine { background: var(--accent-tint); border: 1px solid var(--accent-tint-line); margin-left: auto; border-bottom-right-radius: 4px; }
  .bubble.theirs { background: var(--card); border: 1px solid var(--line); margin-right: auto; border-bottom-left-radius: 4px; }
  .bubble time { display: block; font-size: 11px; color: var(--muted); margin-top: 3px; }
  .chat { display: flex; flex-direction: column; background: var(--paper); height: calc(100dvh - 190px); min-height: 420px; border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; }
  .chat-head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--card); border-bottom: 1px solid var(--line); }
  .chat-head .avatar { width: 36px; height: 36px; font-size: 14px; }
  .chat-head .who { flex: 1; min-width: 0; }
  .chat-head .who strong { display: block; font-size: 15.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chat-head .who span { font-size: 12.5px; color: var(--muted); }
  .chat-back { background: transparent; border: 0; font-size: 22px; line-height: 1; padding: 4px 6px; color: var(--ink); cursor: pointer; }
  .chat-log { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 14px 12px 6px; display: flex; flex-direction: column; }
  .chat-day { align-self: center; font-size: 11.5px; color: var(--muted); background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; margin: 8px 0 12px; }
  .bubble { max-width: 82%; padding: 9px 12px 7px; border-radius: 16px; margin-bottom: 4px; font-size: 15px; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
  .bubble.mine { background: var(--accent); color: #fff; margin-left: auto; border-bottom-right-radius: 5px; }
  .bubble.theirs { background: var(--card); border: 1px solid var(--line); margin-right: auto; border-bottom-left-radius: 5px; }
  .bubble time { display: block; font-size: 10.5px; opacity: .7; margin-top: 2px; text-align: right; }
  .bubble.mine time { color: #fff; }
  .bubble.theirs time { color: var(--muted); }
  .composer { display: flex; gap: 8px; align-items: flex-end; padding: 8px 10px calc(8px + env(safe-area-inset-bottom)); background: var(--card); border-top: 1px solid var(--line); }
  .composer textarea { flex: 1; min-height: 42px; max-height: 120px; resize: none; border-radius: 21px; padding: 10px 14px; margin: 0; }
  .composer .send { width: 42px; height: 42px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; min-height: 0; }
  .composer .send svg { display: block; }
  @media (max-width: 640px) {
    body.chat-open > header, body.chat-open > footer, body.chat-open #bgnotes { display: none !important; }
    body.chat-open main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
    body.chat-open #tab-msgs { padding: 0; }
    .chat { position: fixed; left: 0; right: 0; top: 0; bottom: calc(63px + env(safe-area-inset-bottom)); height: auto; min-height: 0; border: 0; border-radius: 0; z-index: 5; padding-top: env(safe-area-inset-top); }
  }
  .applicant-head { display: flex; align-items: center; gap: 10px; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; flex-shrink: 0; }
  .applicant-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: var(--muted); }
  .rating { color: var(--gold); font-weight: 600; }
</style>
</head>
<body>
${NOTES_LAYER}
<header>
  ${WAVE_SVG}
  <h1 id="logoHome">Jam<span>Werk</span></h1>
  <span class="tagline" style="color: rgba(255,255,255,0.55); font-size: 13.5px;" data-i18n="tagline">gigs · jams · bands</span>
  <span class="spacer"></span>
  <span class="who" id="who"></span>
  <button class="ghost small" id="howBtn" aria-label="How it works" title="How it works" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.35); width: 40px; min-width: 40px; padding: 7px 0; font-weight: 800; font-size: 17px; justify-content: center;">?</button>
  <select id="langSel" aria-label="Language">
    <option value="en">EN</option>
    <option value="fr">FR</option>
    <option value="de">DE</option>
    <option value="it">IT</option>
  </select>
  <button class="ghost small" id="notifBtn" hidden aria-label="Alerts" title="Alerts" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.35); display: flex; align-items: center; gap: 6px;">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path></svg>
    <span id="notifLabel" data-i18n="alerts">Alerts</span>
  </button>
  <button class="ghost small" id="authBtn" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.35);">Log in</button>
  <button id="profileBtn" hidden aria-label="Musician profile" title="Musician profile"></button>
</header>
<nav id="tabs">
  <button data-tab="musicians" class="active"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg><span class="lf" data-i18n="nav_musicians">Musicians</span><span class="ls" data-i18n="nav_musicians_s">Musicians</span></button>
  <button data-tab="bands"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="lf" data-i18n="nav_bands">Bands</span><span class="ls" data-i18n="nav_bands_s">Bands</span></button>
  <button data-tab="jams"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3zM16 14a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3z"/><path d="M3 14v-2a9 9 0 0 1 18 0v2"/></svg><span class="lf" data-i18n="nav_jams">Jams</span><span class="ls" data-i18n="nav_jams_s">Jams</span></button>
  <button data-tab="board"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><span class="lf" data-i18n="nav_board">Gig board</span><span class="ls" data-i18n="nav_board_s">Gigs</span></button>
  <button data-tab="msgs"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg><span class="lf" data-i18n="nav_msgs">Messages</span><span class="ls" data-i18n="nav_msgs_s">Messages</span><span id="msgBadge" hidden></span></button>
  <button data-tab="post"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg><span class="lf" data-i18n="nav_post">Post a gig</span><span class="ls" data-i18n="nav_post_s">Post</span></button>
  <button data-tab="profile"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="lf" data-i18n="nav_profile">Musician profile</span><span class="ls" data-i18n="nav_profile_s">Profile</span><span id="actBadge" class="nav-badge" hidden></span></button>
</nav>
<main>
  <div class="msg" id="flash"></div>

    <div id="landing" hidden>
      <div id="helpClose" style="align-items: center; gap: 10px; margin-bottom: 10px;"><button type="button" class="ghost small" id="helpBack">&larr; <span data-i18n="back">Back</span></button><span class="muted" data-i18n="help_title">Help</span></div>
      <div style="background-color: var(--ink); background-image: radial-gradient(circle at 85% -20%, rgba(100,64,251,0.45), transparent 60%); border-radius: 16px; padding: 34px 24px 40px; text-align: center; position: relative; z-index: 0; overflow: hidden; margin-bottom: 12px; color: #fff;">
        ${WAVE_SVG}
        <div class="display" style="font-size: 30px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; margin-bottom: 12px;" data-i18n="land_head">Find a dep. Fill a gig. Start a band.</div>
        <p style="max-width: 560px; margin: 0 auto 22px; color: rgba(255,255,255,0.72); font-size: 15px;" data-i18n="land_sub">JamWerk connects local musicians: paid gigs with public fees, free jam partners, and open band seats — matched to your instrument and your area.</p>
        <div class="cta-row" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button class="primary" id="ctaJoin" data-i18n="cta_join">Create your free profile</button>
          <button class="ghost" id="ctaPeople" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.4);" data-i18n="cta_people">See who's here</button>
          <button class="ghost" id="ctaBrowse" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.4);" data-i18n="cta_browse">Browse the board</button>
        </div>
        <p style="margin: 16px 0 0; color: #fff; font-weight: 700; font-size: 15px;" data-i18n="free_line">100% free for musicians — no fees, no commission.</p>
      </div>
      <div class="card help-ask" id="helpAsk1" hidden style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; border-color: var(--accent-tint-line); background: var(--accent-tint);">
        <div style="flex: 1; min-width: 200px;">
          <div class="display" style="font-size: 16px; font-weight: 700;" data-i18n="help_ask_t">A question? Something unclear?</div>
          <p class="muted" style="margin: 2px 0 0;" data-i18n="help_ask_p">Tell us what you were trying to do \u2014 we read every message and fix things fast.</p>
        </div>
        <button class="primary aud-cta help-ask-btn" data-i18n="help_ask_btn">Write to us</button>
      </div>
      <div class="grid2">
        <div class="card" style="display: flex; flex-direction: column;">
          <div class="display" style="font-size: 17px; font-weight: 700; margin-bottom: 6px;" data-i18n="aud_jam_t">Just here to jam?</div>
          <p class="muted" style="margin: 0 0 12px; flex: 1;" data-i18n="aud_jam_p">Practice listings are free and casual — no fees, no ratings, no pressure. Find people at your level, from beginners to weekend bands.</p>
          <button class="primary aud-cta" id="ctaJam" data-i18n="cta_jam">Find jam partners</button>
        </div>
        <div class="card" style="display: flex; flex-direction: column;">
          <div class="display" style="font-size: 17px; font-weight: 700; margin-bottom: 6px;" data-i18n="aud_pro_t">Working musician?</div>
          <p class="muted" style="margin: 0 0 12px; flex: 1;" data-i18n="aud_pro_p">Paid dep gigs with the fee stated up front, in CHF or EUR. Reviews from real completed gigs build a track record you can share.</p>
          <button class="primary aud-cta" id="ctaGigs" data-i18n="cta_gigs">See paid gigs</button>
        </div>
      </div>
      <div class="card" style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 220px;">
          <div class="display" style="font-size: 17px; font-weight: 700; margin-bottom: 6px;" data-i18n="aud_event_t">Organising an event?</div>
          <p class="muted" style="margin: 0;" data-i18n="aud_event_p">Bands list themselves with demos and a starting fee. Filter by genre and city, listen, and message the band directly.</p>
        </div>
        <button class="primary aud-cta" id="ctaHire" data-i18n="cta_hire">Book a band</button>
      </div>
      <div class="card" id="howSteps">
        <div class="display" style="font-size: 20px; font-weight: 800; margin-bottom: 12px;" data-i18n="how_it_works">How it works</div>
        <ol class="steps">
          <li><span class="num">1</span><div><b data-i18n="step1_t">Create your profile</b><span class="muted" data-i18n="step1_p">Your instrument, your city, what you're looking for. Free, two minutes.</span></div></li>
          <li><span class="num">2</span><div><b data-i18n="step2_t">Find people</b><span class="muted" data-i18n="step2_p">Musicians, bands, jam groups and paid gigs near you — the tabs at the bottom.</span></div></li>
          <li><span class="num">3</span><div><b data-i18n="step3_t">Write to them</b><span class="muted" data-i18n="step3_p">Messages stay in the app; alerts reach your phone. That's it.</span></div></li>
        </ol>
      </div>
      <div class="card" id="landTiles" style="display: flex; flex-direction: column; gap: 14px;">
        <div data-goto="musicians" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 800;">&#9834;</span>
          <span><b data-i18n="nav_musicians">nav_musicians</b><br><span class="muted" data-i18n="land_d_musicians">land_d_musicians</span></span>
        </div>
        <div data-goto="bands" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 800;">&#9835;</span>
          <span><b data-i18n="nav_bands">nav_bands</b><br><span class="muted" data-i18n="land_d_bands">land_d_bands</span></span>
        </div>
        <div data-goto="jams" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 800;">&#9836;</span>
          <span><b data-i18n="nav_jams">nav_jams</b><br><span class="muted" data-i18n="land_d_jams">land_d_jams</span></span>
        </div>
        <div data-goto="board" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 800;">&#9833;</span>
          <span><b data-i18n="nav_board">nav_board</b><br><span class="muted" data-i18n="land_d_board">land_d_board</span></span>
        </div>
        <div data-goto="msgs" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 800;">&#128172;</span>
          <span><b data-i18n="nav_msgs">nav_msgs</b><br><span class="muted" data-i18n="land_d_msgs">land_d_msgs</span></span>
        </div>
        <div data-goto="post" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 800;">+</span>
          <span><b data-i18n="nav_post">nav_post</b><br><span class="muted" data-i18n="land_d_post">land_d_post</span></span>
        </div>
        <div data-goto="profile" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 800;">&#9679;</span>
          <span><b data-i18n="nav_profile">nav_profile</b><br><span class="muted" data-i18n="land_d_profile">land_d_profile</span></span>
        </div>
      </div>
      <div class="card" style="display: flex; align-items: center; gap: 12px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6440fb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path></svg>
        <p class="muted" style="margin: 0;" data-i18n="land_alerts">Tap the bell after signing up — gigs for your instrument near you reach your phone the moment they are posted.</p>
      </div>
      <div class="card help-ask" id="helpAsk2" hidden style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; border-color: var(--accent-tint-line); background: var(--accent-tint);">
        <div style="flex: 1; min-width: 200px;">
          <div class="display" style="font-size: 16px; font-weight: 700;" data-i18n="help_ask_t">A question? Something unclear?</div>
          <p class="muted" style="margin: 2px 0 0;" data-i18n="help_ask_p">Tell us what you were trying to do \u2014 we read every message and fix things fast.</p>
        </div>
        <button class="primary aud-cta help-ask-btn" data-i18n="help_ask_btn">Write to us</button>
      </div>
    </div>
  <section id="tab-musicians">
    <div class="card onboard" id="onboard" hidden>
      <div class="display" style="font-size: 17px; font-weight: 700; margin-bottom: 10px;" data-i18n="onboard_t">Two things and you're set</div>
      <ol>
        <li><span class="tick" id="ob1t">1</span><span class="txt" id="ob1x" data-i18n="onboard_1">Add your instrument and your city</span><button class="ghost small" id="ob1b" data-i18n="onboard_1b">Do it</button></li>
        <li><span class="tick" id="ob2t">2</span><span class="txt" id="ob2x" data-i18n="onboard_2">Turn on alerts</span><button class="ghost small" id="ob2b" data-i18n="onboard_2b">Turn on</button></li>
        <li><span class="tick" id="ob3t">3</span><span class="txt" data-i18n="onboard_3">That's it — we ping you when someone needs you.</span></li>
      </ol>
    </div>
    <div id="musiciansHost"></div>
  </section>

  <section id="tab-board" hidden>
    <div class="card" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 200px;">
        <div class="display" style="font-size: 17px; font-weight: 700;" data-i18n="board_intro_t">Paid gigs</div>
        <p class="muted" style="margin: 4px 0 0;" data-i18n="board_intro_p">Dep gigs with the fee stated up front, in CHF or EUR. Need someone? Post a gig and the right musicians get alerted.</p>
      </div>
      <button class="primary aud-cta" id="postGigBtn" data-i18n="post_gig_cta">Post a gig</button>
    </div>
    <div id="boardHost">
    <div class="filters">
      <div class="seg" id="kindSeg">
        <button type="button" data-kind="gig" data-group="board" class="active" data-i18n="seg_gigs">Paid gigs</button>
        <button type="button" data-kind="musicians" data-group="musicians" data-i18n="seg_musicians">Musicians</button>
        <button type="button" data-kind="practice" data-group="jams" data-i18n="seg_practice">Practice partners</button>
        <button type="button" data-kind="jamgroups" data-group="jams" data-i18n="seg_jam_groups">Jam groups</button>
      </div>
      <select id="fInstrument"><option value="" data-i18n="all_instruments">All instruments</option></select>
      <input type="text" id="fCity" placeholder="City" data-i18n-ph="ph_city">
      <select id="fRadius">
        <option value="5">5 km</option>
        <option value="10">10 km</option>
        <option value="15">15 km</option>
        <option value="25">25 km</option>
        <option value="50" selected>50 km</option>
        <option value="75">75 km</option>
        <option value="100">100 km</option>
      </select>
      <button class="primary" id="fGo"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align: -3px; margin-right: 6px;"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span data-i18n="btn_filter">Search</span></button>
    </div>
    <div id="board"></div>
    </div>
  </section>

  <section id="tab-jams" hidden>
    <div class="card" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 200px;">
        <div class="display" style="font-size: 17px; font-weight: 700;" data-i18n="jams_intro_t">Play for the fun of it</div>
        <p class="muted" style="margin: 4px 0 0;" data-i18n="jams_intro_p">Free and casual: people looking for someone to jam with, and groups that meet regularly to play. No fees, no ratings.</p>
      </div>
      <div class="actions" style="display: flex; gap: 8px; flex-wrap: wrap;"><button class="primary aud-cta" id="postJamBtn" data-i18n="post_jam_cta">Post a jam listing</button><button class="ghost aud-cta" id="jamListBtn" data-i18n="jam_list_group">List a jam group</button></div>
    </div>
    <div id="jamsHost"></div>
  </section>

  <section id="tab-post" hidden>
    <div class="msg warn" id="confirmBanner" hidden style="display: none; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;">
      <span data-i18n="confirm_needed">Confirm your email address to post paid gigs — check your inbox (and spam folder).</span>
      <button type="button" class="ghost small" id="resendConfirmBtn" data-i18n="resend_confirm">Resend the email</button>
    </div>
    <div class="card"><form id="postForm">
      <div id="postHead" style="margin-bottom: 14px;">
        <div class="display" id="postTitle" style="font-size: 20px; font-weight: 800;"></div>
        <p class="muted" id="postSub" style="margin: 4px 0 0;"></p>
        <button type="button" id="postSwitch" hidden></button>
      </div>
      <div class="row" id="pKindRow" hidden><label data-i18n="listing_type">Listing type</label>
        <select id="pKind">
          <option value="gig" data-i18n="opt_gig">Paid gig — dated, fixed fee</option>
          <option value="practice" data-i18n="opt_practice">Practice partner — free, open-ended</option>
        </select>
      </div>
      <div class="row" id="pNeedRow"><label data-i18n="need_l">What do you need?</label>
        <div class="checks" style="flex-direction: column; gap: 8px;">
          <label style="align-items: flex-start;"><input type="radio" name="pNeed" value="dep" checked style="margin-top: 4px;"> <span><b data-i18n="need_dep_t">A replacement</b><br><span class="muted" data-i18n="need_dep_p">I need someone on that date. Matching musicians nearby get alerted now.</span></span></label>
          <label style="align-items: flex-start;"><input type="radio" name="pNeed" value="standby" style="margin-top: 4px;"> <span><b data-i18n="need_standby_t">A standby</b><br><span class="muted" data-i18n="need_standby_p">I have my musician, I want a plan B. Keep people on standby; if someone drops out, one tap alerts them and the first to say yes is booked.</span></span></label>
        </div>
      </div>
      <div class="grid2">
        <div class="row"><label data-i18n="instrument_needed">Instrument needed</label><select id="pInstrument" required></select></div>
        <div class="row" id="pDateRow"><label data-i18n="date">Date</label><input type="date" id="pDate" required></div>
        <div class="row"><label data-i18n="city">City</label><input type="text" id="pCity" required placeholder="Genève" data-i18n-ph="ph_city_ex"></div>
        <div class="row" id="pFeeRow"><label data-i18n="fee">Fee (whole gig)</label>
          <div style="display: flex; gap: 8px;"><select id="pCurrency" style="width: auto; flex: 0 0 auto;" aria-label="Currency"><option value="CHF">CHF</option><option value="EUR">EUR</option></select><input type="number" id="pFee" min="1" required placeholder="300" style="flex: 1;"></div>
        </div>
        <div class="row" id="pCallRow"><label data-i18n="call_time">Call time</label><input type="time" id="pCall"></div>
        <div class="row" id="pEndRow"><label data-i18n="end_time">End time</label><input type="time" id="pEnd"></div>
      </div>
      <div class="row"><label data-i18n="genres_l">Genres</label><div class="checks" id="pGenres"></div></div>
      <div class="row"><label data-i18n="description">Description</label><textarea id="pDesc" required placeholder="Two 45-min sets, charts provided, backline on site…" data-i18n-ph="ph_desc"></textarea></div>
      <div class="row" id="pLevelRow" hidden><label data-i18n="whos_welcome">Who&#8217;s welcome</label>
        <select id="pLevel">
          <option value="any" data-i18n="lvl_any">anyone welcome</option>
          <option value="hobby" data-i18n="lvl_hobby">hobby</option>
          <option value="semi_pro" data-i18n="lvl_semi">semi-pro</option>
          <option value="pro" data-i18n="lvl_pro">pro</option>
        </select>
      </div>
      <div class="row checks">
        <label><input type="checkbox" id="pCharts"> <span data-i18n="req_charts">must read charts</span></label>
        <label><input type="checkbox" id="pRehearsal"> <span data-i18n="req_rehearsal">one rehearsal</span></label>
      </div>
      <button class="primary" data-i18n="post_gig_btn">Post gig</button>
      <div class="ask-line"><span data-i18n="ask_missing_field">A field missing for your case?</span> <button type="button" class="ask-open" data-fb="post" data-i18n="ask_btn">Tell us</button></div>
      <p class="muted" style="margin: 14px 0 0;"><span data-i18n="missing_q">Missing an instrument, a genre or an option?</span> <button type="button" class="linkish" data-fb="post" data-i18n="tell_us">Tell us →</button></p>
    </form></div>
  </section>

  <section id="tab-msgs" hidden><div id="msgArea"></div></section>

  <section id="tab-bands" hidden>
    <div class="card" id="bandIntro" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 200px;">
        <div class="display" style="font-size: 17px; font-weight: 700;" data-i18n="band_intro_t">Bands &amp; jam groups</div>
        <p class="muted" style="margin: 4px 0 0;" data-i18n="band_intro_p">Bands announce themselves here with demos and a fee — book one for your event, ask for an open seat, or find a jam group at your level.</p>
      </div>
      <button class="primary aud-cta" id="bandNewBtn" data-i18n="list_my_band">List my band</button>
    </div>
    <div class="card" id="bandFormCard" hidden><form id="bandForm">
      <div class="row"><label data-i18n="band_kind_l">What is it?</label>
        <div class="checks">
          <label><input type="radio" name="bKind" value="band" checked> <span data-i18n="kind_band">A band — we play concerts and events</span></label>
          <label><input type="radio" name="bKind" value="jam"> <span data-i18n="kind_jam">A jam / practice group — we meet to play, no bookings</span></label>
        </div>
      </div>
      <div class="grid2">
        <div class="row"><label data-i18n="band_name">Band name</label><input type="text" id="bName" required maxlength="80"></div>
        <div class="row"><label data-i18n="city">City</label><input type="text" id="bCity" placeholder="Genève" data-i18n-ph="ph_city_ex"></div>
      </div>
      <div class="row"><label data-i18n="genres_l">Genres</label><div class="checks" id="bGenres"></div></div>
      <div class="row" id="bBookRow"><label style="display: flex; gap: 8px; align-items: flex-start; font-weight: 600; margin: 0;"><input type="checkbox" id="bBookable" style="margin-top: 4px;"> <span data-i18n="bookable_l">Available for events — weddings, parties, corporate (people can book us)</span></label></div>
      <div id="bBookFields" hidden>
        <div class="grid2">
          <div class="row"><label data-i18n="fee_from_l">Fee from (whole band, one evening)</label>
            <div style="display: flex; gap: 8px;"><select id="bCur" style="width: auto;"><option value="CHF">CHF</option><option value="EUR">EUR</option></select><input type="number" id="bFee" min="1" max="100000" step="1" placeholder="1200" style="flex: 1; min-width: 0;"></div></div>
          <div class="row"><label data-i18n="pitch_l">One-line pitch (shown on the card)</label><input type="text" id="bPitch" maxlength="160" data-i18n-ph="pitch_ph" placeholder="5-piece soul & funk band, 3 sets, own PA"></div>
        </div>
      </div>
      <div class="row"><label data-i18n="description">Description</label><textarea id="bDesc"></textarea></div>
      <div class="row"><label data-i18n="links_l">Links — YouTube, Spotify, SoundCloud, Vimeo, Bandcamp… (one per line, max 5)</label><textarea id="bLinks" rows="3" placeholder="https://open.spotify.com/artist/…&#10;https://youtube.com/watch?v=…"></textarea></div>
      <div class="row" id="bSeatsRow"><label data-i18n="seats_l">Open seats (choose instruments)</label><div class="checks" id="bSeats"></div></div>
      <div class="actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="primary" id="bandSubmit" data-i18n="start_band">Start a band</button>
        <button type="button" class="ghost" id="bandCancel" data-i18n="cancel">Cancel</button>
      </div>
    </form></div>
    <div class="filters">
      <div class="seg" id="bandSeg">
        <button type="button" data-bkind="" class="active" data-i18n="seg_all_bands">All</button>
        <button type="button" data-bkind="bookable" data-i18n="seg_bookable">Bookable</button>
      </div>
      <select id="bGenreF"><option value="" data-i18n="all_genres">All genres</option></select>
      <input type="text" id="bCityF" placeholder="City" data-i18n-ph="ph_city">
      <select id="bRadiusF">
        <option value="10">10 km</option>
        <option value="25">25 km</option>
        <option value="50" selected>50 km</option>
        <option value="100">100 km</option>
        <option value="200">200 km</option>
      </select>
      <button class="primary" id="bGo"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align: -3px; margin-right: 6px;"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span data-i18n="btn_filter">Search</span></button>
    </div>
    <div class="board-summary" id="bandSummary" hidden></div>
    <div id="bandsList"></div>
  </section>

  <section id="tab-profile" hidden>
    <div id="profileView">
      <div class="card profile-hero">
        <div class="avatar" id="heroAvatar"></div>
        <div class="who">
          <div class="display" id="heroName" style="font-size: 22px; font-weight: 800; letter-spacing: -0.3px;"></div>
          <div class="muted" id="heroMeta"></div>
          <div class="muted" id="heroStats" style="font-size: 13px;"></div>
        </div>
        <div class="actions hero-actions">
          <button class="primary" id="editProfileBtn" data-i18n="edit_profile">Edit profile</button>
          <a id="mPublic" target="_blank" rel="noopener" hidden data-i18n="public_page">View my public page &#8599;</a>
        </div>
      </div>
      <div class="card" id="activityCard">
        <div class="display" style="font-size: 17px; font-weight: 700;" data-i18n="my_activity">My activity</div>
        <p class="muted" id="activitySummary" style="margin: 4px 0 10px;" data-i18n="activity_hint">Gigs you posted, applications you sent, reviews to leave.</p>
        <div id="activityRecent" class="recent"></div>
        <div id="mine" hidden style="margin-top: 8px;"></div>
        <button class="ghost small accent" id="activityBtn" data-i18n="activity_open" style="margin-top: 10px;">Show all</button>
      </div>
      <div class="card" id="blocksCard" hidden>
        <div class="display" style="font-size: 15px; font-weight: 700; margin-bottom: 6px;" data-i18n="blocked_h">Blocked people</div>
        <div id="blocksList" style="display: flex; flex-direction: column; gap: 6px;"></div>
      </div>
      <div class="card settings">
        <label class="srow"><span data-i18n="s_lang">Language</span><select id="langSel2" aria-label="Language"><option value="en">English</option><option value="fr">Fran&ccedil;ais</option><option value="de">Deutsch</option><option value="it">Italiano</option></select></label>
        <button type="button" class="srow" id="sAlerts"><span data-i18n="alerts">Alerts</span><span class="val" id="sAlertsVal"></span></button>
        <button type="button" class="srow" id="sHow"><span data-i18n="how_it_works">How it works</span><span class="val">&rsaquo;</span></button>
        <button type="button" class="srow" id="sFeedback"><span data-i18n="feedback">Feedback</span><span class="val">&rsaquo;</span></button>
        <button type="button" class="srow" id="sInstall"><span data-i18n="install_link">Add to Home Screen</span><span class="val">&rsaquo;</span></button>
      </div>
      <button type="button" class="logout" id="logoutBtn2" data-i18n="logout">Log out</button>
      <div class="ask-line"><span data-i18n="ask_missing">Something missing or unclear?</span> <button type="button" class="ask-open" data-i18n="ask_btn">Tell us</button></div>
    </div>
    <div id="profileEdit" hidden>
    <div class="card" style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;"><button type="button" class="chat-back" id="editBack">&larr;</button><div class="display" style="font-size: 18px; font-weight: 800;" data-i18n="edit_profile">Edit profile</div></div>
    <div class="card"><form id="profileForm">
      <div class="row" style="display: flex; align-items: center; gap: 14px;">
        <div class="avatar" id="photoPreview" style="width: 72px; height: 72px; font-size: 26px; overflow: hidden;"></div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label data-i18n="photo_l" style="margin: 0;">Profile photo</label>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="ghost small" id="photoPick" data-i18n="photo_pick">Choose a photo</button>
            <button type="button" class="ghost small" id="photoRemove" hidden data-i18n="photo_remove">Remove</button>
          </div>
          <span class="muted" style="font-size: 12.5px;" data-i18n="photo_hint">Shown to bandleaders on your applications and on your public page.</span>
          <input type="file" id="photoFile" accept="image/*" hidden>
        </div>
      </div>
      <div class="row"><label data-i18n="instruments_l">Instruments</label><div class="checks" id="mInstruments"></div></div>
      <p class="muted" style="margin: -6px 0 12px;"><span data-i18n="missing_inst_q">Your instrument isn't listed?</span> <button type="button" class="linkish" data-fb="profile" data-i18n="tell_us">Tell us →</button></p>
      <div class="row"><label data-i18n="genres_l">Genres</label><div class="checks" id="mGenres"></div></div>
      <div class="grid2">
        <div class="row"><label data-i18n="home_city">Home city</label><input type="text" id="mCity" placeholder="Genève" data-i18n-ph="ph_city_ex"></div>
        <div class="row"><label data-i18n="radius">Travel radius (km)</label><input type="number" id="mRadius" value="30" min="1" max="300"></div>
      </div>
      <div class="row"><label data-i18n="lvl_label">Experience level</label>
        <select id="mLevel">
          <option value="">—</option>
          <option value="hobby" data-i18n="lvl_hobby">hobby</option>
          <option value="semi_pro" data-i18n="lvl_semi">semi-pro</option>
          <option value="pro" data-i18n="lvl_pro">pro</option>
        </select>
      </div>
      <div class="row"><label data-i18n="looking_l">I'm looking for</label>
        <div class="checks" id="mLooking">
          <label style="align-items: flex-start;"><input type="checkbox" value="dep" style="margin-top: 4px;"> <span id="lfDepText"></span></label>
          <label><input type="checkbox" value="jam"> <span data-i18n="lf_jam">jam partners</span></label>
          <label><input type="checkbox" value="join_band"> <span data-i18n="lf_join_band">to join a band</span></label>
          <label><input type="checkbox" value="start_band"> <span data-i18n="lf_start_band">to start a band</span></label>
        </div>
      </div>
      <div class="row checks"><label><input type="checkbox" id="mDm" checked> <span data-i18n="dm_accept_l">Other musicians can send me direct messages</span></label></div>
      <div class="row checks">
        <label><input type="checkbox" id="mCharts"> <span data-i18n="reads_charts">reads charts</span></label>
        <label><input type="checkbox" id="mBacking"> <span data-i18n="backing">backing vocals</span></label>
        <label><input type="checkbox" id="mTransport"> <span data-i18n="transport">own transport</span></label>
        <label><input type="checkbox" id="mPa"> <span data-i18n="own_pa">own PA</span></label>
      </div>
      <div class="row"><label data-i18n="demo_links_l">Demo links (one per line, max 5)</label><textarea id="mDemos" placeholder="https://youtube.com/watch?v=…&#10;https://open.spotify.com/track/…&#10;https://soundcloud.com/…"></textarea></div>
      <div class="actions" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <button class="primary" data-i18n="save_profile">Save profile</button>
        <button type="button" class="ghost" id="editCancel" data-i18n="cancel">Cancel</button>
      </div>
    </form></div>
    </div>
  </section>
</main>

<footer>
  ${WAVE_SVG}
  <div class="inner">
    <span class="brand" id="footLogo">Jam<span>Werk</span></span>
    <span class="flinks">
      <button type="button" id="footFeedback" data-i18n="feedback">Feedback</button>
      <button type="button" id="footHow" data-i18n="how_it_works">How it works</button>
      <a id="footAbout" href="/about" data-i18n="about_link">About</a>
      <button type="button" id="footInstall" data-i18n="install_link">Install the app</button>
    </span>
    <span class="copy">&copy; 2026 JamWerk</span>
  </div>
</footer>

<dialog id="authDialog">
  <button type="button" class="dlg-x" id="authClose" aria-label="Close" title="Close">&times;</button>
  <form id="authForm">
    <h2 id="authTitle" style="margin-top:0">Log in</h2>
    <div class="msg" id="authMsg"></div>
    <div class="row"><label data-i18n="email">Email</label><input type="email" id="aEmail" required autocomplete="username"></div>
    <div class="row"><label data-i18n="password">Password</label><input type="password" id="aPassword" required minlength="8" autocomplete="current-password"></div>
    <div class="row" id="aPw2Row" hidden><label data-i18n="password2">Repeat password</label><input type="password" id="aPassword2" minlength="8" autocomplete="new-password"></div>
    <div class="row" id="aNameRow" hidden><label data-i18n="name_label">Name (shown to bandleaders)</label><input type="text" id="aName"></div>
    <div class="row" id="tsAuthRow" hidden><div id="tsAuth"></div></div>
    <div class="row" id="aTermsRow" hidden><label style="display: flex; gap: 8px; align-items: flex-start; font-weight: 400;"><input type="checkbox" id="aTerms" style="margin-top: 4px;"> <span id="aTermsText"></span></label></div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px;">
      <button class="primary" id="authSubmit">Log in</button>
      <button type="button" class="ghost" id="authSwitch">Need an account? Register</button>
      <button type="button" class="ghost" id="authForgot" data-i18n="forgot">Forgot password?</button>
    </div>
  </form>
</dialog>

<dialog id="installDialog">
  <button type="button" class="dlg-x" id="installClose" aria-label="Close" title="Close">&times;</button>
  <h2 style="margin-top: 0;" data-i18n="install_t">Install JamWerk</h2>
  <p class="muted" style="margin-top: 0;" data-i18n="install_sub">Free, no App Store needed — and gig alerts work from the installed app.</p>
  <div id="installSteps"></div>
  <button type="button" class="primary" id="installNative" hidden data-i18n="install_now">Install now</button>
</dialog>
<dialog id="fbDialog">
  <button type="button" class="dlg-x" id="fbClose" aria-label="Close" title="Close">&times;</button>
  <form id="fbForm">
    <h2 style="margin-top:0" data-i18n="feedback">Feedback</h2>
    <div class="msg" id="fbMsg"></div>
    <div class="row"><label data-i18n="fb_label">What should we improve?</label><textarea id="fbBody" required minlength="5" maxlength="2000" rows="5"></textarea></div>
    <div class="row" id="fbEmailRow"><label data-i18n="fb_email_label">Your email (optional, if you want a reply)</label><input type="email" id="fbEmail"></div>
    <div class="row"><div id="tsFb"></div></div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px;">
      <button class="primary" data-i18n="fb_send">Send</button>
    </div>
  </form>
  <div id="fbDone" hidden style="text-align: center; padding: 20px 8px 10px;">
    <div style="width: 58px; height: 58px; border-radius: 50%; background: #e7f6ef; color: var(--ok); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
    </div>
    <div class="display" style="font-size: 19px; font-weight: 700; margin-bottom: 6px;" data-i18n="fb_sent_t">Message sent</div>
    <p class="muted" style="margin: 0 0 18px;" data-i18n="fb_thanks">Thanks — your feedback reached us.</p>
    <button type="button" class="primary" id="fbDoneClose" data-i18n="close">Close</button>
  </div>
</dialog>

<script>
const $ = (id) => document.getElementById(id);
const GENRES = ${JSON.stringify(GENRES)};
const GENRE_LABELS = ${JSON.stringify(GENRE_LABELS)};
const INSTRUMENTS = ['vocals','guitar','bass','double_bass','drums','percussion','keys','piano','accordion','violin','viola','cello','trumpet','trombone','saxophone','clarinet','flute','harmonica','cavaquinho','dj','other'];
const I18N = {
  en: {
    nav_board_s: 'Gigs', nav_post_s: 'Post', nav_mine_s: 'My gigs', nav_bands_s: 'Bands', nav_msgs_s: 'Messages', nav_profile_s: 'Profile', nav_board: 'Gig board',
    nav_msgs: 'Messages', msg_btn: 'Message', msg_send: 'Send', msg_sent: 'Message sent.', msg_placeholder: 'Write a message\u2026', no_threads: 'No conversations yet — they start from an application.', thread_empty: 'No messages yet — say hello.', back: 'Back',
    cta_jam: 'Find jam partners', cta_gigs: 'See paid gigs', land_d_board: 'Paid dep gigs near you with the fee stated up front, in CHF or EUR. Apply with your profile.', land_d_post: 'Need a dep or a jam partner? Post in two minutes \u2014 matching musicians get alerted. Bands and jam groups list themselves under Bands / Jams.', land_d_mine: 'Track your posts and applications, book musicians, leave reviews after the gig.', land_d_bands: 'Bands present themselves with demos and a starting fee: book one for your event, or apply for an open seat.', land_d_profile: 'Your photo, instruments, demos and reviews \u2014 plus a public page to share anywhere.',
    how_it_works: 'How it works', tagline: 'gigs · jams · bands', feedback: 'Feedback', fb_label: 'What should we improve?', fb_email_label: 'Your email (optional, if you want a reply)', fb_send: 'Send', fb_sent_t: 'Message sent', fb_thanks: 'Thanks — your feedback reached us.', missing_q: 'Missing an instrument, a genre or an option?', missing_inst_q: 'Your instrument isn\u2019t listed?', tell_us: 'Tell us \u2192', fb_prefill_post: 'Posting a gig — missing: ', fb_prefill_profile: 'My profile — missing instrument: ', fb_fail: 'Could not send feedback', welcome_profile: 'Welcome aboard! We sent you a confirmation email — if it is not in your inbox, check the spam folder. Then set up your musician profile — it is what lets you apply to gigs and jams.',
    land_head: 'Find a dep. Join a jam. Start a band.', land_sub: 'JamWerk connects local musicians: find people by instrument and city, join or book a band, find a jam group, take paid dep gigs with the fee shown up front \u2014 and message each other inside the app.', land_s1: 'Create your free musician profile: instruments, city, travel radius.', land_s2: 'Browse or post: paid gigs, jam sessions, band seats. Turn on alerts and matches reach your phone.', land_s3: 'Book or connect. Completed gigs earn reviews that build your public track record.', aud_jam_t: 'Just here to jam?', aud_jam_p: 'Practice listings are free and casual — no fees, no ratings, no pressure. Find people at your level, from beginners to weekend bands.', aud_pro_t: 'Working musician?', aud_pro_p: 'Paid dep gigs with the fee stated up front, in CHF or EUR. Reviews from real completed gigs build a track record you can share.', land_alerts: 'Tap the bell after signing up — gigs for your instrument near you reach your phone the moment they are posted.', cta_join: 'Create your free profile', cta_browse: 'Browse the board', lvl_label: 'Experience level', whos_welcome: 'Who\u2019s welcome', lvl_any: 'anyone welcome', lvl_hobby: 'hobby', lvl_semi: 'semi-pro', lvl_pro: 'pro',
    save_band: 'Save changes',
    band_intro_t: 'Bands & jam groups', band_intro_p: 'Bands announce themselves here with demos and a fee \u2014 book one for your event, ask for an open seat, or find a jam group at your level.', list_my_band: 'List my band', band_kind_l: 'What is it?', kind_band: 'A band \u2014 we play concerts and events', kind_jam: 'A jam / practice group \u2014 we meet to play, no bookings', bookable_l: 'Available for events \u2014 weddings, parties, corporate (people can book us)', fee_from_l: 'Fee from (whole band, one evening)', pitch_l: 'One-line pitch (shown on the card)', pitch_ph: '5-piece soul & funk band, 3 sets, own PA', cancel: 'Cancel', edit: 'Edit', band_saved: 'Band updated.', seg_all_bands: 'All', seg_bookable: 'Bookable', seg_jamgroups: 'Jam groups', ph_genre: 'Genre', bands_n: '{0} bands', no_bands_near: 'No bands match yet \u2014 list yours and be the first.', from_fee: 'from {0}', fee_on_request: 'fee on request', book_band: 'Book this band', contact_band: 'Contact the band', jam_group: 'jam group', ask_to_join: 'Ask to join', inquiry_prompt: 'Your message to the band \u2014 date, place, type of event, budget:', inquiry_sent: 'Message sent \u2014 the band will answer here in Messages.', confirm_to_contact: 'Confirm your email address before contacting a band \u2014 check your inbox.', view_band_page: 'Band page \u2197', aud_event_t: 'Organising an event?', aud_event_p: 'Bands list themselves with demos and a starting fee. Filter by genre and city, listen, and message the band directly.', cta_hire: 'Book a band',
    nav_jams: 'Jams', nav_jams_s: 'Jams', seg_jam_groups: 'Jam groups', jams_intro_t: 'Play for the fun of it', jams_intro_p: 'Free and casual: people looking for someone to jam with, and groups that meet regularly to play. No fees, no ratings.', jam_list_group: 'List a jam group', my_activity: 'My activity', activity_hint: 'Gigs you posted, applications you sent, reviews to leave.', activity_open: 'Show all', activity_close: 'Show less', activity_pending: '{0} waiting for you', dm_btn: 'Message', dm_prompt: 'Your message:', dm_sent: 'Message sent.', dm_ctx: 'Direct message', dm_closed: 'This musician does not accept direct messages.', dm_accept_l: 'Other musicians can send me direct messages', no_jam_groups: 'No jam groups yet \u2014 list yours and be the first.', jam_groups_n: '{0} jam groups',
    block: 'Block', unblock: 'Unblock', block_confirm: 'Block {0}? They will no longer be able to message you, and this conversation disappears from your list.', blocked_ok: 'Blocked.', unblocked_ok: 'Unblocked.', blocked_h: 'Blocked people', blocked_msg: 'You cannot message this person.', compose_hint: 'Say hello to {0} \u2014 the date, the place, what you have in mind.', inquiry_ctx: 'Booking request',
    nav_musicians: 'Musicians', nav_musicians_s: 'Musicians', board_intro_t: 'Paid gigs', board_intro_p: 'Dep gigs with the fee stated up front, in CHF or EUR. Need someone? Post a gig and the right musicians get alerted.', post_gig_cta: 'Post a gig', post_jam_cta: 'Post a jam listing', by_poster: 'by {0}',
    today: 'Today', yesterday: 'Yesterday',
    step1_t: 'Create your profile', step1_p: 'Your instrument, your city, what you\u2019re looking for. Free, two minutes.', step2_t: 'Find people', step2_p: 'Musicians, bands, jam groups and paid gigs near you \u2014 the tabs at the bottom.', step3_t: 'Write to them', step3_p: 'Messages stay in the app; alerts reach your phone. That\u2019s it.',
    free_line: '100% free for musicians \u2014 no fees, no commission.',
    land_d_musicians: 'Everyone on JamWerk, by instrument, level and city \u2014 with the groups they play in. Send a message in one tap.',
    land_d_jams: 'Free and casual: people who want to jam, and groups that meet regularly. Ask to join.',
    land_d_msgs: 'All conversations in one place \u2014 direct messages, applications, booking requests. Alerts on your phone.',
    genres_l: 'Genres', all_genres: 'All genres',
    post_gig_title: 'Post a paid gig', post_jam_title: 'Post a jam listing \u2014 free', switch_to_gig: 'Post a paid gig instead', switch_to_jam: 'Post a jam listing instead',
    edit_profile: 'Edit profile', s_lang: 'Language', alerts_state_on: 'On', alerts_state_off: 'Off', profile_incomplete: 'Your profile is empty \u2014 add your instruments and city so people can find you.', gig_short: 'Gig', application_short: 'Application',
    help_ask_t: 'A question? Something unclear?', help_ask_p: 'Tell us what you were trying to do \u2014 we read every message and fix things fast.', help_ask_btn: 'Write to us',
    about_link: 'About', help_title: 'Help', dm_self: 'That is your own profile.',
    post_gig_sub: 'You need a musician for a specific date \u2014 a last-minute replacement or an extra player. The fee is shown up front, and matching musicians near you are alerted.', post_jam_sub: 'Free and without a fixed date: you are looking for someone to play with, regularly or for a session. No fee, no ratings.',
    need_l: 'What do you need?', need_dep_t: 'A replacement', need_dep_p: 'I need someone on that date. Matching musicians nearby are alerted now.', need_standby_t: 'A standby', need_standby_p: 'I have my musician, I want a plan B. Keep people on standby; if someone drops out, one tap alerts them and the first to say yes is booked.', tag_urgent: 'Last minute', tag_standby: 'Standby', btn_available: 'I\u2019m available', btn_standby: 'I can be on standby', btn_jam_in: 'I\u2019m in', btn_yes_coming: 'Yes, I\u2019m coming', state_sent: 'Sent \u2014 the bandleader will answer you in Messages', state_standby: 'You\u2019re on standby \u2014 we ping you only if needed', state_booked: 'You\u2019re booked', state_declined: 'Not this time', standby_now: 'They need you! First to confirm gets the gig.', confirmed_ok: 'Confirmed \u2014 you\u2019re booked. Details in Messages.', taken: 'Someone confirmed before you \u2014 thanks anyway.', keep_standby: 'Keep on standby', kept_standby: '{0} is on standby.', standby_ready: '{0} on standby. If your musician drops out, alert them here.', activate_standby: 'My musician dropped out', activate_confirm: 'Confirm \u2014 alert {0} standby musician(s)', standby_alerted: 'Standby alerted ({0}). The first to confirm is booked automatically.', standby_pinged: '{0} musician(s) alerted.', lf_dep_dyn: 'Alert me when someone needs {ins} within {km} km of {city} \u2014 even at the last minute.', your_instrument: 'my instrument', your_city: 'my city', onboard_t: 'Two things and you\u2019re set', onboard_1: 'Add your instrument and your city', onboard_1b: 'Do it', onboard_2: 'Turn on alerts', onboard_2b: 'Turn on', onboard_3: 'That\u2019s it \u2014 we ping you when someone needs you.',
    ask_missing: 'Something missing or unclear?', ask_missing_field: 'A field missing for your case?', ask_btn: 'Tell us \u2192',
    terms_accept: 'I accept the {terms} and the {privacy}.', terms_link: 'Terms of use', privacy_link: 'privacy notice', terms_needed: 'Please accept the terms of use to create your account.',
    nav_bands: 'Bands', start_band: 'Start a band', band_name: 'Band name', band_created: 'Band created.', seats_l: 'Open seats (choose instruments)', members_n2: '{0} members', add_seat: 'Add seat', seat_added: 'Seat added.', close_seat: 'Close seat', seat_closed: 'Seat closed.', joined_ok: '{0} joined the band — contact shared.', applied_seat_ok: 'Applied for the seat.', no_bands: 'No bands yet. Start one!', lineup_full: 'Lineup complete', applications_gigs: '{0} gigs', st_filled: 'filled', nav_post: 'Post a gig', nav_mine: 'My gigs', nav_profile: 'Musician profile',
    seg_musicians: 'Musicians', musicians_near: 'Musicians near you', see_all_musicians: 'See all {0} musicians', musicians_n: '{0} musicians', no_musicians: 'No musicians match yet \u2014 be the first.', cta_people: 'See who\u2019s here', looking_l: 'I\u2019m looking for', lf_dep: 'paid dep gigs', lf_jam: 'jam partners', lf_join_band: 'to join a band', lf_start_band: 'to start a band', seg_gigs: 'Paid gigs', seg_practice: 'Jam partners', all_instruments: 'All instruments', ph_city: 'City', ph_city_ex: 'Geneva', ph_desc: 'Two 45-min sets, charts provided, backline on site…', btn_filter: 'Search',
    login_btn: 'Log in', register_btn: 'Create my account', login: 'Log in', logout: 'Log out', alerts: 'Alerts', alerts_on: 'Alerts on', register: 'Register',
    email: 'Email', password: 'Password', password2: 'Repeat password', pw_mismatch: 'The two passwords do not match.', name_label: 'Name (shown to bandleaders)',
    need_account: 'Need an account? Register', have_account: 'Have an account? Log in', forgot: 'Forgot password?', close: 'Close',
    listing_type: 'Listing type', opt_gig: 'Paid gig — dated, fixed fee', opt_practice: 'Practice partner — free, open-ended',
    instrument_needed: 'Instrument needed', date: 'Date', date_opt: 'Date (optional)', city_unknown: 'City not recognised \u2014 pick one from the list.', city: 'City', fee: 'Fee (whole gig)',
    call_time: 'Call time', end_time: 'End time', genres_csv: 'Genres (comma-separated)', description: 'Description',
    req_charts: 'must read charts', req_rehearsal: 'one rehearsal', post_gig_btn: 'Post gig',
    instruments_l: 'Instruments', home_city: 'Home city', radius: 'Travel radius (km)',
    reads_charts: 'reads charts', backing: 'backing vocals', transport: 'own transport', own_pa: 'own PA',
    demo_links_l: 'Demo links (one per line, max 5)', links_l: 'Links \u2014 YouTube, Spotify, SoundCloud, Vimeo, Bandcamp\u2026 (one per line, max 5)', save_profile: 'Save profile', photo_l: 'Profile photo', photo_pick: 'Choose a photo', photo_remove: 'Remove', photo_hint: 'Shown to bandleaders on your applications and on your public page.', photo_saved: 'Photo saved.', photo_removed: 'Photo removed.', photo_bad: 'Could not read that image.', public_page: 'View my public page \u2197',
    results_n: '{0} listings', loading: 'Loading…', empty_gigs_near: 'No paid gigs near {0} yet.', empty_practice_near: 'No jam partners near {0} yet.', empty_sub_on: 'You will be notified the moment a listing is posted for your instrument near you.', empty_gigs: 'No paid gigs found at the moment.', empty_practice: 'No jam or practice partners found at the moment.', empty_sub: 'Turn on alerts and you’ll hear the moment something is posted for your instrument near you.', empty_alerts_btn: 'Enable alerts', alerts_already: 'Alerts are already on — you’ll hear as soon as something is posted.',
    your_gig: 'Your gig — manage it under \u201cMy gigs\u201d.', apply: 'Apply', jam: 'Jam', flexible: 'flexible',
    applied_ok: 'Sent. The bandleader sees your profile and answers you here, in Messages.', could_not_apply: 'Could not apply',
    gig_posted: 'Gig posted.', practice_posted: 'Practice listing posted.', profile_saved: 'Profile saved.', failed: 'Failed',
    review_saved: 'Review saved.', booked_ok: 'Booked {0}. Others were declined.', connected_ok: 'Connected with {0} — they got your contact.',
    gig_cancelled: 'Gig cancelled.', listing_closed: 'Listing closed.', gig_completed_ok: 'Gig completed — you can now leave a review.',
    confirm_needed: 'Confirm your email address to post paid gigs — check your inbox (and spam folder).', resend_confirm: 'Resend the email', resend_done: 'Confirmation email sent — check your inbox and spam folder.', reset_sent: 'If that account exists, a reset link is on its way — check your spam folder if it does not show up.', email_confirmed: 'Email confirmed — welcome aboard.',
    confirm_invalid: 'That confirmation link is invalid or already used.', pw_updated: 'Password updated — you are logged in.', reset_failed: 'Reset failed',
    alerts_off: 'Alerts off.', alerts_on_msg: 'Alerts on — new gigs near you, applications and messages will reach this device.',
    install_link: 'Add to Home Screen', install_t: 'Add JamWerk to your Home Screen', install_sub: 'Not an App Store download \u2014 it puts JamWerk on your Home Screen, opens full-screen like an app, and on iPhone it is the only way alerts (gigs near you, applications, messages) can reach your phone.', install_now: 'Add now', install_ios_1: 'In Safari, tap the Share button (square with an arrow).', install_ios_2: 'Choose \u201cAdd to Home Screen\u201d, then open JamWerk from your Home Screen.', install_android_1: 'In Chrome, open the \u22ee menu.', install_android_2: 'Tap \u201cInstall app\u201d (or \u201cAdd to Home screen\u201d).', install_desktop_1: 'Click the install icon at the right end of the address bar.', alerts_ios: 'On iPhone: tap Share, then \u201cAdd to Home Screen\u201d \u2014 alerts work from the installed app.', alerts_unsupported: 'This browser does not support push alerts \u2014 you will still get emails.', notif_blocked: 'Notifications are blocked in your browser settings.', alerts_error: 'Could not change alert settings.', alerts_enable_fail: 'Could not enable alerts',
    note_prompt: 'Note to the bandleader (optional):', rating_prompt: 'Rating 1-5:', comment_prompt: 'Comment (optional):',
    cancel_reason_prompt: 'Reason for cancelling?', account_email_prompt: 'Your account email:', new_pw_prompt: 'Set a new password (min 8 characters):',
    login_to_see: 'Log in to see your gigs and applications.', posted_h: 'Gigs I posted', applied_h: 'Gigs I applied to', none_yet: 'None yet.',
    applications_n: '{0} application(s) ', review_apps: 'Review applications', manage: 'Manage',
    review_musician: 'Review musician', review_bandleader: 'Review bandleader', application_st: 'application: {0}',
    book: 'Book {0}', connect: 'Connect with {0}', view_profile: 'View profile \u2197', contact: 'Contact: ',
    mark_completed: 'Mark gig as completed', cancel_gig: 'Cancel gig', close_listing: 'Close listing', demo: 'demo',
    gigs_through: ' {0} gigs played through JamWerk',
    st_open: 'open', st_booked: 'booked', st_completed: 'completed', st_cancelled: 'cancelled', st_expired: 'expired',
    st_applied: 'applied', st_shortlisted: 'shortlisted', st_accepted: 'accepted', st_declined: 'declined', st_withdrawn: 'withdrawn',
    inst: { percussion: 'percussion (congas, cajón, pandeiro…)', cavaquinho: 'cavaquinho' },
  },
  fr: {
    nav_board_s: 'Concerts', nav_post_s: 'Publier', nav_mine_s: 'Mes concerts', nav_bands_s: 'Groupes', nav_msgs_s: 'Messages', nav_profile_s: 'Profil', nav_board: 'Tableau des concerts',
    nav_msgs: 'Messages', msg_btn: 'Message', msg_send: 'Envoyer', msg_sent: 'Message envoy\u00e9.', msg_placeholder: '\u00c9crivez un message\u2026', no_threads: 'Pas encore de conversations — elles commencent par une candidature.', thread_empty: 'Pas encore de messages — dites bonjour.', back: 'Retour',
    cta_jam: 'Trouver des partenaires de jam', cta_gigs: 'Voir les concerts pay\u00e9s', land_d_board: 'Des remplacements pay\u00e9s pr\u00e8s de chez vous, cachet annonc\u00e9 d\u2019avance, en CHF ou EUR. Postulez avec votre profil.', land_d_post: 'Besoin d\u2019un rempla\u00e7ant ou d\u2019un partenaire de jam\u00a0? Publiez en deux minutes \u2014 les musiciens correspondants sont alert\u00e9s. Les groupes et groupes de jam s\u2019inscrivent sous Groupes / Jams.', land_d_mine: 'Suivez vos annonces et candidatures, engagez des musiciens, laissez des avis apr\u00e8s le concert.', land_d_bands: 'Les groupes se pr\u00e9sentent avec d\u00e9mos et tarif de d\u00e9part\u00a0: r\u00e9servez-en un pour votre \u00e9v\u00e9nement, ou postulez \u00e0 une place libre.', land_d_profile: 'Votre photo, vos instruments, d\u00e9mos et avis \u2014 plus une page publique \u00e0 partager partout.',
    how_it_works: 'Comment \u00e7a marche', tagline: 'concerts \u00b7 jams \u00b7 groupes', feedback: 'Vos retours', fb_label: 'Que pouvons-nous améliorer ?', fb_email_label: 'Votre e-mail (facultatif, pour une réponse)', fb_send: 'Envoyer', fb_sent_t: 'Message envoyé', fb_thanks: 'Merci — votre retour nous est bien parvenu.', missing_q: 'Il manque un instrument, un genre ou une option ?', missing_inst_q: 'Votre instrument n\u2019est pas dans la liste ?', tell_us: 'Dites-le-nous \u2192', fb_prefill_post: 'Publication d\u2019une annonce — il manque : ', fb_prefill_profile: 'Mon profil — instrument manquant : ', fb_fail: 'Impossible d’envoyer le retour', welcome_profile: 'Bienvenue ! Un e-mail de confirmation vous a \u00e9t\u00e9 envoy\u00e9 — s\u2019il n\u2019est pas dans votre bo\u00eete de r\u00e9ception, v\u00e9rifiez le dossier spam. Cr\u00e9ez ensuite votre profil musicien — c\u2019est lui qui vous permet de postuler aux concerts et aux jams.',
    land_head: 'Trouvez un rempla\u00e7ant. Rejoignez un jam. Montez un groupe.', land_sub: 'JamWerk met en relation les musiciens du coin\u00a0: trouvez des gens par instrument et par ville, rejoignez ou r\u00e9servez un groupe, trouvez un groupe de jam, prenez des remplacements pay\u00e9s au cachet affich\u00e9 \u2014 et \u00e9crivez-vous directement dans l\u2019app.', land_s1: 'Cr\u00e9ez votre profil musicien gratuit : instruments, ville, rayon de d\u00e9placement.', land_s2: 'Parcourez ou publiez : concerts pay\u00e9s, jams, places de groupe. Activez les alertes et les annonces arrivent sur votre t\u00e9l\u00e9phone.', land_s3: 'R\u00e9servez ou connectez-vous. Les concerts effectu\u00e9s g\u00e9n\u00e8rent des avis qui construisent votre r\u00e9putation publique.', aud_jam_t: 'Envie de jammer ?', aud_jam_p: 'Les annonces de jam sont gratuites et d\u00e9contract\u00e9es — pas de cachet, pas de notes, pas de pression. Trouvez des gens de votre niveau, du d\u00e9butant au groupe du week-end.', aud_pro_t: 'Musicien professionnel ?', aud_pro_p: 'Concerts pay\u00e9s avec le cachet annonc\u00e9 d\u2019avance, en CHF ou EUR. Les avis de vrais concerts construisent une r\u00e9putation partageable.', land_alerts: 'Touchez la cloche apr\u00e8s l\u2019inscription — les concerts pour votre instrument pr\u00e8s de chez vous arrivent sur votre t\u00e9l\u00e9phone d\u00e8s leur publication.', cta_join: 'Cr\u00e9er un profil gratuit', cta_browse: 'Voir les annonces', lvl_label: 'Niveau', whos_welcome: 'Qui est bienvenu', lvl_any: 'ouvert \u00e0 tous', lvl_hobby: 'amateur', lvl_semi: 'semi-pro', lvl_pro: 'pro',
    save_band: 'Enregistrer',
    band_intro_t: 'Groupes & groupes de jam', band_intro_p: 'Les groupes se pr\u00e9sentent ici avec d\u00e9mos et tarif \u2014 r\u00e9servez-en un pour votre \u00e9v\u00e9nement, postulez \u00e0 une place libre ou trouvez un groupe de jam \u00e0 votre niveau.', list_my_band: 'Inscrire mon groupe', band_kind_l: 'De quoi s\u2019agit-il\u00a0?', kind_band: 'Un groupe \u2014 on joue des concerts et des \u00e9v\u00e9nements', kind_jam: 'Un groupe de jam / r\u00e9p\u00e9tition \u2014 on se retrouve pour jouer, sans r\u00e9servations', bookable_l: 'Disponible pour \u00e9v\u00e9nements \u2014 mariages, soir\u00e9es, entreprises (on peut nous r\u00e9server)', fee_from_l: 'Tarif d\u00e8s (groupe entier, une soir\u00e9e)', pitch_l: 'Accroche en une ligne (affich\u00e9e sur la carte)', pitch_ph: 'Groupe soul & funk \u00e0 5, 3 sets, sono incluse', cancel: 'Annuler', edit: 'Modifier', band_saved: 'Groupe mis \u00e0 jour.', seg_all_bands: 'Tous', seg_bookable: '\u00c0 r\u00e9server', seg_jamgroups: 'Groupes de jam', ph_genre: 'Genre', bands_n: '{0} groupes', no_bands_near: 'Aucun groupe ne correspond pour l\u2019instant \u2014 inscrivez le v\u00f4tre et soyez le premier.', from_fee: 'd\u00e8s {0}', fee_on_request: 'tarif sur demande', book_band: 'R\u00e9server ce groupe', contact_band: 'Contacter le groupe', jam_group: 'groupe de jam', ask_to_join: 'Demander \u00e0 rejoindre', inquiry_prompt: 'Votre message au groupe \u2014 date, lieu, type d\u2019\u00e9v\u00e9nement, budget\u00a0:', inquiry_sent: 'Message envoy\u00e9 \u2014 le groupe vous r\u00e9pondra ici dans Messages.', confirm_to_contact: 'Confirmez votre adresse e-mail avant de contacter un groupe \u2014 v\u00e9rifiez votre bo\u00eete mail.', view_band_page: 'Page du groupe \u2197', aud_event_t: 'Vous organisez un \u00e9v\u00e9nement\u00a0?', aud_event_p: 'Les groupes s\u2019inscrivent avec leurs d\u00e9mos et un tarif de d\u00e9part. Filtrez par genre et ville, \u00e9coutez, et \u00e9crivez directement au groupe.', cta_hire: 'R\u00e9server un groupe',
    nav_jams: 'Jams', nav_jams_s: 'Jams', seg_jam_groups: 'Groupes de jam', jams_intro_t: 'Jouer pour le plaisir', jams_intro_p: 'Gratuit et sans pression\u00a0: des musiciens qui cherchent avec qui jammer, et des groupes qui se retrouvent r\u00e9guli\u00e8rement pour jouer. Pas de cachet, pas de notes.', jam_list_group: 'Inscrire un groupe de jam', my_activity: 'Mon activit\u00e9', activity_hint: 'Vos annonces, vos candidatures, les avis \u00e0 laisser.', activity_open: 'Voir tout', activity_close: 'R\u00e9duire', activity_pending: '{0} en attente', dm_btn: 'Message', dm_prompt: 'Votre message\u00a0:', dm_sent: 'Message envoy\u00e9.', dm_ctx: 'Message direct', dm_closed: 'Ce musicien n\u2019accepte pas les messages directs.', dm_accept_l: 'Les autres musiciens peuvent m\u2019envoyer des messages directs', no_jam_groups: 'Aucun groupe de jam pour l\u2019instant \u2014 inscrivez le v\u00f4tre et soyez le premier.', jam_groups_n: '{0} groupes de jam',
    block: 'Bloquer', unblock: 'D\u00e9bloquer', block_confirm: 'Bloquer {0}\u00a0? Cette personne ne pourra plus vous \u00e9crire et la conversation dispara\u00eet de votre liste.', blocked_ok: 'Personne bloqu\u00e9e.', unblocked_ok: 'Personne d\u00e9bloqu\u00e9e.', blocked_h: 'Personnes bloqu\u00e9es', blocked_msg: 'Vous ne pouvez pas \u00e9crire \u00e0 cette personne.', compose_hint: 'Dites bonjour \u00e0 {0} \u2014 la date, le lieu, ce que vous avez en t\u00eate.', inquiry_ctx: 'Demande de r\u00e9servation',
    nav_musicians: 'Musiciens', nav_musicians_s: 'Musiciens', board_intro_t: 'Concerts pay\u00e9s', board_intro_p: 'Des remplacements avec le cachet annonc\u00e9 d\u2019avance, en CHF ou EUR. Besoin de quelqu\u2019un\u00a0? Publiez un concert et les bons musiciens sont alert\u00e9s.', post_gig_cta: 'Publier un concert', post_jam_cta: 'Publier une annonce de jam', by_poster: 'par {0}',
    today: 'Aujourd\u2019hui', yesterday: 'Hier',
    step1_t: 'Cr\u00e9e ton profil', step1_p: 'Ton instrument, ta ville, ce que tu cherches. Gratuit, deux minutes.', step2_t: 'Trouve du monde', step2_p: 'Musiciens, groupes, jams et concerts pay\u00e9s pr\u00e8s de chez toi \u2014 les onglets en bas.', step3_t: '\u00c9cris-leur', step3_p: 'Les messages restent dans l\u2019app, les alertes arrivent sur ton t\u00e9l\u00e9phone. C\u2019est tout.',
    free_line: '100\u00a0% gratuit pour les musiciens \u2014 sans frais, sans commission.',
    land_d_musicians: 'Tout le monde sur JamWerk, par instrument, niveau et ville \u2014 avec les groupes dans lesquels ils jouent. Un message en un clic.',
    land_d_jams: 'Gratuit et sans pression\u00a0: des musiciens qui veulent jammer, et des groupes qui se retrouvent r\u00e9guli\u00e8rement. Demandez \u00e0 rejoindre.',
    land_d_msgs: 'Toutes vos conversations au m\u00eame endroit \u2014 messages directs, candidatures, demandes de r\u00e9servation. Alertes sur votre t\u00e9l\u00e9phone.',
    genres_l: 'Genres', all_genres: 'Tous les genres',
    post_gig_title: 'Publier un concert pay\u00e9', post_jam_title: 'Publier une annonce de jam \u2014 gratuit', switch_to_gig: 'Plut\u00f4t un concert pay\u00e9', switch_to_jam: 'Plut\u00f4t une annonce de jam',
    edit_profile: 'Modifier le profil', s_lang: 'Langue', alerts_state_on: 'Activ\u00e9es', alerts_state_off: 'D\u00e9sactiv\u00e9es', profile_incomplete: 'Votre profil est vide \u2014 ajoutez vos instruments et votre ville pour qu\u2019on vous trouve.', gig_short: 'Concert', application_short: 'Candidature',
    help_ask_t: 'Une question\u00a0? Quelque chose pas clair\u00a0?', help_ask_p: 'Dites-nous ce que vous vouliez faire \u2014 on lit chaque message et on corrige vite.', help_ask_btn: '\u00c9crivez-nous',
    about_link: '\u00c0 propos', help_title: 'Aide', dm_self: 'C\u2019est votre propre profil.',
    post_gig_sub: 'Vous cherchez un musicien pour une date pr\u00e9cise \u2014 remplacement de derni\u00e8re minute ou renfort. Le cachet est affich\u00e9 d\u2019avance et les musiciens correspondants pr\u00e8s de chez vous sont alert\u00e9s.', post_jam_sub: 'Gratuit et sans date fixe\u00a0: vous cherchez quelqu\u2019un avec qui jouer, r\u00e9guli\u00e8rement ou pour une session. Pas de cachet, pas de notes.',
    need_l: 'De quoi avez-vous besoin\u00a0?', need_dep_t: 'Un rempla\u00e7ant', need_dep_p: 'Il me faut quelqu\u2019un ce jour-l\u00e0. Les musiciens correspondants pr\u00e8s de chez vous sont alert\u00e9s tout de suite.', need_standby_t: 'Une r\u00e9serve', need_standby_p: 'J\u2019ai mon musicien, je veux un plan B. Gardez des gens en r\u00e9serve\u00a0; si quelqu\u2019un l\u00e2che, un bouton les alerte et le premier qui dit oui est engag\u00e9.', tag_urgent: 'Derni\u00e8re minute', tag_standby: 'R\u00e9serve', btn_available: 'Je suis dispo', btn_standby: 'Je peux \u00eatre en r\u00e9serve', btn_jam_in: 'Je suis partant', btn_yes_coming: 'Oui, je viens', state_sent: 'Envoy\u00e9 \u2014 le chef de groupe te r\u00e9pond dans Messages', state_standby: 'Tu es en r\u00e9serve \u2014 on te pingue seulement si besoin', state_booked: 'Tu es engag\u00e9', state_declined: 'Pas cette fois', standby_now: 'On a besoin de toi\u00a0! Le premier qui confirme est engag\u00e9.', confirmed_ok: 'Confirm\u00e9 \u2014 tu es engag\u00e9. Les d\u00e9tails dans Messages.', taken: 'Quelqu\u2019un a confirm\u00e9 avant toi \u2014 merci quand m\u00eame.', keep_standby: 'Garder en r\u00e9serve', kept_standby: '{0} est en r\u00e9serve.', standby_ready: '{0} en r\u00e9serve. Si votre musicien l\u00e2che, alertez-les ici.', activate_standby: 'Mon musicien a l\u00e2ch\u00e9', activate_confirm: 'Confirmer \u2014 alerter {0} musicien(s) en r\u00e9serve', standby_alerted: 'R\u00e9serve alert\u00e9e ({0}). Le premier qui confirme est engag\u00e9 automatiquement.', standby_pinged: '{0} musicien(s) alert\u00e9(s).', lf_dep_dyn: 'Pr\u00e9viens-moi quand on cherche {ins} \u00e0 moins de {km} km de {city} \u2014 m\u00eame \u00e0 la derni\u00e8re minute.', your_instrument: 'mon instrument', your_city: 'ma ville', onboard_t: 'Deux choses et c\u2019est r\u00e9gl\u00e9', onboard_1: 'Ajoute ton instrument et ta ville', onboard_1b: 'Je le fais', onboard_2: 'Active les alertes', onboard_2b: 'Activer', onboard_3: 'C\u2019est tout \u2014 on te pingue quand quelqu\u2019un a besoin de toi.',
    ask_missing: 'Il manque quelque chose\u00a0? Pas clair\u00a0?', ask_missing_field: 'Il manque un champ pour votre cas\u00a0?', ask_btn: 'Dites-le-nous \u2192',
    terms_accept: 'J\u2019accepte les {terms} et la {privacy}.', terms_link: 'Conditions d\u2019utilisation', privacy_link: 'politique de confidentialit\u00e9', terms_needed: 'Veuillez accepter les conditions d\u2019utilisation pour cr\u00e9er votre compte.',
    nav_bands: 'Groupes', start_band: 'Créer un groupe', band_name: 'Nom du groupe', band_created: 'Groupe créé.', seats_l: 'Places ouvertes (choisissez les instruments)', members_n2: '{0} membres', add_seat: 'Ajouter une place', seat_added: 'Place ajoutée.', close_seat: 'Fermer la place', seat_closed: 'Place fermée.', joined_ok: '{0} a rejoint le groupe — contact partagé.', applied_seat_ok: 'Candidature envoyée pour la place.', no_bands: 'Pas encore de groupes. Créez-en un !', lineup_full: 'Formation au complet', applications_gigs: '{0} concerts', st_filled: 'pourvue', nav_post: 'Publier une annonce', nav_mine: 'Mes concerts', nav_profile: 'Profil musicien',
    seg_musicians: 'Musiciens', musicians_near: 'Musiciens pr\u00e8s de vous', see_all_musicians: 'Voir les {0} musiciens', musicians_n: '{0} musiciens', no_musicians: 'Aucun musicien ne correspond pour le moment \u2014 soyez le premier.', cta_people: 'Voir qui est l\u00e0', looking_l: 'Je cherche', lf_dep: 'des remplacements pay\u00e9s', lf_jam: 'des partenaires de jam', lf_join_band: '\u00e0 rejoindre un groupe', lf_start_band: '\u00e0 monter un groupe', seg_gigs: 'Concerts payés', seg_practice: 'Partenaires', all_instruments: 'Tous les instruments', ph_city: 'Ville', ph_city_ex: 'Genève', ph_desc: 'Deux sets de 45 min, grilles fournies, backline sur place…', btn_filter: 'Rechercher',
    login_btn: 'Se connecter', register_btn: 'Créer mon compte', login: 'Connexion', logout: 'Déconnexion', alerts: 'Alertes', alerts_on: 'Alertes activées', register: 'Créer un compte',
    email: 'E-mail', password: 'Mot de passe', password2: 'Répétez le mot de passe', pw_mismatch: 'Les deux mots de passe ne correspondent pas.', name_label: 'Nom (visible par les chefs de groupe)',
    need_account: 'Pas de compte ? Créez-en un', have_account: 'Déjà un compte ? Connexion', forgot: 'Mot de passe oublié ?', close: 'Fermer',
    listing_type: 'Type d\u2019annonce', opt_gig: 'Concert payé — daté, cachet fixe', opt_practice: 'Partenaire de répétition — gratuit, sans date',
    instrument_needed: 'Instrument recherché', date: 'Date', date_opt: 'Date (facultatif)', city_unknown: 'Ville non reconnue \u2014 choisissez-la dans la liste.', city: 'Ville', fee: 'Cachet (concert entier)',
    call_time: 'Heure d\u2019arrivée', end_time: 'Heure de fin', genres_csv: 'Genres (séparés par des virgules)', description: 'Description',
    req_charts: 'lecture de partitions exigée', req_rehearsal: 'une répétition', post_gig_btn: 'Publier',
    instruments_l: 'Instruments', home_city: 'Ville de résidence', radius: 'Rayon de déplacement (km)',
    reads_charts: 'lit les partitions', backing: 'ch\u0153urs', transport: 'véhicule personnel', own_pa: 'sono personnelle',
    demo_links_l: 'Liens démos (un par ligne, max 5)', links_l: 'Liens \u2014 YouTube, Spotify, SoundCloud, Vimeo, Bandcamp\u2026 (un par ligne, max 5)', save_profile: 'Enregistrer le profil', photo_l: 'Photo de profil', photo_pick: 'Choisir une photo', photo_remove: 'Supprimer', photo_hint: 'Visible par les chefs de groupe sur vos candidatures et sur votre page publique.', photo_saved: 'Photo enregistrée.', photo_removed: 'Photo supprimée.', photo_bad: 'Impossible de lire cette image.', public_page: 'Voir ma page publique \u2197',
    results_n: '{0} annonces', loading: 'Chargement…', empty_gigs_near: 'Aucun concert payé autour de {0} pour le moment.', empty_practice_near: 'Aucun partenaire de jam autour de {0} pour le moment.', empty_sub_on: 'Vous serez prévenu dès qu\u2019une annonce sera publiée pour votre instrument près de chez vous.', empty_gigs: 'Aucun concert payé trouvé pour le moment.', empty_practice: 'Aucun partenaire de jam ni annonce trouvés pour le moment.', empty_sub: 'Activez les alertes et vous serez prévenu dès qu’une annonce est publiée pour votre instrument près de chez vous.', empty_alerts_btn: 'Activer les alertes', alerts_already: 'Les alertes sont déjà activées — vous serez prévenu dès la prochaine annonce.',
    your_gig: 'Votre annonce — gérez-la dans \u00ab Mes concerts \u00bb.', apply: 'Postuler', jam: 'Jam', flexible: 'flexible',
    applied_ok: 'C\u2019est envoy\u00e9. Le chef de groupe voit ton profil et te r\u00e9pond ici, dans Messages.', could_not_apply: 'Candidature impossible',
    gig_posted: 'Concert publié.', practice_posted: 'Annonce de répétition publiée.', profile_saved: 'Profil enregistré.', failed: 'Échec',
    review_saved: 'Avis enregistré.', booked_ok: '{0} engagé·e. Les autres ont été déclinés.', connected_ok: 'Mis en contact avec {0} — il/elle a reçu vos coordonnées.',
    gig_cancelled: 'Concert annulé.', listing_closed: 'Annonce fermée.', gig_completed_ok: 'Concert terminé — vous pouvez laisser un avis.',
    confirm_needed: 'Confirmez votre adresse e-mail pour publier des concerts payés — vérifiez votre boîte de réception (et le dossier spam).', resend_confirm: 'Renvoyer l\u2019e-mail', resend_done: 'E-mail de confirmation envoyé — vérifiez votre boîte de réception et le dossier spam.', reset_sent: 'Si ce compte existe, un lien de réinitialisation arrive — vérifiez le dossier spam s\u2019il n\u2019apparaît pas.', email_confirmed: 'E-mail confirmé — bienvenue !',
    confirm_invalid: 'Ce lien de confirmation est invalide ou déjà utilisé.', pw_updated: 'Mot de passe mis à jour — vous êtes connecté.', reset_failed: 'Échec de la réinitialisation',
    alerts_off: 'Alertes désactivées.', alerts_on_msg: 'Alertes activées — nouveaux concerts près de chez vous, candidatures et messages arriveront sur cet appareil.',
    install_link: 'Ajouter \u00e0 l\u2019\u00e9cran d\u2019accueil', install_t: 'Ajouter JamWerk \u00e0 l\u2019\u00e9cran d\u2019accueil', install_sub: 'Pas un t\u00e9l\u00e9chargement App Store \u2014 \u00e7a place JamWerk sur ton \u00e9cran d\u2019accueil, \u00e7a s\u2019ouvre en plein \u00e9cran comme une app, et sur iPhone c\u2019est le seul moyen de recevoir les alertes (concerts pr\u00e8s de chez toi, candidatures, messages).', install_now: 'Ajouter maintenant', install_ios_1: 'Dans Safari, touchez le bouton Partager (carr\u00e9 avec une fl\u00e8che).', install_ios_2: 'Choisissez \u00ab\u202fSur l\u2019\u00e9cran d\u2019accueil\u202f\u00bb, puis ouvrez JamWerk depuis l\u2019\u00e9cran d\u2019accueil.', install_android_1: 'Dans Chrome, ouvrez le menu \u22ee.', install_android_2: 'Touchez \u00ab\u202fInstaller l\u2019application\u202f\u00bb (ou \u00ab\u202fAjouter \u00e0 l\u2019\u00e9cran d\u2019accueil\u202f\u00bb).', install_desktop_1: 'Cliquez sur l\u2019ic\u00f4ne d\u2019installation \u00e0 droite de la barre d\u2019adresse.', alerts_ios: 'Sur iPhone : touchez Partager puis \u00ab\u202fSur l\u2019\u00e9cran d\u2019accueil\u202f\u00bb \u2014 les alertes fonctionnent depuis l\u2019app install\u00e9e.', alerts_unsupported: 'Ce navigateur ne prend pas en charge les alertes push \u2014 vous recevrez quand m\u00eame les e-mails.', notif_blocked: 'Les notifications sont bloquées dans votre navigateur.', alerts_error: 'Impossible de modifier les alertes.', alerts_enable_fail: 'Impossible d\u2019activer les alertes',
    note_prompt: 'Note pour le chef de groupe (facultatif) :', rating_prompt: 'Note 1-5 :', comment_prompt: 'Commentaire (facultatif) :',
    cancel_reason_prompt: 'Raison de l\u2019annulation ?', account_email_prompt: 'Votre e-mail de compte :', new_pw_prompt: 'Nouveau mot de passe (min 8 caractères) :',
    login_to_see: 'Connectez-vous pour voir vos concerts et candidatures.', posted_h: 'Concerts publiés', applied_h: 'Mes candidatures', none_yet: 'Rien pour le moment.',
    applications_n: '{0} candidature(s) ', review_apps: 'Voir les candidatures', manage: 'Gérer',
    review_musician: 'Évaluer le musicien', review_bandleader: 'Évaluer le chef de groupe', application_st: 'candidature : {0}',
    book: 'Engager {0}', connect: 'Se connecter avec {0}', view_profile: 'Voir le profil \u2197', contact: 'Contact : ',
    mark_completed: 'Marquer le concert comme effectué', cancel_gig: 'Annuler le concert', close_listing: 'Fermer l\u2019annonce', demo: 'démo',
    gigs_through: ' {0} concerts joués via JamWerk',
    st_open: 'ouvert', st_booked: 'réservé', st_completed: 'effectué', st_cancelled: 'annulé', st_expired: 'expiré',
    st_applied: 'envoyée', st_shortlisted: 'présélectionnée', st_accepted: 'acceptée', st_declined: 'déclinée', st_withdrawn: 'retirée',
    inst: { vocals: 'chant', guitar: 'guitare', bass: 'basse', double_bass: 'contrebasse', drums: 'batterie', percussion: 'percussions (congas, cajón, pandeiro…)', keys: 'claviers', piano: 'piano', accordion: 'accordéon', violin: 'violon', viola: 'alto', cello: 'violoncelle', trumpet: 'trompette', trombone: 'trombone', saxophone: 'saxophone', clarinet: 'clarinette', flute: 'fl\u00fbte', harmonica: 'harmonica', cavaquinho: 'cavaquinho', dj: 'dj', other: 'autre' },
  },
  de: {
    nav_board_s: 'Gigs', nav_post_s: 'Einstellen', nav_mine_s: 'Meine Gigs', nav_bands_s: 'Bands', nav_msgs_s: 'Nachrichten', nav_profile_s: 'Profil', nav_board: 'Gig-Board',
    nav_msgs: 'Nachrichten', msg_btn: 'Nachricht', msg_send: 'Senden', msg_sent: 'Nachricht gesendet.', msg_placeholder: 'Nachricht schreiben\u2026', no_threads: 'Noch keine Unterhaltungen — sie beginnen mit einer Bewerbung.', thread_empty: 'Noch keine Nachrichten — sag hallo.', back: 'Zur\u00fcck',
    cta_jam: 'Jam-Partner finden', cta_gigs: 'Bezahlte Gigs ansehen', land_d_board: 'Bezahlte Ersatz-Gigs in deiner N\u00e4he, Gage vorab genannt, in CHF oder EUR. Bewirb dich mit deinem Profil.', land_d_post: 'Du brauchst Ersatz oder Jam-Partner? In zwei Minuten einstellen \u2014 passende Leute werden benachrichtigt. Bands und Jam-Gruppen tragen sich unter Bands / Jams ein.', land_d_mine: 'Behalte Anzeigen und Bewerbungen im Blick, buche Musiker:innen, bewerte nach dem Gig.', land_d_bands: 'Bands stellen sich mit Demos und Startgage vor: buche eine f\u00fcr deinen Anlass oder bewirb dich auf einen freien Platz.', land_d_profile: 'Dein Foto, deine Instrumente, Demos und Bewertungen \u2014 plus eine \u00f6ffentliche Seite zum Teilen.',
    how_it_works: 'So funktioniert\u2019s', tagline: 'Gigs \u00b7 Jams \u00b7 Bands', feedback: 'Feedback', fb_label: 'Was sollen wir verbessern?', fb_email_label: 'Deine E-Mail (optional, f\u00fcr eine Antwort)', fb_send: 'Senden', fb_sent_t: 'Nachricht gesendet', fb_thanks: 'Danke \u2014 dein Feedback ist bei uns angekommen.', missing_q: 'Fehlt ein Instrument, ein Genre oder eine Option?', missing_inst_q: 'Dein Instrument fehlt in der Liste?', tell_us: 'Sag es uns \u2192', fb_prefill_post: 'Gig einstellen \u2014 es fehlt: ', fb_prefill_profile: 'Mein Profil \u2014 fehlendes Instrument: ', fb_fail: 'Feedback konnte nicht gesendet werden', welcome_profile: 'Willkommen! Wir haben dir eine Best\u00e4tigungs-E-Mail geschickt — falls sie nicht im Posteingang ist, schau im Spam-Ordner nach. Richte dann dein Musikerprofil ein — damit kannst du dich auf Gigs und Jams bewerben.',
    land_head: 'Finde einen Ersatz. Finde Jam-Partner. Gr\u00fcnde eine Band.', land_sub: 'JamWerk verbindet Musiker:innen vor Ort: Leute nach Instrument und Stadt finden, einer Band beitreten oder eine buchen, eine Jam-Gruppe finden, bezahlte Ersatz-Gigs mit vorab genannter Gage \u00fcbernehmen \u2014 und sich direkt in der App schreiben.', land_s1: 'Erstelle dein gratis Musikerprofil: Instrumente, Stadt, Reiseradius.', land_s2: 'St\u00f6bern oder inserieren: bezahlte Gigs, Jams, Bandpl\u00e4tze. Alerts an, und Treffer erreichen dein Handy.', land_s3: 'Buchen oder verbinden. Abgeschlossene Gigs bringen Bewertungen f\u00fcr deinen \u00f6ffentlichen Leistungsausweis.', aud_jam_t: 'Einfach nur jammen?', aud_jam_p: 'Jam-Anzeigen sind gratis und locker — keine Gagen, keine Bewertungen, kein Druck. Finde Leute auf deinem Niveau, vom Anf\u00e4nger bis zur Wochenendband.', aud_pro_t: 'Berufsmusiker:in?', aud_pro_p: 'Bezahlte Ersatz-Gigs mit vorab genannter Gage in CHF oder EUR. Bewertungen aus echten Gigs bauen einen teilbaren Leistungsausweis auf.', land_alerts: 'Tippe nach der Anmeldung auf die Glocke — Gigs f\u00fcr dein Instrument in deiner N\u00e4he erreichen dein Handy, sobald sie erscheinen.', cta_join: 'Gratis Profil erstellen', cta_browse: 'Anzeigen ansehen', lvl_label: 'Erfahrungsstufe', whos_welcome: 'Wer ist willkommen', lvl_any: 'alle willkommen', lvl_hobby: 'Hobby', lvl_semi: 'semiprofessionell', lvl_pro: 'Profi',
    save_band: 'Speichern',
    band_intro_t: 'Bands & Jam-Gruppen', band_intro_p: 'Bands stellen sich hier mit Demos und Gage vor \u2014 buche eine f\u00fcr deinen Anlass, bewirb dich auf einen freien Platz oder finde eine Jam-Gruppe auf deinem Niveau.', list_my_band: 'Meine Band eintragen', band_kind_l: 'Was ist es?', kind_band: 'Eine Band \u2014 wir spielen Konzerte und Events', kind_jam: 'Eine Jam-/Probegruppe \u2014 wir treffen uns zum Spielen, keine Buchungen', bookable_l: 'F\u00fcr Events buchbar \u2014 Hochzeiten, Partys, Firmenanl\u00e4sse', fee_from_l: 'Gage ab (ganze Band, ein Abend)', pitch_l: 'Ein Satz zur Band (auf der Karte sichtbar)', pitch_ph: '5-k\u00f6pfige Soul-&-Funk-Band, 3 Sets, eigene PA', cancel: 'Abbrechen', edit: 'Bearbeiten', band_saved: 'Band aktualisiert.', seg_all_bands: 'Alle', seg_bookable: 'Buchbar', seg_jamgroups: 'Jam-Gruppen', ph_genre: 'Genre', bands_n: '{0} Bands', no_bands_near: 'Noch keine passende Band \u2014 trag deine ein und sei die erste.', from_fee: 'ab {0}', fee_on_request: 'Gage auf Anfrage', book_band: 'Diese Band buchen', contact_band: 'Band kontaktieren', jam_group: 'Jam-Gruppe', ask_to_join: 'Mitspielen anfragen', inquiry_prompt: 'Deine Nachricht an die Band \u2014 Datum, Ort, Art des Anlasses, Budget:', inquiry_sent: 'Nachricht gesendet \u2014 die Band antwortet dir hier unter Nachrichten.', confirm_to_contact: 'Best\u00e4tige zuerst deine E-Mail-Adresse \u2014 schau in dein Postfach.', view_band_page: 'Bandseite \u2197', aud_event_t: 'Du organisierst einen Anlass?', aud_event_p: 'Bands tragen sich mit Demos und einer Startgage ein. Nach Genre und Stadt filtern, reinh\u00f6ren und der Band direkt schreiben.', cta_hire: 'Band buchen',
    nav_jams: 'Jams', nav_jams_s: 'Jams', seg_jam_groups: 'Jam-Gruppen', jams_intro_t: 'Spielen aus Spass', jams_intro_p: 'Kostenlos und locker: Leute, die jemanden zum Jammen suchen, und Gruppen, die sich regelm\u00e4ssig zum Spielen treffen. Keine Gage, keine Bewertungen.', jam_list_group: 'Jam-Gruppe eintragen', my_activity: 'Meine Aktivit\u00e4t', activity_hint: 'Deine Inserate, deine Bewerbungen, offene Bewertungen.', activity_open: 'Alle anzeigen', activity_close: 'Weniger', activity_pending: '{0} warten auf dich', dm_btn: 'Nachricht', dm_prompt: 'Deine Nachricht:', dm_sent: 'Nachricht gesendet.', dm_ctx: 'Direktnachricht', dm_closed: 'Diese Person nimmt keine Direktnachrichten an.', dm_accept_l: 'Andere Musiker:innen d\u00fcrfen mir Direktnachrichten schicken', no_jam_groups: 'Noch keine Jam-Gruppen \u2014 trag deine ein und sei die erste.', jam_groups_n: '{0} Jam-Gruppen',
    block: 'Blockieren', unblock: 'Freigeben', block_confirm: '{0} blockieren? Die Person kann dir nicht mehr schreiben und das Gespr\u00e4ch verschwindet aus deiner Liste.', blocked_ok: 'Blockiert.', unblocked_ok: 'Freigegeben.', blocked_h: 'Blockierte Personen', blocked_msg: 'Du kannst dieser Person nicht schreiben.', compose_hint: 'Sag {0} hallo \u2014 Datum, Ort, was du vorhast.', inquiry_ctx: 'Buchungsanfrage',
    nav_musicians: 'Musiker:innen', nav_musicians_s: 'Musiker', board_intro_t: 'Bezahlte Gigs', board_intro_p: 'Ersatz-Gigs mit vorab genannter Gage, in CHF oder EUR. Du brauchst jemanden? Stell einen Gig ein und die passenden Leute werden benachrichtigt.', post_gig_cta: 'Gig einstellen', post_jam_cta: 'Jam-Inserat einstellen', by_poster: 'von {0}',
    today: 'Heute', yesterday: 'Gestern',
    step1_t: 'Profil anlegen', step1_p: 'Dein Instrument, deine Stadt, was du suchst. Gratis, zwei Minuten.', step2_t: 'Leute finden', step2_p: 'Musiker:innen, Bands, Jam-Gruppen und bezahlte Gigs in deiner N\u00e4he \u2014 die Tabs unten.', step3_t: 'Schreib ihnen', step3_p: 'Nachrichten bleiben in der App, Alerts kommen aufs Handy. Das war\u2019s.',
    free_line: '100\u00a0% gratis f\u00fcr Musiker:innen \u2014 keine Geb\u00fchren, keine Provision.',
    land_d_musicians: 'Alle auf JamWerk, nach Instrument, Niveau und Stadt \u2014 mit den Gruppen, in denen sie spielen. Nachricht mit einem Tipp.',
    land_d_jams: 'Kostenlos und locker: Leute, die jammen wollen, und Gruppen, die sich regelm\u00e4ssig treffen. Frag nach einem Platz.',
    land_d_msgs: 'Alle Gespr\u00e4che an einem Ort \u2014 Direktnachrichten, Bewerbungen, Buchungsanfragen. Alerts aufs Handy.',
    genres_l: 'Genres', all_genres: 'Alle Genres',
    post_gig_title: 'Bezahlten Gig einstellen', post_jam_title: 'Jam-Inserat einstellen \u2014 gratis', switch_to_gig: 'Lieber einen bezahlten Gig', switch_to_jam: 'Lieber ein Jam-Inserat',
    edit_profile: 'Profil bearbeiten', s_lang: 'Sprache', alerts_state_on: 'An', alerts_state_off: 'Aus', profile_incomplete: 'Dein Profil ist leer \u2014 trag Instrumente und Stadt ein, damit man dich findet.', gig_short: 'Gig', application_short: 'Bewerbung',
    help_ask_t: 'Eine Frage? Etwas unklar?', help_ask_p: 'Sag uns, was du tun wolltest \u2014 wir lesen jede Nachricht und bessern schnell nach.', help_ask_btn: 'Schreib uns',
    about_link: '\u00dcber uns', help_title: 'Hilfe', dm_self: 'Das ist dein eigenes Profil.',
    post_gig_sub: 'Du brauchst jemanden f\u00fcr ein bestimmtes Datum \u2014 Ersatz in letzter Minute oder Verst\u00e4rkung. Die Gage steht vorab, passende Leute in deiner N\u00e4he werden benachrichtigt.', post_jam_sub: 'Gratis und ohne festes Datum: du suchst jemanden zum Spielen, regelm\u00e4ssig oder f\u00fcr eine Session. Keine Gage, keine Bewertungen.',
    need_l: 'Was brauchst du?', need_dep_t: 'Einen Ersatz', need_dep_p: 'Ich brauche jemanden an diesem Datum. Passende Leute in der N\u00e4he werden sofort benachrichtigt.', need_standby_t: 'Eine Reserve', need_standby_p: 'Ich habe meine Person, will aber einen Plan B. Halte Leute in Reserve; f\u00e4llt jemand aus, alarmiert ein Tipp sie und wer zuerst ja sagt, ist gebucht.', tag_urgent: 'Letzte Minute', tag_standby: 'Reserve', btn_available: 'Ich bin verf\u00fcgbar', btn_standby: 'Ich kann Reserve sein', btn_jam_in: 'Ich bin dabei', btn_yes_coming: 'Ja, ich komme', state_sent: 'Gesendet \u2014 die Antwort kommt unter Nachrichten', state_standby: 'Du bist Reserve \u2014 wir melden uns nur bei Bedarf', state_booked: 'Du bist gebucht', state_declined: 'Diesmal nicht', standby_now: 'Du wirst gebraucht! Wer zuerst best\u00e4tigt, bekommt den Gig.', confirmed_ok: 'Best\u00e4tigt \u2014 du bist gebucht. Details unter Nachrichten.', taken: 'Jemand war schneller \u2014 trotzdem danke.', keep_standby: 'In Reserve behalten', kept_standby: '{0} ist in Reserve.', standby_ready: '{0} in Reserve. F\u00e4llt deine Person aus, alarmiere sie hier.', activate_standby: 'Meine Person ist ausgefallen', activate_confirm: 'Best\u00e4tigen \u2014 {0} Reserve-Musiker:in(nen) alarmieren', standby_alerted: 'Reserve alarmiert ({0}). Wer zuerst best\u00e4tigt, wird automatisch gebucht.', standby_pinged: '{0} Musiker:in(nen) alarmiert.', lf_dep_dyn: 'Sag mir Bescheid, wenn jemand {ins} im Umkreis von {km} km um {city} sucht \u2014 auch in letzter Minute.', your_instrument: 'mein Instrument', your_city: 'meine Stadt', onboard_t: 'Zwei Dinge und du bist startklar', onboard_1: 'Instrument und Stadt eintragen', onboard_1b: 'Los', onboard_2: 'Alerts einschalten', onboard_2b: 'Einschalten', onboard_3: 'Das war\u2019s \u2014 wir melden uns, wenn dich jemand braucht.',
    ask_missing: 'Fehlt etwas? Unklar?', ask_missing_field: 'Fehlt ein Feld f\u00fcr deinen Fall?', ask_btn: 'Sag es uns \u2192',
    terms_accept: 'Ich akzeptiere die {terms} und die {privacy}.', terms_link: 'Nutzungsbedingungen', privacy_link: 'Datenschutzhinweise', terms_needed: 'Bitte akzeptiere die Nutzungsbedingungen, um dein Konto zu erstellen.',
    nav_bands: 'Bands', start_band: 'Band gründen', band_name: 'Bandname', band_created: 'Band erstellt.', seats_l: 'Offene Plätze (Instrumente wählen)', members_n2: '{0} Mitglieder', add_seat: 'Platz hinzufügen', seat_added: 'Platz hinzugefügt.', close_seat: 'Platz schliessen', seat_closed: 'Platz geschlossen.', joined_ok: '{0} ist der Band beigetreten — Kontakt geteilt.', applied_seat_ok: 'Für den Platz beworben.', no_bands: 'Noch keine Bands. Gründe eine!', lineup_full: 'Besetzung komplett', applications_gigs: '{0} Gigs', st_filled: 'besetzt', nav_post: 'Gig einstellen', nav_mine: 'Meine Gigs', nav_profile: 'Musikerprofil',
    seg_musicians: 'Musiker:innen', musicians_near: 'Musiker:innen in deiner N\u00e4he', see_all_musicians: 'Alle {0} Musiker:innen', musicians_n: '{0} Musiker:innen', no_musicians: 'Noch niemand passt \u2014 sei die erste Person.', cta_people: 'Wer ist da?', looking_l: 'Ich suche', lf_dep: 'bezahlte Ersatz-Gigs', lf_jam: 'Jam-Partner', lf_join_band: 'eine Band zum Einsteigen', lf_start_band: 'Leute f\u00fcr eine neue Band', seg_gigs: 'Bezahlte Gigs', seg_practice: 'Jam-Partner', all_instruments: 'Alle Instrumente', ph_city: 'Stadt', ph_city_ex: 'Genf', ph_desc: 'Zwei 45-Minuten-Sets, Charts vorhanden, Backline vor Ort…', btn_filter: 'Suchen',
    login_btn: 'Anmelden', register_btn: 'Konto erstellen', login: 'Anmelden', logout: 'Abmelden', alerts: 'Alerts', alerts_on: 'Alerts an', register: 'Registrieren',
    email: 'E-Mail', password: 'Passwort', password2: 'Passwort wiederholen', pw_mismatch: 'Die beiden Passwörter stimmen nicht überein.', name_label: 'Name (für Bandleader sichtbar)',
    need_account: 'Kein Konto? Registrieren', have_account: 'Schon ein Konto? Anmelden', forgot: 'Passwort vergessen?', close: 'Schliessen',
    listing_type: 'Anzeigentyp', opt_gig: 'Bezahlter Gig — mit Datum, fixe Gage', opt_practice: 'Übungspartner — gratis, offen',
    instrument_needed: 'Gesuchtes Instrument', date: 'Datum', date_opt: 'Datum (optional)', city_unknown: 'Ort nicht erkannt \u2014 bitte aus der Liste w\u00e4hlen.', city: 'Stadt', fee: 'Gage (ganzer Gig)',
    call_time: 'Treffzeit', end_time: 'Ende', genres_csv: 'Genres (kommagetrennt)', description: 'Beschreibung',
    req_charts: 'Notenlesen erforderlich', req_rehearsal: 'eine Probe', post_gig_btn: 'Veröffentlichen',
    instruments_l: 'Instrumente', home_city: 'Wohnort', radius: 'Reiseradius (km)',
    reads_charts: 'liest Noten', backing: 'Backing Vocals', transport: 'eigenes Fahrzeug', own_pa: 'eigene PA',
    demo_links_l: 'Demo-Links (einer pro Zeile, max. 5)', links_l: 'Links \u2014 YouTube, Spotify, SoundCloud, Vimeo, Bandcamp\u2026 (einer pro Zeile, max. 5)', save_profile: 'Profil speichern', photo_l: 'Profilfoto', photo_pick: 'Foto wählen', photo_remove: 'Entfernen', photo_hint: 'Bandleader sehen es bei deinen Bewerbungen und auf deiner öffentlichen Seite.', photo_saved: 'Foto gespeichert.', photo_removed: 'Foto entfernt.', photo_bad: 'Dieses Bild konnte nicht gelesen werden.', public_page: 'Meine öffentliche Seite \u2197',
    results_n: '{0} Anzeigen', loading: 'Lädt…', empty_gigs_near: 'Noch keine bezahlten Gigs rund um {0}.', empty_practice_near: 'Noch keine Jam-Partner rund um {0}.', empty_sub_on: 'Du wirst benachrichtigt, sobald eine Anzeige f\u00fcr dein Instrument in deiner N\u00e4he erscheint.', empty_gigs: 'Im Moment keine bezahlten Gigs gefunden.', empty_practice: 'Im Moment keine Jam-Partner oder Anzeigen gefunden.', empty_sub: 'Schalte Alerts ein und du erfährst sofort, wenn etwas für dein Instrument in deiner Nähe eingestellt wird.', empty_alerts_btn: 'Alerts einschalten', alerts_already: 'Alerts sind schon an — du erfährst es, sobald etwas eingestellt wird.',
    your_gig: 'Dein Gig — verwalte ihn unter \u201eMeine Gigs\u201c.', apply: 'Bewerben', jam: 'Jam', flexible: 'flexibel',
    applied_ok: 'Gesendet. Die Bandleitung sieht dein Profil und antwortet dir hier unter Nachrichten.', could_not_apply: 'Bewerbung nicht möglich',
    gig_posted: 'Gig veröffentlicht.', practice_posted: 'Übungs-Anzeige veröffentlicht.', profile_saved: 'Profil gespeichert.', failed: 'Fehlgeschlagen',
    review_saved: 'Bewertung gespeichert.', booked_ok: '{0} gebucht. Die anderen wurden abgesagt.', connected_ok: 'Mit {0} verbunden — deine Kontaktdaten wurden geteilt.',
    gig_cancelled: 'Gig abgesagt.', listing_closed: 'Anzeige geschlossen.', gig_completed_ok: 'Gig abgeschlossen — du kannst jetzt bewerten.',
    confirm_needed: 'Bestätige deine E-Mail-Adresse, um bezahlte Gigs einzustellen — schau in den Posteingang (und Spam-Ordner).', resend_confirm: 'E-Mail erneut senden', resend_done: 'Bestätigungs-E-Mail gesendet — schau in Posteingang und Spam-Ordner.', reset_sent: 'Falls das Konto existiert, ist ein Reset-Link unterwegs — schau auch im Spam-Ordner nach.', email_confirmed: 'E-Mail bestätigt — willkommen an Bord.',
    confirm_invalid: 'Dieser Bestätigungslink ist ungültig oder schon benutzt.', pw_updated: 'Passwort aktualisiert — du bist angemeldet.', reset_failed: 'Zurücksetzen fehlgeschlagen',
    alerts_off: 'Alerts aus.', alerts_on_msg: 'Alerts an — neue Gigs in deiner Nähe, Bewerbungen und Nachrichten erreichen dieses Gerät.',
    install_link: 'Zum Home-Bildschirm', install_t: 'JamWerk zum Home-Bildschirm hinzuf\u00fcgen', install_sub: 'Kein App-Store-Download \u2014 JamWerk landet auf deinem Home-Bildschirm, \u00f6ffnet sich wie eine App im Vollbild, und auf dem iPhone ist das der einzige Weg, Alerts (Gigs in der N\u00e4he, Bewerbungen, Nachrichten) zu bekommen.', install_now: 'Jetzt hinzuf\u00fcgen', install_ios_1: 'In Safari auf Teilen tippen (Quadrat mit Pfeil).', install_ios_2: '\u201eZum Home-Bildschirm\u201c w\u00e4hlen und JamWerk vom Home-Bildschirm \u00f6ffnen.', install_android_1: 'In Chrome das \u22ee-Men\u00fc \u00f6ffnen.', install_android_2: '\u201eApp installieren\u201c antippen (oder \u201eZum Startbildschirm hinzuf\u00fcgen\u201c).', install_desktop_1: 'Auf das Installations-Symbol rechts in der Adressleiste klicken.', alerts_ios: 'Auf dem iPhone: Teilen antippen, dann \u201eZum Home-Bildschirm\u201c \u2014 Alerts funktionieren aus der installierten App.', alerts_unsupported: 'Dieser Browser unterst\u00fctzt keine Push-Alerts \u2014 E-Mails kommen trotzdem an.', notif_blocked: 'Benachrichtigungen sind im Browser blockiert.', alerts_error: 'Alert-Einstellungen konnten nicht geändert werden.', alerts_enable_fail: 'Alerts konnten nicht aktiviert werden',
    note_prompt: 'Notiz an den Bandleader (optional):', rating_prompt: 'Bewertung 1-5:', comment_prompt: 'Kommentar (optional):',
    cancel_reason_prompt: 'Grund der Absage?', account_email_prompt: 'Deine Konto-E-Mail:', new_pw_prompt: 'Neues Passwort (min. 8 Zeichen):',
    login_to_see: 'Melde dich an, um deine Gigs und Bewerbungen zu sehen.', posted_h: 'Eingestellte Gigs', applied_h: 'Meine Bewerbungen', none_yet: 'Noch nichts.',
    applications_n: '{0} Bewerbung(en) ', review_apps: 'Bewerbungen ansehen', manage: 'Verwalten',
    review_musician: 'Musiker bewerten', review_bandleader: 'Bandleader bewerten', application_st: 'Bewerbung: {0}',
    book: '{0} buchen', connect: 'Mit {0} verbinden', view_profile: 'Profil ansehen \u2197', contact: 'Kontakt: ',
    mark_completed: 'Gig als abgeschlossen markieren', cancel_gig: 'Gig absagen', close_listing: 'Anzeige schliessen', demo: 'Demo',
    gigs_through: ' {0} Gigs über JamWerk gespielt',
    st_open: 'offen', st_booked: 'gebucht', st_completed: 'abgeschlossen', st_cancelled: 'abgesagt', st_expired: 'abgelaufen',
    st_applied: 'gesendet', st_shortlisted: 'in Auswahl', st_accepted: 'angenommen', st_declined: 'abgelehnt', st_withdrawn: 'zurückgezogen',
    inst: { vocals: 'Gesang', guitar: 'Gitarre', bass: 'Bass', double_bass: 'Kontrabass', drums: 'Schlagzeug', percussion: 'Percussion (Congas, Cajón, Pandeiro…)', keys: 'Keys', piano: 'Klavier', accordion: 'Akkordeon', violin: 'Violine', viola: 'Bratsche', cello: 'Cello', trumpet: 'Trompete', trombone: 'Posaune', saxophone: 'Saxophon', clarinet: 'Klarinette', flute: 'Fl\u00f6te', harmonica: 'Mundharmonika', cavaquinho: 'Cavaquinho', dj: 'DJ', other: 'Sonstiges' },
  },
  it: {
    nav_board_s: 'Concerti', nav_post_s: 'Pubblica', nav_mine_s: 'I miei', nav_bands_s: 'Gruppi', nav_msgs_s: 'Messaggi', nav_profile_s: 'Profilo', nav_board: 'Bacheca concerti',
    nav_msgs: 'Messaggi', msg_btn: 'Messaggio', msg_send: 'Invia', msg_sent: 'Messaggio inviato.', msg_placeholder: 'Scrivi un messaggio\u2026', no_threads: 'Ancora nessuna conversazione — iniziano da una candidatura.', thread_empty: 'Ancora nessun messaggio — saluta.', back: 'Indietro',
    cta_jam: 'Trova partner per jam', cta_gigs: 'Vedi i concerti pagati', land_d_board: 'Sostituzioni pagate vicino a te, cachet indicato in anticipo, in CHF o EUR. Candidati con il tuo profilo.', land_d_post: 'Cerchi un sostituto o un partner per jam? Pubblica in due minuti \u2014 i musicisti giusti vengono avvisati. Gruppi e gruppi jam si iscrivono sotto Gruppi / Jam.', land_d_mine: 'Segui annunci e candidature, ingaggia musicisti, lascia recensioni dopo il concerto.', land_d_bands: 'I gruppi si presentano con demo e tariffa di partenza: prenotane uno per il tuo evento, o candidati a un posto libero.', land_d_profile: 'La tua foto, i tuoi strumenti, demo e recensioni \u2014 pi\u00f9 una pagina pubblica da condividere ovunque.',
    how_it_works: 'Come funziona', tagline: 'concerti · jam · band', feedback: 'Feedback', fb_label: 'Cosa possiamo migliorare?', fb_email_label: 'La tua e-mail (facoltativa, per una risposta)', fb_send: 'Invia', fb_sent_t: 'Messaggio inviato', fb_thanks: 'Grazie — il tuo feedback ci è arrivato.', missing_q: 'Manca uno strumento, un genere o un\u2019opzione?', missing_inst_q: 'Il tuo strumento non è in lista?', tell_us: 'Diccelo \u2192', fb_prefill_post: 'Pubblicazione annuncio — manca: ', fb_prefill_profile: 'Il mio profilo — strumento mancante: ', fb_fail: 'Impossibile inviare il feedback', welcome_profile: 'Benvenuto/a! Ti abbiamo inviato un\u2019e-mail di conferma — se non \u00e8 nella posta in arrivo, controlla la cartella spam. Poi crea il tuo profilo musicista — \u00e8 ci\u00f2 che ti permette di candidarti a concerti e jam.',
    land_head: 'Trova un sostituto. Trova una jam. Crea un gruppo.', land_sub: 'JamWerk collega i musicisti della zona: trova persone per strumento e citt\u00e0, entra in un gruppo o prenotane uno, trova un gruppo jam, prendi sostituzioni pagate con il cachet indicato in anticipo \u2014 e scrivetevi direttamente nell\u2019app.', land_s1: 'Crea il tuo profilo musicista gratuito: strumenti, citt\u00e0, raggio di spostamento.', land_s2: 'Sfoglia o pubblica: concerti pagati, jam, posti nei gruppi. Attiva gli avvisi e le corrispondenze arrivano sul telefono.', land_s3: 'Prenota o connettiti. I concerti completati generano recensioni che costruiscono la tua reputazione pubblica.', aud_jam_t: 'Vuoi solo suonare?', aud_jam_p: 'Gli annunci di prova sono gratuiti e informali — niente cachet, niente voti, niente pressione. Trova persone del tuo livello, dai principianti alle band del weekend.', aud_pro_t: 'Musicista professionista?', aud_pro_p: 'Concerti pagati con il cachet dichiarato in anticipo, in CHF o EUR. Le recensioni di concerti reali costruiscono una reputazione condivisibile.', land_alerts: 'Tocca la campanella dopo la registrazione — i concerti per il tuo strumento vicino a te arrivano sul telefono appena pubblicati.', cta_join: 'Crea il tuo profilo gratuito', cta_browse: 'Guarda gli annunci', lvl_label: 'Livello', whos_welcome: 'Chi \u00e8 benvenuto', lvl_any: 'aperto a tutti', lvl_hobby: 'amatoriale', lvl_semi: 'semi-pro', lvl_pro: 'pro',
    save_band: 'Salva',
    band_intro_t: 'Gruppi & gruppi jam', band_intro_p: 'I gruppi si presentano qui con demo e tariffa \u2014 prenotane uno per il tuo evento, candidati a un posto libero o trova un gruppo jam al tuo livello.', list_my_band: 'Iscrivi il mio gruppo', band_kind_l: 'Di cosa si tratta?', kind_band: 'Un gruppo \u2014 suoniamo concerti ed eventi', kind_jam: 'Un gruppo jam / di prova \u2014 ci troviamo per suonare, senza prenotazioni', bookable_l: 'Disponibile per eventi \u2014 matrimoni, feste, aziende (ci si pu\u00f2 prenotare)', fee_from_l: 'Tariffa da (gruppo intero, una serata)', pitch_l: 'Frase di presentazione (mostrata sulla scheda)', pitch_ph: 'Band soul & funk in 5, 3 set, impianto proprio', cancel: 'Annulla', edit: 'Modifica', band_saved: 'Gruppo aggiornato.', seg_all_bands: 'Tutti', seg_bookable: 'Prenotabili', seg_jamgroups: 'Gruppi jam', ph_genre: 'Genere', bands_n: '{0} gruppi', no_bands_near: 'Nessun gruppo corrisponde per ora \u2014 iscrivi il tuo e sii il primo.', from_fee: 'da {0}', fee_on_request: 'tariffa su richiesta', book_band: 'Prenota questo gruppo', contact_band: 'Contatta il gruppo', jam_group: 'gruppo jam', ask_to_join: 'Chiedi di unirti', inquiry_prompt: 'Il tuo messaggio al gruppo \u2014 data, luogo, tipo di evento, budget:', inquiry_sent: 'Messaggio inviato \u2014 il gruppo ti risponder\u00e0 qui in Messaggi.', confirm_to_contact: 'Conferma il tuo indirizzo e-mail prima di contattare un gruppo \u2014 controlla la posta.', view_band_page: 'Pagina del gruppo \u2197', aud_event_t: 'Organizzi un evento?', aud_event_p: 'I gruppi si iscrivono con demo e una tariffa di partenza. Filtra per genere e citt\u00e0, ascolta e scrivi direttamente al gruppo.', cta_hire: 'Prenota un gruppo',
    nav_jams: 'Jam', nav_jams_s: 'Jam', seg_jam_groups: 'Gruppi jam', jams_intro_t: 'Suonare per il gusto di farlo', jams_intro_p: 'Gratis e senza pressioni: musicisti che cercano con chi suonare, e gruppi che si trovano regolarmente per jammare. Niente cachet, niente voti.', jam_list_group: 'Iscrivi un gruppo jam', my_activity: 'La mia attivit\u00e0', activity_hint: 'I tuoi annunci, le tue candidature, le recensioni da lasciare.', activity_open: 'Vedi tutto', activity_close: 'Riduci', activity_pending: '{0} in attesa', dm_btn: 'Messaggio', dm_prompt: 'Il tuo messaggio:', dm_sent: 'Messaggio inviato.', dm_ctx: 'Messaggio diretto', dm_closed: 'Questo musicista non accetta messaggi diretti.', dm_accept_l: 'Gli altri musicisti possono inviarmi messaggi diretti', no_jam_groups: 'Nessun gruppo jam per ora \u2014 iscrivi il tuo e sii il primo.', jam_groups_n: '{0} gruppi jam',
    block: 'Blocca', unblock: 'Sblocca', block_confirm: 'Bloccare {0}? Non potr\u00e0 pi\u00f9 scriverti e la conversazione sparir\u00e0 dalla tua lista.', blocked_ok: 'Bloccato.', unblocked_ok: 'Sbloccato.', blocked_h: 'Persone bloccate', blocked_msg: 'Non puoi scrivere a questa persona.', compose_hint: 'Saluta {0} \u2014 la data, il luogo, cosa hai in mente.', inquiry_ctx: 'Richiesta di prenotazione',
    nav_musicians: 'Musicisti', nav_musicians_s: 'Musicisti', board_intro_t: 'Concerti pagati', board_intro_p: 'Sostituzioni con il cachet indicato in anticipo, in CHF o EUR. Cerchi qualcuno? Pubblica un concerto e i musicisti giusti vengono avvisati.', post_gig_cta: 'Pubblica un concerto', post_jam_cta: 'Pubblica un annuncio jam', by_poster: 'di {0}',
    today: 'Oggi', yesterday: 'Ieri',
    step1_t: 'Crea il tuo profilo', step1_p: 'Il tuo strumento, la tua citt\u00e0, cosa cerchi. Gratis, due minuti.', step2_t: 'Trova gente', step2_p: 'Musicisti, gruppi, jam e concerti pagati vicino a te \u2014 le schede in basso.', step3_t: 'Scrivi loro', step3_p: 'I messaggi restano nell\u2019app, gli avvisi arrivano sul telefono. Tutto qui.',
    free_line: '100% gratis per i musicisti \u2014 niente costi, niente commissioni.',
    land_d_musicians: 'Tutti su JamWerk, per strumento, livello e citt\u00e0 \u2014 con i gruppi in cui suonano. Un messaggio con un tocco.',
    land_d_jams: 'Gratis e senza pressioni: musicisti che vogliono jammare e gruppi che si trovano regolarmente. Chiedi di unirti.',
    land_d_msgs: 'Tutte le conversazioni in un posto \u2014 messaggi diretti, candidature, richieste di prenotazione. Avvisi sul telefono.',
    genres_l: 'Generi', all_genres: 'Tutti i generi',
    post_gig_title: 'Pubblica un concerto pagato', post_jam_title: 'Pubblica un annuncio jam \u2014 gratis', switch_to_gig: 'Piuttosto un concerto pagato', switch_to_jam: 'Piuttosto un annuncio jam',
    edit_profile: 'Modifica profilo', s_lang: 'Lingua', alerts_state_on: 'Attivi', alerts_state_off: 'Disattivati', profile_incomplete: 'Il tuo profilo \u00e8 vuoto \u2014 aggiungi strumenti e citt\u00e0 per farti trovare.', gig_short: 'Concerto', application_short: 'Candidatura',
    help_ask_t: 'Una domanda? Qualcosa non \u00e8 chiaro?', help_ask_p: 'Dicci cosa volevi fare \u2014 leggiamo ogni messaggio e sistemiamo in fretta.', help_ask_btn: 'Scrivici',
    about_link: 'Chi siamo', help_title: 'Aiuto', dm_self: '\u00c8 il tuo stesso profilo.',
    post_gig_sub: 'Cerchi un musicista per una data precisa \u2014 sostituzione dell\u2019ultimo minuto o rinforzo. Il cachet \u00e8 indicato in anticipo e i musicisti giusti vicino a te vengono avvisati.', post_jam_sub: 'Gratis e senza data fissa: cerchi qualcuno con cui suonare, regolarmente o per una sessione. Niente cachet, niente voti.',
    need_l: 'Di cosa hai bisogno?', need_dep_t: 'Un sostituto', need_dep_p: 'Mi serve qualcuno quel giorno. I musicisti giusti vicino a te vengono avvisati subito.', need_standby_t: 'Una riserva', need_standby_p: 'Ho il mio musicista, voglio un piano B. Tieni gente in riserva; se qualcuno molla, un tocco li avvisa e il primo che dice s\u00ec \u00e8 ingaggiato.', tag_urgent: 'Ultimo minuto', tag_standby: 'Riserva', btn_available: 'Sono disponibile', btn_standby: 'Posso essere in riserva', btn_jam_in: 'Ci sto', btn_yes_coming: 'S\u00ec, vengo', state_sent: 'Inviato \u2014 il capobanda ti risponde in Messaggi', state_standby: 'Sei in riserva \u2014 ti avvisiamo solo se serve', state_booked: 'Sei ingaggiato', state_declined: 'Non stavolta', standby_now: 'Hanno bisogno di te! Il primo che conferma \u00e8 ingaggiato.', confirmed_ok: 'Confermato \u2014 sei ingaggiato. Dettagli in Messaggi.', taken: 'Qualcuno ha confermato prima di te \u2014 grazie comunque.', keep_standby: 'Tieni in riserva', kept_standby: '{0} \u00e8 in riserva.', standby_ready: '{0} in riserva. Se il tuo musicista molla, avvisali qui.', activate_standby: 'Il mio musicista ha mollato', activate_confirm: 'Conferma \u2014 avvisa {0} musicista/i in riserva', standby_alerted: 'Riserva avvisata ({0}). Il primo che conferma \u00e8 ingaggiato automaticamente.', standby_pinged: '{0} musicista/i avvisato/i.', lf_dep_dyn: 'Avvisami quando cercano {ins} entro {km} km da {city} \u2014 anche all\u2019ultimo minuto.', your_instrument: 'il mio strumento', your_city: 'la mia citt\u00e0', onboard_t: 'Due cose e sei a posto', onboard_1: 'Aggiungi il tuo strumento e la tua citt\u00e0', onboard_1b: 'Fatto', onboard_2: 'Attiva gli avvisi', onboard_2b: 'Attiva', onboard_3: '\u00c8 tutto \u2014 ti avvisiamo quando qualcuno ha bisogno di te.',
    ask_missing: 'Manca qualcosa? Non \u00e8 chiaro?', ask_missing_field: 'Manca un campo per il tuo caso?', ask_btn: 'Diccelo \u2192',
    terms_accept: 'Accetto le {terms} e l\u2019{privacy}.', terms_link: 'Condizioni d\u2019uso', privacy_link: 'informativa sulla privacy', terms_needed: 'Accetta le condizioni d\u2019uso per creare il tuo account.',
    nav_bands: 'Gruppi', start_band: 'Crea un gruppo', band_name: 'Nome del gruppo', band_created: 'Gruppo creato.', seats_l: 'Posti aperti (scegli gli strumenti)', members_n2: '{0} membri', add_seat: 'Aggiungi posto', seat_added: 'Posto aggiunto.', close_seat: 'Chiudi il posto', seat_closed: 'Posto chiuso.', joined_ok: '{0} è entrato/a nel gruppo — contatto condiviso.', applied_seat_ok: 'Candidatura inviata per il posto.', no_bands: 'Ancora nessun gruppo. Creane uno!', lineup_full: 'Formazione al completo', applications_gigs: '{0} concerti', st_filled: 'assegnato', nav_post: 'Pubblica annuncio', nav_mine: 'I miei concerti', nav_profile: 'Profilo musicista',
    seg_musicians: 'Musicisti', musicians_near: 'Musicisti vicino a te', see_all_musicians: 'Vedi tutti i {0} musicisti', musicians_n: '{0} musicisti', no_musicians: 'Nessun musicista corrisponde ancora \u2014 sii il primo.', cta_people: 'Guarda chi c\u2019\u00e8', looking_l: 'Cerco', lf_dep: 'sostituzioni pagate', lf_jam: 'partner per jam', lf_join_band: 'di entrare in un gruppo', lf_start_band: 'di fondare un gruppo', seg_gigs: 'Concerti pagati', seg_practice: 'Partner', all_instruments: 'Tutti gli strumenti', ph_city: 'Città', ph_city_ex: 'Ginevra', ph_desc: 'Due set da 45 min, spartiti forniti, backline sul posto…', btn_filter: 'Cerca',
    login_btn: 'Accedi', register_btn: 'Crea il mio account', login: 'Accedi', logout: 'Esci', alerts: 'Avvisi', alerts_on: 'Avvisi attivi', register: 'Registrati',
    email: 'E-mail', password: 'Password', password2: 'Ripeti la password', pw_mismatch: 'Le due password non coincidono.', name_label: 'Nome (visibile ai bandleader)',
    need_account: 'Nessun account? Registrati', have_account: 'Hai già un account? Accedi', forgot: 'Password dimenticata?', close: 'Chiudi',
    listing_type: 'Tipo di annuncio', opt_gig: 'Concerto pagato — con data, cachet fisso', opt_practice: 'Partner di prova — gratuito, senza data',
    instrument_needed: 'Strumento cercato', date: 'Data', date_opt: 'Data (facoltativa)', city_unknown: 'Citt\u00e0 non riconosciuta \u2014 scegline una dalla lista.', city: 'Città', fee: 'Cachet (intero concerto)',
    call_time: 'Orario di ritrovo', end_time: 'Orario di fine', genres_csv: 'Generi (separati da virgole)', description: 'Descrizione',
    req_charts: 'lettura spartiti richiesta', req_rehearsal: 'una prova', post_gig_btn: 'Pubblica',
    instruments_l: 'Strumenti', home_city: 'Città di residenza', radius: 'Raggio di spostamento (km)',
    reads_charts: 'legge spartiti', backing: 'cori', transport: 'mezzo proprio', own_pa: 'impianto proprio',
    demo_links_l: 'Link demo (uno per riga, max 5)', links_l: 'Link \u2014 YouTube, Spotify, SoundCloud, Vimeo, Bandcamp\u2026 (uno per riga, max 5)', save_profile: 'Salva profilo', photo_l: 'Foto profilo', photo_pick: 'Scegli una foto', photo_remove: 'Rimuovi', photo_hint: 'Visibile ai bandleader nelle tue candidature e sulla tua pagina pubblica.', photo_saved: 'Foto salvata.', photo_removed: 'Foto rimossa.', photo_bad: 'Impossibile leggere questa immagine.', public_page: 'La mia pagina pubblica \u2197',
    results_n: '{0} annunci', loading: 'Caricamento…', empty_gigs_near: 'Ancora nessun concerto pagato vicino a {0}.', empty_practice_near: 'Ancora nessun partner di jam vicino a {0}.', empty_sub_on: 'Sarai avvisato appena verr\u00e0 pubblicato un annuncio per il tuo strumento vicino a te.', empty_gigs: 'Nessun concerto pagato trovato al momento.', empty_practice: 'Nessun partner di jam o annuncio trovato al momento.', empty_sub: 'Attiva gli avvisi e saprai subito quando viene pubblicato qualcosa per il tuo strumento vicino a te.', empty_alerts_btn: 'Attiva gli avvisi', alerts_already: 'Gli avvisi sono già attivi — saprai subito quando viene pubblicato qualcosa.',
    your_gig: 'Il tuo annuncio — gestiscilo in \u00abI miei concerti\u00bb.', apply: 'Candidati', jam: 'Jam', flexible: 'flessibile',
    applied_ok: 'Inviato. Il capobanda vede il tuo profilo e ti risponde qui, in Messaggi.', could_not_apply: 'Candidatura non possibile',
    gig_posted: 'Concerto pubblicato.', practice_posted: 'Annuncio di prova pubblicato.', profile_saved: 'Profilo salvato.', failed: 'Errore',
    review_saved: 'Recensione salvata.', booked_ok: '{0} ingaggiato/a. Gli altri sono stati declinati.', connected_ok: 'In contatto con {0} — ha ricevuto i tuoi recapiti.',
    gig_cancelled: 'Concerto annullato.', listing_closed: 'Annuncio chiuso.', gig_completed_ok: 'Concerto completato — ora puoi lasciare una recensione.',
    confirm_needed: 'Conferma il tuo indirizzo e-mail per pubblicare concerti pagati — controlla la posta in arrivo (e la cartella spam).', resend_confirm: 'Reinvia l\u2019e-mail', resend_done: 'E-mail di conferma inviata — controlla posta in arrivo e cartella spam.', reset_sent: 'Se l\u2019account esiste, un link di reimpostazione è in arrivo — controlla anche la cartella spam.', email_confirmed: 'E-mail confermata — benvenuto/a!',
    confirm_invalid: 'Questo link di conferma non è valido o è già stato usato.', pw_updated: 'Password aggiornata — sei connesso.', reset_failed: 'Reimpostazione non riuscita',
    alerts_off: 'Avvisi disattivati.', alerts_on_msg: 'Avvisi attivi — nuovi concerti vicino a te, candidature e messaggi arriveranno su questo dispositivo.',
    install_link: 'Aggiungi alla schermata Home', install_t: 'Aggiungi JamWerk alla schermata Home', install_sub: 'Non \u00e8 un download dall\u2019App Store \u2014 mette JamWerk nella schermata Home, si apre a schermo intero come un\u2019app e su iPhone \u00e8 l\u2019unico modo per ricevere gli avvisi (concerti vicino a te, candidature, messaggi).', install_now: 'Aggiungi ora', install_ios_1: 'In Safari, tocca Condividi (quadrato con freccia).', install_ios_2: 'Scegli \u201cAggiungi a Home\u201d, poi apri JamWerk dalla schermata Home.', install_android_1: 'In Chrome, apri il menu \u22ee.', install_android_2: 'Tocca \u201cInstalla app\u201d (o \u201cAggiungi a schermata Home\u201d).', install_desktop_1: 'Clicca l\u2019icona di installazione a destra nella barra degli indirizzi.', alerts_ios: 'Su iPhone: tocca Condividi, poi \u201cAggiungi a Home\u201d \u2014 gli avvisi funzionano dall\u2019app installata.', alerts_unsupported: 'Questo browser non supporta gli avvisi push \u2014 riceverai comunque le e-mail.', notif_blocked: 'Le notifiche sono bloccate nel browser.', alerts_error: 'Impossibile modificare gli avvisi.', alerts_enable_fail: 'Impossibile attivare gli avvisi',
    note_prompt: 'Nota per il bandleader (facoltativa):', rating_prompt: 'Voto 1-5:', comment_prompt: 'Commento (facoltativo):',
    cancel_reason_prompt: 'Motivo dell\u2019annullamento?', account_email_prompt: 'La tua e-mail:', new_pw_prompt: 'Nuova password (min 8 caratteri):',
    login_to_see: 'Accedi per vedere i tuoi concerti e candidature.', posted_h: 'Concerti pubblicati', applied_h: 'Le mie candidature', none_yet: 'Ancora niente.',
    applications_n: '{0} candidatura/e ', review_apps: 'Vedi candidature', manage: 'Gestisci',
    review_musician: 'Valuta il musicista', review_bandleader: 'Valuta il bandleader', application_st: 'candidatura: {0}',
    book: 'Ingaggia {0}', connect: 'Connettiti con {0}', view_profile: 'Vedi profilo \u2197', contact: 'Contatto: ',
    mark_completed: 'Segna il concerto come completato', cancel_gig: 'Annulla il concerto', close_listing: 'Chiudi l\u2019annuncio', demo: 'demo',
    gigs_through: ' {0} concerti suonati tramite JamWerk',
    st_open: 'aperto', st_booked: 'prenotato', st_completed: 'completato', st_cancelled: 'annullato', st_expired: 'scaduto',
    st_applied: 'inviata', st_shortlisted: 'preselezionata', st_accepted: 'accettata', st_declined: 'declinata', st_withdrawn: 'ritirata',
    inst: { vocals: 'voce', guitar: 'chitarra', bass: 'basso', double_bass: 'contrabbasso', drums: 'batteria', percussion: 'percussioni (congas, cajón, pandeiro…)', keys: 'tastiere', piano: 'pianoforte', accordion: 'fisarmonica', violin: 'violino', viola: 'viola', cello: 'violoncello', trumpet: 'tromba', trombone: 'trombone', saxophone: 'sassofono', clarinet: 'clarinetto', flute: 'flauto', harmonica: 'armonica', cavaquinho: 'cavaquinho', dj: 'dj', other: 'altro' },
  },
};
// Language: stored choice → browser language → (only if neither is supported)
// a guess from Cloudflare's geolocation hint → English.
function geoLang() {
  const geo = document.documentElement.dataset.geo || '';
  const [cc, region] = geo.split(':');
  if (!cc) return null;
  if (cc === 'CH') {
    if (/gen[eè]v|vaud|valais|neuch|jura|fribourg/i.test(region)) return 'fr';
    if (/ticino|tessin/i.test(region)) return 'it';
    return 'de';
  }
  if (['FR', 'BE', 'LU', 'MC'].includes(cc)) return 'fr';
  if (['DE', 'AT', 'LI'].includes(cc)) return 'de';
  if (cc === 'IT') return 'it';
  return null;
}
let lang = localStorage.getItem('lang') || (navigator.language || '').slice(0, 2);
if (!I18N[lang]) lang = geoLang() || 'en';
const T = (k, a) => {
  const v = I18N[lang][k] !== undefined ? I18N[lang][k] : I18N.en[k];
  return v === undefined ? k : String(v).replace('{0}', a === undefined ? '' : a);
};
const TS = (s) => T('st_' + s) === 'st_' + s ? s : T('st_' + s);
function applyI18n() {
  if ($('postTitle') && typeof T === 'function' && $('pKind').onchange) $('pKind').onchange();
  if (typeof renderGenreChecks === 'function' && $('pGenres')) {
    const keep = { pGenres: checkedValues('pGenres'), bGenres: checkedValues('bGenres'), mGenres: checkedValues('mGenres') };
    for (const id in keep) { renderGenreChecks(id); setChecked(id, keep[id]); }
    const sel = $('bGenreF'); const v = sel.value; [...sel.options].forEach((o) => { if (o.value) o.textContent = genreLabel(o.value); }); sel.value = v;
  }
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = T(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = T(n.dataset.i18nPh); });
  document.documentElement.lang = lang;
  if (typeof renderAuthMode === 'function') renderAuthMode();
}
let me = null;
let boardKind = 'gig';
let landingDismissed = false;
$('ctaBrowse').onclick = () => { landingDismissed = true; $('landing').hidden = true; document.querySelector('[data-tab=board]').click(); };
$('ctaJam').onclick = () => { landingDismissed = true; $('landing').hidden = true; boardKind = 'practice'; document.querySelector('[data-tab=jams]').click(); };
$('ctaGigs').onclick = () => { landingDismissed = true; $('landing').hidden = true; boardKind = 'gig'; document.querySelector('[data-tab=board]').click(); };
$('ctaPeople').onclick = () => { landingDismissed = true; $('landing').hidden = true; document.querySelector('[data-tab=musicians]').click(); };
$('ctaHire').onclick = () => { landingDismissed = true; $('landing').hidden = true; bandFilter = 'bookable'; document.querySelector('[data-tab=bands]').click(); };
document.querySelectorAll('#landTiles [data-goto]').forEach((tile) => {
  tile.onclick = () => {
    landingDismissed = true;
    $('landing').hidden = true;
    document.querySelector('[data-tab=' + tile.dataset.goto + ']').click();
    if (tile.dataset.activity && !activityOpen) $('activityBtn').click();
  };
});
let helpMode = false;
$('howBtn').onclick = () => {
  stopChat();
  helpMode = true;
  document.body.classList.add('help-mode');
  landingDismissed = false;
  TABS.forEach((t) => { $('tab-' + t).hidden = true; });
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.remove('active'));
  $('helpAsk1').hidden = false; $('helpAsk2').hidden = false;
  $('landing').hidden = false;
  window.scrollTo({ top: 0 });
};
document.querySelectorAll('.help-ask-btn').forEach((b) => { b.onclick = () => openFeedback(); });
document.querySelectorAll('.ask-open').forEach((b) => { b.onclick = () => openFeedback(b.dataset.fb ? T('fb_prefill_post') : undefined); });
$('helpBack').onclick = () => { (document.querySelector('[data-tab=' + (lastBrowse || 'musicians') + ']') || document.querySelector('[data-tab=musicians]')).click(); };
$('logoHome').onclick = () => {
  landingDismissed = false;
  document.querySelector('[data-tab=board]').click();
  if (!me) $('landing').hidden = false;
  window.scrollTo({ top: 0 });
};
$('footLogo').onclick = () => $('logoHome').onclick();
$('footHow').onclick = () => $('howBtn').onclick();
function openFeedback(prefill) {
  $('fbEmailRow').hidden = !!me;
  $('fbMsg').className = 'msg';
  $('fbForm').hidden = false;
  $('fbDone').hidden = true;
  if (prefill !== undefined) $('fbBody').value = prefill;
  $('fbDialog').showModal();
  if (tsFb === null) tsFb = tsRender('tsFb');
  if (prefill) { const b = $('fbBody'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
}
$('footFeedback').onclick = () => openFeedback();
// Contextual "tell us" prompts: prefill the message so people just finish the sentence.
document.querySelectorAll('[data-fb]').forEach((b) => {
  b.onclick = () => openFeedback(T(b.dataset.fb === 'post' ? 'fb_prefill_post' : 'fb_prefill_profile'));
});
$('fbDoneClose').onclick = () => $('fbDialog').close();
$('fbClose').onclick = () => $('fbDialog').close();
$('fbForm').onsubmit = async (e) => {
  e.preventDefault();
  const r = await api('/feedback', { method: 'POST', body: { message: $('fbBody').value.trim(), email: me ? '' : $('fbEmail').value.trim(), turnstile_token: tsToken(tsFb) } });
  tsReset(tsFb);
  if (r.ok) {
    $('fbBody').value = '';
    $('fbForm').hidden = true;
    $('fbDone').hidden = false;
  } else {
    const m = $('fbMsg');
    m.className = 'msg err';
    m.textContent = r.json.error || T('fb_fail');
  }
};
$('ctaJoin').onclick = () => {
  if (!registering) $('authSwitch').onclick();
  $('authDialog').showModal();
};

const api = async (path, opts = {}) => {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
let flashTimer = null;
const flash = (text, kind) => {
  const f = $('flash');
  f.className = kind + ' show';
  f.textContent = '';
  f.append(el('span', 'fi', kind === 'ok' ? '\u2713' : '!'), el('span', '', text));
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => f.classList.remove('show'), kind === 'err' ? 3200 : 2200);
};
const label = (i) => (I18N[lang].inst && I18N[lang].inst[i]) || i.replace(/_/g, ' ');
const parseCsv = (s) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const genreLabel = (g) => (GENRE_LABELS[g] && GENRE_LABELS[g][lang]) || String(g).replace(/_/g, ' ');
const checkedValues = (id) => [...document.querySelectorAll('#' + id + ' input:checked')].map((x) => x.value);
const setChecked = (id, values) => document.querySelectorAll('#' + id + ' input').forEach((x) => { x.checked = (values || []).includes(x.value); });
function renderGenreChecks(id) {
  const box = $(id); box.replaceChildren();
  for (const g of GENRES) { const cb = el('label'); const input = el('input'); input.type = 'checkbox'; input.value = g; cb.append(input, document.createTextNode(genreLabel(g))); box.append(cb); }
}

// ── Turnstile (bot protection) ───────────────────────
// Public sitekey of the "jamwerk.app forms" widget; the server verifies
// tokens on /auth/register and /feedback (src/turnstile.ts). If the widget
// script is blocked, tokens are empty and those submits fail server-side.
const TS_KEY = '0x4AAAAAAEYYdK6F0t8OOUQr';
const tsRender = (id) => (window.turnstile ? turnstile.render('#' + id, { sitekey: TS_KEY }) : null);
const tsToken = (w) => (w !== null && window.turnstile ? turnstile.getResponse(w) || '' : '');
const tsReset = (w) => { if (w !== null && window.turnstile) turnstile.reset(w); };
let tsAuth = null, tsFb = null;

// ── Auth ─────────────────────────────────────────────
let registering = false;
function renderAuth() {
  if (typeof refreshConfirmBanner === 'function') refreshConfirmBanner();
  $('landing').hidden = !!me || landingDismissed;
  $('howBtn').setAttribute('aria-label', T('how_it_works')); $('howBtn').title = T('how_it_works');
  refreshMsgBadge();
  $('who').textContent = me ? me.email : '';
  $('authBtn').textContent = me ? T('logout') : T('login');
  document.body.classList.toggle('authed', !!me);
  $('profileBtn').hidden = !me;
  $('profileBtn').textContent = '';
  if (me && me.photo) { const im = document.createElement('img'); im.src = me.photo; im.alt = ''; im.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block'; $('profileBtn').append(im); }
  else $('profileBtn').textContent = me ? (me.email || '?').trim().charAt(0).toUpperCase() : '';
  renderPhotoBlock();
  $('profileBtn').setAttribute('aria-label', T('nav_profile'));
  $('profileBtn').title = T('nav_profile');
  refreshNotifBtn();
  refreshActivity();
  if (me) renderHero(null); else showProfileEdit(false);
  renderOnboard();
}
$('authBtn').onclick = async () => {
  if (me) {
    await api('/auth/logout', { method: 'POST' });
    me = null; renderAuth(); loadBoard();
  } else {
    $('authDialog').showModal();
  }
};
$('profileBtn').onclick = () => document.querySelector('[data-tab=profile]').click();
$('logoutBtn2').onclick = () => $('authBtn').click();
function showProfileEdit(on) { $('profileView').hidden = on; $('profileEdit').hidden = !on; if (on) window.scrollTo({ top: 0 }); }
$('editProfileBtn').onclick = () => showProfileEdit(true);
$('editCancel').onclick = () => showProfileEdit(false);
$('editBack').onclick = () => showProfileEdit(false);
$('sAlerts').onclick = () => $('notifBtn').click();
$('sHow').onclick = () => $('howBtn').onclick();
$('sFeedback').onclick = () => openFeedback();
$('sInstall').onclick = () => openInstallDialog();
$('langSel2').onchange = () => { $('langSel').value = $('langSel2').value; $('langSel').onchange(); };
function updateLfDep() {
  const ins = [...document.querySelectorAll('#mInstruments input:checked')].map((x) => label(x.value));
  const city = $('mCity').value.trim();
  const km = parseInt($('mRadius').value, 10) || 30;
  $('lfDepText').textContent = T('lf_dep_dyn').replace('{ins}', ins.length ? ins.join(' / ') : T('your_instrument')).replace('{km}', km).replace('{city}', city || T('your_city'));
}
['mInstruments', 'mCity', 'mRadius'].forEach((id) => { $(id).addEventListener('change', updateLfDep); $(id).addEventListener('input', updateLfDep); });
function renderHero(p) {
  const name = (me && me.name) || (me ? me.email.split('@')[0] : '');
  const av = $('heroAvatar'); av.replaceChildren();
  if (me && me.photo) { const im = document.createElement('img'); im.src = me.photo; im.alt = ''; av.append(im); }
  else av.textContent = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  $('heroName').textContent = name;
  if (p) {
    const bits = [];
    if ((p.instruments || []).length) bits.push(p.instruments.map(label).join(' \u00b7 '));
    if (p.home_city) bits.push('\u{1F4CD} ' + p.home_city);
    if (p.level) bits.push(T({ hobby: 'lvl_hobby', semi_pro: 'lvl_semi', pro: 'lvl_pro' }[p.level] || 'lvl_hobby'));
    $('heroMeta').textContent = bits.join('  \u00b7  ');
    $('heroStats').textContent = T('gigs_through', p.gigs_played || 0).trim();
  } else {
    $('heroMeta').textContent = T('profile_incomplete');
    $('heroStats').textContent = '';
  }
  $('langSel2').value = lang;
  $('sAlertsVal').textContent = $('notifBtn').classList.contains('on') ? T('alerts_state_on') : T('alerts_state_off');
}
function renderAuthMode() {
  $('authTitle').textContent = registering ? T('register') : T('login');
  $('aTermsRow').hidden = !registering;
  $('aTermsText').innerHTML = T('terms_accept').replace('{terms}', '<a href="/about#terms" target="_blank" rel="noopener">' + T('terms_link') + '</a>').replace('{privacy}', '<a href="/about#privacy" target="_blank" rel="noopener">' + T('privacy_link') + '</a>');
  $('authSubmit').textContent = registering ? T('register_btn') : T('login_btn');
  $('authSwitch').textContent = registering ? T('have_account') : T('need_account');
  for (const id of ['authClose', 'fbClose', 'installClose']) { $(id).title = T('close'); $(id).setAttribute('aria-label', T('close')); }
}
$('authSwitch').onclick = () => {
  registering = !registering;
  renderAuthMode();
  $('aNameRow').hidden = !registering;
  $('aPw2Row').hidden = !registering;
  $('aPassword2').required = registering;
  if (!registering) $('aPassword2').value = '';
  $('tsAuthRow').hidden = !registering;
  if (registering && tsAuth === null) tsAuth = tsRender('tsAuth');
  $('aPassword').autocomplete = registering ? 'new-password' : 'current-password';
};
$('authClose').onclick = () => $('authDialog').close();
$('authForgot').onclick = async () => {
  const email = $('aEmail').value || prompt(T('account_email_prompt'));
  if (!email) return;
  await api('/auth/forgot', { method: 'POST', body: { email } });
  $('authDialog').close();
  flash(T('reset_sent'), 'ok');
};
$('authForm').onsubmit = async (e) => {
  e.preventDefault();
  if (registering && $('aPassword').value !== $('aPassword2').value) {
    const m = $('authMsg'); m.className = 'msg err'; m.textContent = T('pw_mismatch');
    $('aPassword2').focus(); return;
  }
  if (registering && !$('aTerms').checked) { const m = $('authMsg'); m.className = 'msg err'; m.textContent = T('terms_needed'); return; }
  const body = { email: $('aEmail').value, password: $('aPassword').value };
  if (registering) { body.display_name = $('aName').value; body.lang = lang; body.turnstile_token = tsToken(tsAuth); body.accept_terms = true; }
  const r = await api(registering ? '/auth/register' : '/auth/login', { method: 'POST', body });
  if (!r.ok) { const m = $('authMsg'); m.className = 'msg err'; m.textContent = r.json.error || 'Failed'; if (registering) tsReset(tsAuth); return; }
  me = { email: r.json.email, confirmed: !!r.json.confirmed, photo: r.json.photo || null };
  $('authDialog').close(); renderAuth(); loadBoard(); loadProfile();
  if (registering) {
    document.querySelector('[data-tab=profile]').click();
    flash(T('welcome_profile'), 'ok');
  }
};

// ── Tabs ─────────────────────────────────────────────
const TABS = ['musicians','board','jams','post','bands','msgs','profile'];
let lastBrowse = 'board';
// One board component, two homes: the Concerts tab (paid gigs, musicians) and the
// Jams tab (practice partners, jam groups). Moving the DOM node keeps one set of
// filters and one loadBoard().
function mountBoard(tab) {
  const host = tab === 'jams' ? $('jamsHost') : tab === 'musicians' ? $('musiciansHost') : $('tab-board');
  if ($('boardHost').parentElement !== host) host.append($('boardHost'));
  const group = tab;
  let visible = 0;
  document.querySelectorAll('#kindSeg button').forEach((x) => { x.hidden = x.dataset.group !== group; if (!x.hidden) visible++; });
  $('kindSeg').hidden = visible < 2;
  const current = document.querySelector('#kindSeg button[data-kind="' + boardKind + '"]');
  if (!current || current.dataset.group !== group) boardKind = group === 'jams' ? 'practice' : group === 'musicians' ? 'musicians' : 'gig';
  switchKind(boardKind);
}
document.querySelectorAll('#tabs button').forEach((b) => {
  b.onclick = () => {
    stopChat();
    if (helpMode) { helpMode = false; document.body.classList.remove('help-mode'); landingDismissed = true; $('landing').hidden = true; $('helpAsk1').hidden = true; $('helpAsk2').hidden = true; }
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    TABS.forEach((t) => { $('tab-' + t).hidden = t !== b.dataset.tab; });
    if (b.dataset.tab === 'board' || b.dataset.tab === 'jams' || b.dataset.tab === 'musicians') { if (b.dataset.tab !== 'musicians') lastBrowse = b.dataset.tab; mountBoard(b.dataset.tab); }
    if (b.dataset.tab === 'bands') { bandFilter = ''; loadBands(); }
    if (b.dataset.tab === 'msgs') loadThreads();
    if (b.dataset.tab === 'post') { if (lastBrowse === 'jams' && $('pKind').value !== 'practice') { $('pKind').value = 'practice'; $('pKind').onchange(); } }
    if (b.dataset.tab === 'profile') refreshActivity();
  };
});

// ── Board ────────────────────────────────────────────
function gigCard(g, actions) {
  const c = el('div', 'card');
  c.id = 'gig-' + g.id;
  const head = el('div', 'gig-head');
  head.append(el('strong', '', label(g.instrument)));
  head.append(el('span', 'tag status-' + g.status, TS(g.status)));
  head.append(el('span', 'muted', (g.gig_date || T('flexible')) + ' · ' + g.venue_city + (g.distance_km != null ? ' · ' + g.distance_km + ' km' : '')));
  head.append(el('span', 'fee', g.kind === 'practice' ? T('jam') : (g.currency || 'CHF') + ' ' + g.fee_chf));
  if (g.kind === 'gig' && g.status === 'open') {
    if (g.need === 'standby') head.append(el('span', 'tag standby', T('tag_standby')));
    else if (g.gig_date && Date.parse(g.gig_date) - Date.now() < 72 * 3600 * 1000) head.append(el('span', 'tag urgent', T('tag_urgent')));
  }
  if (g.poster_name && !g.is_mine) {
    const by = el(g.poster_handle ? 'a' : 'span', 'muted', T('by_poster', g.poster_name));
    if (g.poster_handle) { by.href = '/m/' + g.poster_handle; by.style.textDecoration = 'underline'; }
    by.style.fontSize = '13px'; by.style.flexBasis = '100%';
    head.append(by);
  }
  c.append(head);
  const tags = el('div');
  (g.genres || []).forEach((x) => tags.append(el('span', 'tag', genreLabel(x)), document.createTextNode(' ')));
  if (g.requirements && g.requirements.reads_charts) tags.append(el('span', 'tag', 'reads charts'));
  c.append(tags);
  c.append(el('p', '', g.description));
  if (actions) c.append(actions(g));
  return c;
}
// ── Musicians directory ─────────────────────────────
const LF_KEYS = { dep: 'lf_dep', jam: 'lf_jam', join_band: 'lf_join_band', start_band: 'lf_start_band' };
function musicianCard(m) {
  const card = el('div', 'card musician');
  const head = el('div', 'applicant-head');
  const initials = m.display_name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  head.append(avatarEl(m.photo, initials));
  const who = el('div'); who.style.flex = '1';
  const name = el('a', 'mname', m.display_name); name.href = '/m/' + m.handle;
  who.append(name);
  if ((m.instruments || []).length) { const ins = el('div', 'm-instruments', m.instruments.map(label).join(' \u00b7 ')); who.append(ins); }
  const bits = [];
  if (m.home_city) bits.push('\u{1F4CD} ' + m.home_city + (m.distance_km != null ? ' (' + m.distance_km + ' km)' : ''));
  if (m.level) bits.push(T({ hobby: 'lvl_hobby', semi_pro: 'lvl_semi', pro: 'lvl_pro' }[m.level] || 'lvl_hobby'));
  if (m.review_count > 0) bits.push('\u2605 ' + m.avg_rating + ' (' + m.review_count + ')');
  if (m.gigs_played) bits.push(T('gigs_through', m.gigs_played).trim());
  if (bits.length) who.append(el('div', 'm-meta', bits.join('  \u00b7  ')));
  head.append(who);
  card.append(head);
  const chips = el('div', 'chips');
  (m.looking_for || []).forEach((k) => chips.append(el('span', 'tag hot', T(LF_KEYS[k] || k))));
  (m.genres || []).slice(0, 4).forEach((g) => chips.append(el('span', 'tag', genreLabel(g))));
  (m.bands || []).forEach((b) => { const a = el('a', 'tag band-tag', '\u266b ' + b.name); a.href = '/b/' + b.id + '-' + b.slug; a.onclick = (e) => e.stopPropagation(); chips.append(a); });
  if (chips.childElementCount) card.append(chips);
  if (me && !m.is_me && m.accepts_dm !== false) {
    const dm = el('button', 'msg-pill');
    dm.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg>';
    dm.append(document.createTextNode(T('dm_btn')));
    dm.title = T('dm_btn');
    dm.onclick = (e) => { e.stopPropagation(); dmUser(m.handle, m.display_name); };
    head.append(dm);
  }
  card.onclick = (e) => { if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') location.href = '/m/' + m.handle; };
  return card;
}
async function dmUser(handle, name) {
  if (!me) { $('authDialog').showModal(); return; }
  if (me.handle && me.handle === handle) { flash(T('dm_self'), 'err'); return; }
  if (!me.confirmed) { flash(T('confirm_to_contact'), 'err'); return; }
  const w = await api('/messages/dm/with/' + encodeURIComponent(handle));
  if (!w.ok) { flash(w.json.error || T('failed'), 'err'); return; }
  const who = w.json.counterpart || name || handle;
  if (w.json.thread_id) { openThread('dm', w.json.thread_id, who); return; }
  if (!w.json.accepts_dm) { flash(T('dm_closed'), 'err'); return; }
  openCompose(who, T('dm_ctx'), (text) => api('/messages/dm', { method: 'POST', body: { handle, message: text } }));
}
async function appendMusicians(container, params, asSection) {
  const r = await api('/musicians?' + params);
  if (!r.ok) return;
  const list = r.json.musicians || [];
  if (asSection) {
    if (!list.length) return;
    const h = el('h2', '', T('musicians_near'));
    container.append(h);
  }
  list.forEach((m) => container.append(musicianCard(m)));
  if (asSection && r.json.total > list.length) {
    const more = el('button', 'ghost small', T('see_all_musicians', r.json.total));
    more.onclick = () => switchKind('musicians');
    container.append(more);
  }
}
async function loadMusicians(params) {
  const board = $('board');
  const city = $('fCity').value.trim(), km = $('fRadius').value;
  board.replaceChildren(el('p', 'muted', T('loading')));
  const r = await api('/musicians?' + params);
  board.replaceChildren();
  if (!r.ok) { board.append(el('p', 'msg err', r.json.error || T('failed'))); return; }
  const list = r.json.musicians || [];
  board.append(el('p', 'muted board-summary', T('musicians_n', list.length) + (city ? ' \u00b7 ' + city + ' \u00b7 ' + km + ' km' : '')));
  if (!list.length) {
    const card = el('div', 'card');
    card.append(el('p', 'muted', T('no_musicians')));
    const bar = el('div', 'actions');
    const join = el('button', 'primary small', me ? T('nav_profile') : T('cta_join'));
    join.onclick = () => { if (!me) { if (!registering) $('authSwitch').onclick(); $('authDialog').showModal(); } else document.querySelector('[data-tab=profile]').click(); };
    bar.append(join); card.append(bar); board.append(card);
    return;
  }
  list.forEach((m) => board.append(musicianCard(m)));
  board.append(askLine());
}
let boardSeq = 0;
async function loadBoard() {
  const seq = ++boardSeq;
  const params = new URLSearchParams();
  params.set('kind', boardKind);
  if ($('fInstrument').value) params.set('instrument', $('fInstrument').value);
  if ($('fCity').value.trim()) {
    params.set('city', $('fCity').value.trim());
    params.set('radius_km', $('fRadius').value);
  }
  if (boardKind === 'musicians') { await loadMusicians(params); return; }
  if (boardKind === 'jamgroups') { await loadJamGroups(); return; }
  const city = $('fCity').value.trim(), km = $('fRadius').value;
  const fBtn = $('fGo');
  const board = $('board');
  board.replaceChildren(el('p', 'muted', T('loading')));
  fBtn.disabled = true; fBtn.classList.add('busy');
  const r = await api('/gigs?' + params);
  fBtn.disabled = false; fBtn.classList.remove('busy');
  if (seq !== boardSeq) return;
  board.replaceChildren();
  if (!r.ok) { board.append(el('p', 'msg err', r.json.error || T('failed'))); return; }
  // Always say what was searched and how many came back, so applying a
  // filter visibly does something even when the answer is "nothing".
  const n = (r.json.gigs || []).length;
  board.append(el('p', 'muted board-summary', T('results_n', n) + (city ? ' \u00b7 ' + city + ' \u00b7 ' + km + ' km' : '')));
  if (!n) {
    const card = el('div', 'card');
    const title = el('div', 'display', city
      ? T(boardKind === 'practice' ? 'empty_practice_near' : 'empty_gigs_near', city + ' (' + km + ' km)')
      : T(boardKind === 'practice' ? 'empty_practice' : 'empty_gigs'));
    title.style.cssText = 'font-size: 17px; font-weight: 700; margin-bottom: 6px;';
    // Reflect the real alert state: once subscribed, the card confirms it and
    // the activate button disappears (subscribing again would be a no-op).
    const subbed = me && pushSupported() ? await currentSub().catch(() => null) : null;
    if (seq !== boardSeq) return;
    card.append(title, el('p', 'muted', subbed ? T('empty_sub_on') : T('empty_sub')));
    const bar = el('div', 'actions');
    if (subbed) {
      const ok = el('p', 'alerts-on-line', '\u2713 ' + T('alerts_on'));
      card.insertBefore(ok, bar);
    } else {
      const main = el('button', 'primary small', me ? T('empty_alerts_btn') : T('cta_join'));
      main.onclick = async () => {
        if (!me) { if (!registering) $('authSwitch').onclick(); $('authDialog').showModal(); return; }
        if (!pushSupported()) { pushUnsupportedHint(); return; }
        try {
          if (await currentSub()) { flash(T('alerts_already'), 'ok'); loadBoard(); return; }
          await subscribeAlerts();
          refreshNotifBtn();
          loadBoard();
        } catch { flash(T('alerts_error'), 'err'); }
      };
      bar.append(main);
    }
    const post = el('button', 'ghost small', T('nav_post'));
    post.onclick = () => document.querySelector('[data-tab=post]').click();
    bar.append(post);
    card.append(bar);
    board.append(card);
    // The people are the content while listings are scarce.
    params.set('limit', '6');
    board.append(askLine());
    const r2 = await api('/musicians?' + params);
    if (seq !== boardSeq || !r2.ok) return;
    const near = r2.json.musicians || [];
    if (near.length) { board.append(el('h2', '', T('musicians_near'))); near.forEach((m) => board.append(musicianCard(m))); }
    if (r2.json.total > near.length) { const more = el('button', 'ghost small', T('see_all_musicians', r2.json.total)); more.onclick = () => document.querySelector('[data-tab=musicians]').click(); board.append(more); }
    return;
  }
  r.json.gigs.forEach((g) => board.append(gigCard(g, gigActions)));
  board.append(askLine());
}
// What a musician can do on a listing, in plain words and one button.
// "Something missing?" line at the end of every list and form.
function askLine(prefill) {
  const d = el('div', 'ask-line');
  const b = el('button', '', T('ask_btn'));
  b.onclick = () => openFeedback(prefill !== undefined ? T(prefill) : undefined);
  d.append(document.createTextNode(T('ask_missing') + ' '), b);
  return d;
}
function gigActions(gig) {
  const bar = el('div', 'actions');
  if (gig.is_mine) { bar.append(el('span', 'muted', T('your_gig'))); return bar; }
  const st = gig.my_status;
  if (st === 'accepted') { bar.append(el('span', 'state-chip good', '\u2713 ' + T('state_booked'))); return bar; }
  if (st === 'declined') { bar.append(el('span', 'state-chip', T('state_declined'))); return bar; }
  if (st === 'shortlisted' && gig.standby_activated_at && gig.status === 'open') {
    const yes = el('button', 'primary', T('btn_yes_coming'));
    yes.onclick = async () => {
      const res = await api('/gigs/' + gig.id + '/confirm', { method: 'POST' });
      if (res.ok) { flash(T('confirmed_ok'), 'ok'); loadBoard(); }
      else if (res.json.code === 'taken') { flash(T('taken'), 'err'); loadBoard(); }
      else flash(res.json.error || T('failed'), 'err');
    };
    bar.append(el('p', 'muted', T('standby_now')), yes);
    return bar;
  }
  if (st === 'shortlisted') { bar.append(el('span', 'state-chip good', '\u2713 ' + T('state_standby'))); return bar; }
  if (st === 'applied') { bar.append(el('span', 'state-chip', '\u2713 ' + T('state_sent'))); return bar; }
  const btn = el('button', 'primary', T(gig.kind === 'practice' ? 'btn_jam_in' : gig.need === 'standby' ? 'btn_standby' : 'btn_available'));
  btn.onclick = async () => {
    if (!me) { $('authDialog').showModal(); return; }
    btn.disabled = true;
    const res = await api('/gigs/' + gig.id + '/apply', { method: 'POST', body: { note: '' } });
    btn.disabled = false;
    if (res.ok) { flash(T('applied_ok'), 'ok'); loadBoard(); }
    else flash(res.json.error || T('could_not_apply'), 'err');
  };
  bar.append(btn);
  return bar;
}
$('fGo').onclick = loadBoard;
$('fRadius').onchange = loadBoard;
async function loadJamGroups() {
  const board = $('board');
  const city = $('fCity').value.trim(), km = $('fRadius').value;
  const co = taFilter.coords();
  await renderBands({ wrap: board, kind: 'jam', city, radius: km, coords: co, emptyKey: 'no_jam_groups', countKey: 'jam_groups_n' });
}
$('postGigBtn').onclick = () => { lastBrowse = 'board'; document.querySelector('[data-tab=post]').click(); if ($('pKind').value !== 'gig') { $('pKind').value = 'gig'; $('pKind').onchange(); } };
$('postJamBtn').onclick = () => { lastBrowse = 'jams'; document.querySelector('[data-tab=post]').click(); };
$('jamListBtn').onclick = () => {
  if (!me) { $('authDialog').showModal(); return; }
  document.querySelector('[data-tab=bands]').click();
  showBandForm(null);
  document.querySelector('input[name=bKind][value=jam]').checked = true;
  syncBandForm();
};
function switchKind(k) {
  boardKind = k;
  $('fInstrument').hidden = k === 'jamgroups';
  document.querySelectorAll('#kindSeg button').forEach((x) => x.classList.toggle('active', x.dataset.kind === k));
  loadBoard();
}
document.querySelectorAll('#kindSeg button').forEach((b) => {
  b.onclick = () => switchKind(b.dataset.kind);
});

// Practice listings have no fee and no fixed date.
$('pKind').onchange = () => {
  if (typeof refreshConfirmBanner === 'function') refreshConfirmBanner();
  const practice = $('pKind').value === 'practice';
  $('pFeeRow').hidden = practice;
  $('pCallRow').hidden = practice;
  $('pNeedRow').hidden = practice;
  $('pEndRow').hidden = practice;
  $('pLevelRow').hidden = !practice;
  $('postTitle').textContent = T(practice ? 'post_jam_title' : 'post_gig_title');
  $('postSub').textContent = T(practice ? 'post_jam_sub' : 'post_gig_sub');
  $('pFee').required = !practice;
  $('pDate').required = !practice;
  $('pDateRow').querySelector('label').textContent = practice ? T('date_opt') : T('date');
};

$('postSwitch').onclick = () => { $('pKind').value = $('pKind').value === 'practice' ? 'gig' : 'practice'; $('pKind').onchange(); };

// ── Post ─────────────────────────────────────────────
function refreshConfirmBanner() {
  const show = !!me && !me.confirmed && $('pKind').value !== 'practice';
  $('confirmBanner').hidden = !show;
}
$('resendConfirmBtn').onclick = async () => {
  const r = await api('/auth/resend-confirm', { method: 'POST' });
  flash(r.ok ? T('resend_done') : (r.json.error || T('failed')), r.ok ? 'ok' : 'err');
};
try { $('pCurrency').value = localStorage.getItem('currency') || 'CHF'; } catch (e) {}
$('pCurrency').onchange = () => { try { localStorage.setItem('currency', $('pCurrency').value); } catch (e) {} };
// Render a media descriptor from the API (see src/media.ts) as an inline
// player or a link card. Iframes are lazy so a band list stays light.
function mediaEl(m) {
  if (m.embed) {
    const video = m.kind === 'youtube' || m.kind === 'vimeo';
    const box = el('div', video ? 'media video' : 'media');
    const f = document.createElement('iframe');
    f.src = m.embed; f.loading = 'lazy'; f.title = m.host; f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.setAttribute('allow', 'accelerometer; encrypted-media; picture-in-picture'); f.allowFullscreen = true;
    if (!video) f.height = m.height || 152;
    box.append(f);
    return box;
  }
  const a = el('a', 'media link'); a.href = m.url; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
  const play = el('span', 'play', '\u2197');
  const txt = el('span'); txt.append(el('span', 't', m.url), document.createElement('br'), el('span', 'd', m.host));
  a.append(play, txt);
  return a;
}
// Avatar: photo when available, initials otherwise.
function avatarEl(photo, initials) {
  const d = el('div', 'avatar');
  if (photo) { d.style.overflow = 'hidden'; const im = document.createElement('img'); im.src = photo; im.alt = ''; im.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block'; d.append(im); }
  else d.textContent = initials;
  return d;
}
function renderPhotoBlock() {
  const box = $('photoPreview'); if (!box) return;
  box.textContent = '';
  if (me && me.photo) { const im = document.createElement('img'); im.src = me.photo; im.alt = ''; im.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block'; box.append(im); }
  else box.textContent = me ? (me.email || '?').trim().charAt(0).toUpperCase() : '';
  $('photoRemove').hidden = !(me && me.photo);
}
// Resize in the browser (cover-crop to a 512px square JPEG) so uploads stay
// small and the Worker never has to process images.
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const S = 512, c = document.createElement('canvas'); c.width = S; c.height = S;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
      c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, S, S);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}
$('photoPick').onclick = () => $('photoFile').click();
$('photoFile').onchange = async () => {
  const file = $('photoFile').files[0]; $('photoFile').value = '';
  if (!file) return;
  try {
    const blob = await resizeImage(file);
    const res = await fetch('/auth/photo', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { flash(j.error || T('failed'), 'err'); return; }
    if (me) me.photo = j.photo;
    renderAuth(); flash(T('photo_saved'), 'ok');
  } catch (e) { flash(T('photo_bad'), 'err'); }
};
$('photoRemove').onclick = async () => {
  const r = await api('/auth/photo', { method: 'DELETE' });
  if (r.ok) { if (me) me.photo = null; renderAuth(); flash(T('photo_removed'), 'ok'); } else flash(r.json.error || T('failed'), 'err');
};
// ── City typeahead ───────────────────────────────────
// Free text never reaches the geocoder unconfirmed: the user picks a place
// (bundled list answers instantly; /places adds OSM suggestions). The server
// refuses unknown cities (code city_unknown) so nothing is saved invisibly.
const PLACES = ${PLACES_JSON}.map((p) => ({ name: p[0], region: p[1], country: p[2], lat: p[3], lng: p[4], aliases: p[5] }));
const normPlace = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[-_./]/g, ' ').replace(/\\s+/g, ' ').trim();
function findLocalPlace(q) {
  const k = normPlace(q); if (!k) return null;
  return PLACES.find((p) => normPlace(p.name) === k || p.aliases.some((a) => normPlace(a) === k)) || null;
}
function localPlaces(q, limit = 6) {
  const k = normPlace(q); if (!k) return [];
  const scored = [];
  for (const p of PLACES) {
    let best = 0;
    for (const n of [p.name, ...p.aliases].map(normPlace)) {
      if (n === k) best = Math.max(best, 3); else if (n.startsWith(k)) best = Math.max(best, 2);
      else if (n.split(' ').some((w) => w.startsWith(k))) best = Math.max(best, 1);
    }
    if (best) scored.push([best, p]);
  }
  return scored.sort((x, y) => y[0] - x[0] || x[1].name.localeCompare(y[1].name)).slice(0, limit).map((x) => x[1]);
}
function attachPlaces(input, strict) {
  const wrap = document.createElement('div'); wrap.className = 'place-wrap';
  input.replaceWith(wrap); wrap.append(input);
  input.autocomplete = 'off';
  const list = el('div', 'places'); list.hidden = true; wrap.append(list);
  const hint = el('div', 'place-hint'); hint.hidden = true; wrap.append(hint);
  let items = [], active = -1, timer = null, seq = 0;
  const pick = (p) => { seq++; clearTimeout(timer); items = []; input.value = p.name; input.dataset.lat = p.lat; input.dataset.lng = p.lng; input.dataset.picked = p.name; hint.hidden = true; list.hidden = true; input.dispatchEvent(new Event('picked')); };
  const render = () => {
    list.textContent = ''; active = -1;
    if (!items.length) { list.hidden = true; return; }
    items.forEach((p) => {
      const row = el('div'); row.append(el('span', '', p.name), el('small', '', [p.region, p.country].filter(Boolean).join(' · ')));
      row.onmousedown = (e) => e.preventDefault(); row.onclick = () => pick(p);
      list.append(row);
    });
    list.hidden = false;
  };
  input.addEventListener('input', () => {
    delete input.dataset.picked; input.dataset.lat = ''; input.dataset.lng = ''; hint.hidden = true;
    const q = input.value.trim(); clearTimeout(timer);
    if (q.length < 2) { items = []; list.hidden = true; return; }
    items = localPlaces(q); render();
    if (items.length < 5 && q.length >= 3) {
      const my = ++seq;
      timer = setTimeout(async () => {
        const r = await api('/places?q=' + encodeURIComponent(q));
        if (my !== seq || !r.ok) return;
        const merged = items.slice();
        for (const p of r.json.places) if (!merged.some((m) => m.name.toLowerCase() === p.name.toLowerCase())) merged.push(p);
        items = merged.slice(0, 8); render();
      }, 300);
    }
  });
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    const rows = list.children;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length; [...rows].forEach((r, i) => r.classList.toggle('on', i === active)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
    else if (e.key === 'Escape') list.hidden = true;
  });
  input.addEventListener('blur', () => setTimeout(() => {
    list.hidden = true;
    if (input.dataset.picked || !input.value.trim()) return;
    const lp = findLocalPlace(input.value);
    if (lp) pick(lp); else if (strict) hint.hidden = false;
  }, 150));
  hint.textContent = T('city_unknown');
  return {
    coords: () => (input.dataset.lat ? { lat: +input.dataset.lat, lng: +input.dataset.lng } : null),
    markPicked: () => { input.dataset.picked = input.value; hint.hidden = true; },
    showUnknown: () => { hint.hidden = false; input.focus(); },
  };
}
const taCity = attachPlaces($('pCity'), true), taHome = attachPlaces($('mCity'), true), taBand = attachPlaces($('bCity'), true), taFilter = attachPlaces($('fCity'), false), taBandF = attachPlaces($('bCityF'), false);
// ── Install dialog ───────────────────────────────────
// The PWA is the app: free, no store. Chrome hands us a native prompt via
// beforeinstallprompt; everywhere else we show device-specific steps.
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function openInstallDialog() {
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const steps = $('installSteps'); steps.textContent = '';
  // The two glyphs people actually scan the iOS share sheet for.
  const ICONS = {
    share: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m8 6 4-4 4 4"/><rect x="4" y="9" width="16" height="12" rx="2"/></svg>',
    plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>',
  };
  const add = (txt, icon) => {
    const d = el('div', 'install-step');
    const span = el('span', '', txt);
    if (icon) { const i = el('span', 'step-icon'); i.innerHTML = ICONS[icon]; span.append(' ', i); }
    d.append(span); steps.append(d);
  };
  if (ios) { add(T('install_ios_1'), 'share'); add(T('install_ios_2'), 'plus'); }
  else if (/Android/i.test(navigator.userAgent)) { add(T('install_android_1'), 'menu'); add(T('install_android_2'), 'plus'); }
  else { add(T('install_desktop_1')); }
  $('installNative').hidden = !installPrompt;
  $('installDialog').showModal();
}
$('installNative').onclick = async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('installDialog').close(); };
$('installClose').onclick = () => $('installDialog').close();
$('footInstall').onclick = openInstallDialog;
if (isStandalone()) $('footInstall').hidden = true;
$('postForm').onsubmit = async (e) => {
  e.preventDefault();
  if (!me) { $('authDialog').showModal(); return; }
  const practice = $('pKind').value === 'practice';
  const body = {
    kind: $('pKind').value,
    need: (document.querySelector('input[name=pNeed]:checked') || {}).value || 'dep',
    instrument: $('pInstrument').value,
    genres: checkedValues('pGenres'),
    gig_date: $('pDate').value || undefined,
    venue_city: $('pCity').value,
    ...(taCity.coords() ? { venue_lat: taCity.coords().lat, venue_lng: taCity.coords().lng } : {}),
    fee_chf: practice ? undefined : parseInt($('pFee').value, 10),
    currency: practice ? undefined : $('pCurrency').value,
    call_time: $('pCall').value || undefined,
    end_time: $('pEnd').value || undefined,
    description: $('pDesc').value,
    requirements: { reads_charts: $('pCharts').checked, rehearsal: $('pRehearsal').checked, level: practice ? $('pLevel').value : undefined },
  };
  const r = await api('/gigs', { method: 'POST', body });
  if (!r.ok && r.json.code === 'email_unconfirmed') { if (me) me.confirmed = false; refreshConfirmBanner(); }
  if (r.ok) {
    flash(practice ? T('practice_posted') : T('gig_posted'), 'ok');
    $('postForm').reset(); $('pKind').onchange();
    boardKind = practice ? 'practice' : 'gig';
    document.querySelectorAll('#kindSeg button').forEach((x) => x.classList.toggle('active', x.dataset.kind === boardKind));
    document.querySelector('[data-tab=board]').click();
  }
  else if (r.json.code === 'city_unknown') { taCity.showUnknown(); flash(T('city_unknown'), 'err'); }
  else flash((r.json.details || [r.json.error]).join(' · '), 'err');
};

// ── Mine ─────────────────────────────────────────────
let activityOpen = false;
$('activityBtn').onclick = () => {
  activityOpen = !activityOpen;
  $('mine').hidden = !activityOpen;
  $('activityRecent').hidden = activityOpen;
  $('activityBtn').textContent = T(activityOpen ? 'activity_close' : 'activity_open');
  if (activityOpen) loadMine();
};
// Things that need the user: applications on their open gigs, booked gigs whose date
// has passed (mark completed / review). Shown as a badge on the avatar and Profile tab.
async function loadBlocks() {
  if (!me) { $('blocksCard').hidden = true; return; }
  const r = await api('/messages/blocks');
  const list = r.ok ? r.json.blocks : [];
  $('blocksCard').hidden = !list.length;
  const wrap = $('blocksList');
  wrap.replaceChildren();
  for (const b of list) {
    const row = el('div');
    row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '10px';
    row.append(el('span', '', b.name));
    const un = el('button', 'ghost small', T('unblock'));
    un.style.marginLeft = 'auto';
    un.onclick = async () => {
      const res = await api('/messages/block', { method: 'POST', body: { handle: b.handle, unblock: true } });
      if (res.ok) { flash(T('unblocked_ok'), 'ok'); loadBlocks(); } else flash(res.json.error || T('failed'), 'err');
    };
    row.append(un);
    wrap.append(row);
  }
}
async function refreshActivity() {
  loadBlocks();
  const setBadge = (n) => {
    const dot = $('profileDot') || (() => { const d = el('span'); d.id = 'profileDot'; return d; })();
    if (n) { dot.textContent = n; if (!dot.parentElement) $('profileBtn').append(dot); } else dot.remove();
    $('actBadge').textContent = n; $('actBadge').hidden = !n;
    $('activitySummary').textContent = n ? T('activity_pending', n) : T('activity_hint');
  };
  if (!me) { setBadge(0); return; }
  const r = await api('/gigs/mine');
  if (!r.ok) { setBadge(0); return; }
  const today = new Date().toISOString().slice(0, 10);
  let n = 0;
  for (const g of r.json.posted || []) {
    if (g.status === 'open') n += g.application_count || 0;
    if (g.status === 'booked' && g.gig_date && g.gig_date < today) n += 1;
  }
  setBadge(n);
  const items = [];
  for (const g of r.json.posted || []) items.push({ at: g.created_at || '', text: (g.kind === 'practice' ? T('jam') : T('gig_short')) + ' \u00b7 ' + label(g.instrument) + ' \u00b7 ' + g.venue_city + (g.gig_date ? ' \u00b7 ' + g.gig_date : ''), tag: g.status === 'open' && g.application_count ? T('applications_n', g.application_count).trim() : TS(g.status) });
  for (const g of r.json.applications || []) items.push({ at: g.created_at || '', text: T('application_short') + ' \u00b7 ' + label(g.instrument) + ' \u00b7 ' + g.venue_city + (g.gig_date ? ' \u00b7 ' + g.gig_date : ''), tag: TS(g.application_status) });
  items.sort((a, b) => b.at.localeCompare(a.at));
  const rec = $('activityRecent'); rec.replaceChildren();
  for (const it of items.slice(0, 3)) {
    const row = el('div', 'rrow');
    row.append(el('span', 't', it.text), el('span', 'tag', it.tag));
    row.onclick = () => { if (!activityOpen) $('activityBtn').click(); };
    rec.append(row);
  }
  $('activityBtn').hidden = !items.length;
  if (!items.length) rec.append(el('div', 'muted', T('none_yet')));
}
async function loadMine() {
  const wrap = $('mine');
  wrap.replaceChildren();
  if (!me) { wrap.append(el('div', 'empty', T('login_to_see'))); return; }
  const r = await api('/gigs/mine');
  wrap.append(el('h2', '', T('posted_h')));
  if (!r.json.posted.length) wrap.append(el('div', 'muted', T('none_yet')));
  for (const g of r.json.posted) {
    wrap.append(gigCard(g, (gig) => {
      const bar = el('div');
      bar.append(el('span', 'muted', T('applications_n', gig.application_count)));
      if (gig.status === 'open' || gig.status === 'booked') {
        const manage = el('button', 'ghost small', gig.status === 'open' ? T('review_apps') : T('manage'));
        manage.onclick = () => showManage(gig.id, bar);
        bar.append(manage);
      }
      if (gig.status === 'completed') {
        const rev = el('button', 'ghost small', T('review_musician'));
        rev.onclick = () => submitReview(gig.id);
        bar.append(rev);
      }
      return bar;
    }));
  }
  wrap.append(el('h2', '', T('applied_h')));
  if (!r.json.applications.length) wrap.append(el('div', 'muted', T('none_yet')));
  for (const g of r.json.applications) {
    wrap.append(gigCard(g, (gig) => {
      const bar = el('div');
      bar.append(el('span', 'tag', T('application_st', TS(gig.application_status))));
      const msgBtn = el('button', 'ghost small', T('msg_btn'));
      msgBtn.onclick = () => openThread('gig', gig.application_id, '');
      bar.append(msgBtn);
      if (gig.status === 'completed' && gig.application_status === 'accepted') {
        const rev = el('button', 'ghost small', T('review_bandleader'));
        rev.onclick = () => submitReview(gig.id);
        bar.append(rev);
      }
      return bar;
    }));
  }
}
async function showManage(gigId, bar) {
  const r = await api('/gigs/' + gigId);
  bar.querySelectorAll('.application').forEach((n) => n.remove());
  const standbys = (r.json.applications || []).filter((a) => a.status === 'shortlisted').length;
  if (r.json.kind === 'gig' && r.json.status === 'open' && standbys) {
    const row = el('div', 'application');
    if (r.json.standby_activated_at) {
      row.append(el('p', 'muted', T('standby_alerted', standbys)));
    } else {
      row.append(el('p', 'muted', T('standby_ready', standbys)));
      const act = el('button', 'primary small', '\u{1F6A8} ' + T('activate_standby'));
      let armed = false;
      act.onclick = async () => {
        if (!armed) { armed = true; act.textContent = T('activate_confirm', standbys); act.classList.add('danger'); return; }
        const res = await api('/gigs/' + gigId + '/activate-standby', { method: 'POST' });
        if (res.ok) { flash(T('standby_pinged', res.json.pinged), 'ok'); showManage(gigId, bar); } else flash(res.json.error || T('failed'), 'err');
      };
      row.append(act);
    }
    bar.append(row);
  }
  for (const a of r.json.applications || []) {
    const row = el('div', 'application');
    const head = el('div', 'applicant-head');
    const initials = a.display_name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    head.append(avatarEl(a.photo, initials));
    const who = el('div');
    who.style.flex = '1';
    who.append(el('strong', '', a.display_name));
    const meta = el('div', 'applicant-meta');
    if (a.review_count > 0) meta.append(el('span', 'rating', '\u2605 ' + a.avg_rating + ' (' + a.review_count + ')'));
    if (a.gigs_played != null) meta.append(el('span', '', a.gigs_played + ' gigs'));
    if (a.home_city) meta.append(el('span', '', a.home_city));
    if ((a.instruments || []).length) meta.append(el('span', '', a.instruments.map(label).join(', ')));
    if (a.level) meta.append(el('span', '', T({ hobby: 'lvl_hobby', semi_pro: 'lvl_semi', pro: 'lvl_pro' }[a.level] || 'lvl_hobby')));
    who.append(meta);
    head.append(who, el('span', 'tag', TS(a.status)));
    row.append(head);
    const msgBtn = el('button', 'ghost small', T('msg_btn'));
    msgBtn.onclick = () => openThread('gig', a.id, a.display_name);
    row.append(msgBtn);
    if (a.handle) {
      const prof = el('a', 'muted', T('view_profile'));
      prof.href = '/m/' + a.handle;
      prof.target = '_blank';
      prof.rel = 'noopener noreferrer';
      row.append(prof);
    }
    if (a.status === 'accepted' && a.musician_email) row.append(el('div', 'muted', T('contact') + a.musician_email));
    if (a.note) row.append(el('p', 'muted', a.note));
    (a.demo_links || []).forEach((u) => {
      const link = el('a', '', T('demo')); link.href = u; link.target = '_blank'; link.rel = 'noopener noreferrer';
      row.append(document.createTextNode(' '), link);
    });
    if (a.status === 'applied' && r.json.kind === 'gig' && r.json.status === 'open') {
      const keep = el('button', (r.json.need === 'standby' ? 'primary' : 'ghost') + ' small', T('keep_standby'));
      keep.onclick = async () => {
        const res = await api('/gigs/' + gigId + '/applications/' + a.id + '/shortlist', { method: 'POST' });
        if (res.ok) { flash(T('kept_standby', a.display_name), 'ok'); showManage(gigId, bar); } else flash(res.json.error || T('failed'), 'err');
      };
      row.append(keep);
    }
    if (a.status === 'applied' || a.status === 'shortlisted') {
      const practice = r.json.kind === 'practice';
      const acc = el('button', (r.json.need === 'standby' && a.status === 'applied' ? 'ghost' : 'primary') + ' small', practice ? T('connect', a.display_name) : T('book', a.display_name));
      acc.onclick = async () => {
        const res = await api('/gigs/' + gigId + '/applications/' + a.id + '/accept', { method: 'POST' });
        if (res.ok) {
          flash(practice ? T('connected_ok', res.json.musician_email) : T('booked_ok', res.json.musician_email), 'ok');
          loadMine();
        } else flash(res.json.error || T('failed'), 'err');
      };
      row.append(document.createTextNode(' '), acc);
    }
    bar.append(row);
  }
  if (r.json.kind === 'practice' && r.json.status === 'open') {
    const close = el('button', 'ghost small', T('close_listing'));
    close.onclick = async () => {
      const res = await api('/gigs/' + gigId + '/cancel', { method: 'POST', body: {} });
      if (res.ok) { flash(T('listing_closed'), 'ok'); loadMine(); } else flash(res.json.error || T('failed'), 'err');
    };
    const row = el('div', 'application');
    row.append(close);
    bar.append(row);
  }
  if (r.json.status === 'booked') {
    const done = el('button', 'primary small', T('mark_completed'));
    done.onclick = async () => {
      const res = await api('/gigs/' + gigId + '/complete', { method: 'POST' });
      if (res.ok) { flash(T('gig_completed_ok'), 'ok'); loadMine(); }
      else flash(res.json.error || T('failed'), 'err');
    };
    const cancelBtn = el('button', 'ghost small', T('cancel_gig'));
    cancelBtn.onclick = async () => {
      const reason = prompt(T('cancel_reason_prompt')) || '';
      const res = await api('/gigs/' + gigId + '/cancel', { method: 'POST', body: { reason } });
      if (res.ok) { flash(T('gig_cancelled'), 'ok'); loadMine(); } else flash(res.json.error || T('failed'), 'err');
    };
    const row = el('div', 'application');
    row.append(done, document.createTextNode(' '), cancelBtn);
    bar.append(row);
  }
}
async function submitReview(gigId) {
  const rating = parseInt(prompt(T('rating_prompt')), 10);
  if (!(rating >= 1 && rating <= 5)) return;
  const comment = prompt(T('comment_prompt')) || '';
  const r = await api('/gigs/' + gigId + '/review', { method: 'POST', body: { rating, comment } });
  if (r.ok) flash(T('review_saved'), 'ok'); else flash(r.json.error || T('failed'), 'err');
}

// ── Profile ──────────────────────────────────────────
async function loadProfile() {
  if (!me) return;
  const r = await api('/musicians/me');
  if (!r.ok) { renderHero(null); showProfileEdit(true); return; }
  renderHero(r.json);
  showProfileEdit(false);
  document.querySelectorAll('#mInstruments input').forEach((cb) => { cb.checked = r.json.instruments.includes(cb.value); });
  setChecked('mGenres', r.json.genres);
  $('mCity').value = r.json.home_city || '';
  taHome.markPicked();
  $('mRadius').value = r.json.travel_radius_km;
  $('mLevel').value = r.json.level || '';
  document.querySelectorAll('#mLooking input').forEach((x) => { x.checked = (r.json.looking_for || []).includes(x.value); });
  $('mDm').checked = r.json.accepts_dm !== 0;
  updateLfDep();
  lastProfile = r.json; renderOnboard();
  $('mCharts').checked = !!r.json.reads_charts;
  $('mBacking').checked = !!r.json.sings_backing;
  $('mTransport').checked = !!r.json.own_transport;
  $('mPa').checked = !!r.json.own_pa;
  $('mDemos').value = (r.json.demo_links || []).join('\\n');
  if (r.json.handle) {
    $('mPublic').href = '/m/' + r.json.handle;
    $('mPublic').hidden = false;
  }
}
$('profileForm').onsubmit = async (e) => {
  e.preventDefault();
  if (!me) { $('authDialog').showModal(); return; }
  const body = {
    instruments: [...document.querySelectorAll('#mInstruments input:checked')].map((x) => x.value),
    genres: checkedValues('mGenres'),
    home_city: $('mCity').value || undefined,
    ...(taHome.coords() ? { home_lat: taHome.coords().lat, home_lng: taHome.coords().lng } : {}),
    travel_radius_km: parseInt($('mRadius').value, 10) || 30,
    level: $('mLevel').value || undefined,
    looking_for: [...document.querySelectorAll('#mLooking input:checked')].map((x) => x.value),
    accepts_dm: $('mDm').checked,
    reads_charts: $('mCharts').checked,
    sings_backing: $('mBacking').checked,
    own_transport: $('mTransport').checked,
    own_pa: $('mPa').checked,
    demo_links: $('mDemos').value.split('\\n').map((x) => x.trim()).filter(Boolean),
  };
  const r = await api('/musicians/me', { method: 'POST', body });
  if (r.ok) { flash(T('profile_saved'), 'ok'); loadProfile(); showProfileEdit(false); loadProfile(); }
  else if (r.json.code === 'city_unknown') { taHome.showUnknown(); flash(T('city_unknown'), 'err'); }
  else flash(r.json.error || T('failed'), 'err');
};

// ── Init ─────────────────────────────────────────────
['pGenres', 'bGenres', 'mGenres'].forEach(renderGenreChecks);
$('pKind').onchange();
for (const g of GENRES) $('bGenreF').append(new Option(genreLabel(g), g));
for (const i of INSTRUMENTS) {
  $('fInstrument').append(new Option(label(i), i));
  $('pInstrument').append(new Option(label(i), i));
  const cb = el('label');
  const input = el('input'); input.type = 'checkbox'; input.value = i;
  cb.append(input, document.createTextNode(label(i)));
  $('mInstruments').append(cb);
  const sb = el('label');
  const sInput = el('input'); sInput.type = 'checkbox'; sInput.value = i;
  sb.append(sInput, document.createTextNode(label(i)));
  $('bSeats').append(sb);
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

// ── Messages ─────────────────────────────────────────
async function refreshMsgBadge() {
  if (!me) { $('msgBadge').hidden = true; return; }
  const r = await api('/messages/threads');
  const n = r.ok ? r.json.unread_total : 0;
  $('msgBadge').textContent = n;
  $('msgBadge').hidden = !n;
}
async function loadThreads() {
  const wrap = $('msgArea');
  wrap.replaceChildren();
  if (!me) { wrap.append(el('div', 'empty', T('login_to_see'))); return; }
  const r = await api('/messages/threads');
  refreshMsgBadge();
  if (!r.ok || !r.json.threads.length) { wrap.append(el('div', 'empty', T('no_threads'))); return; }
  for (const th of r.json.threads) {
    const card = el('div', 'card thread');
    const initials = th.counterpart.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    card.append(el('div', 'avatar', initials));
    const mid = el('div');
    mid.style.flex = '1'; mid.style.minWidth = '0';
    mid.append(el('strong', '', th.counterpart));
    mid.append(el('div', 'muted', th.thread_type === 'dm' ? T('dm_ctx') : th.context));
    if (th.last_body) {
      const prev = el('div', 'muted', th.last_body.slice(0, 60));
      prev.style.overflow = 'hidden'; prev.style.textOverflow = 'ellipsis'; prev.style.whiteSpace = 'nowrap';
      mid.append(prev);
    }
    card.append(mid);
    if (th.unread) card.append(el('span', 'tag status-booked', String(th.unread)));
    card.onclick = () => openThread(th.thread_type, th.thread_id, th.counterpart);
    wrap.append(card);
  }
  wrap.append(askLine());
}
function showMsgsTab() {
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'msgs'));
  TABS.forEach((t) => { $('tab-' + t).hidden = t !== 'msgs'; });
  window.scrollTo({ top: 0 });
}
// One chat screen for existing threads and not-yet-created ones (first DM,
// first band inquiry). Full history, day separators, sticky composer, polling.
let chatPoll = null;
function stopChat() {
  if (chatPoll) { clearInterval(chatPoll); chatPoll = null; }
  document.body.classList.remove('chat-open');
}
function dayLabel(iso) {
  const d = new Date(iso.replace(' ', 'T') + (iso.length <= 19 ? 'Z' : ''));
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return T('today');
  if (same(d, y)) return T('yesterday');
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}
function timeLabel(iso) {
  const d = new Date(iso.replace(' ', 'T') + (iso.length <= 19 ? 'Z' : ''));
  return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}
function renderChat(opts) {
  // opts: { title, context, send(text) -> api result, load() -> {messages, blocked_by_me}|null, onBlock? }
  showMsgsTab();
  stopChat();
  document.body.classList.add('chat-open');
  const wrap = $('msgArea');
  wrap.replaceChildren();
  const chat = el('div', 'chat');
  const head = el('div', 'chat-head');
  const back = el('button', 'chat-back', '\u2190');
  back.setAttribute('aria-label', T('back'));
  back.onclick = () => { stopChat(); loadThreads(); };
  const initials = (opts.title || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const who = el('div', 'who');
  who.append(el('strong', '', opts.title || ''), el('span', '', opts.context || ''));
  head.append(back, el('div', 'avatar', initials), who);
  if (opts.onBlock) { const bb = el('button', 'ghost small', ''); bb.id = 'chatBlock'; head.append(bb); }
  chat.append(head);
  const log = el('div', 'chat-log');
  chat.append(log);
  const composer = el('div', 'composer');
  const input = el('textarea');
  input.rows = 1;
  input.placeholder = T('msg_placeholder');
  input.oninput = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; };
  const send = el('button', 'primary send');
  send.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  send.setAttribute('aria-label', T('msg_send'));
  composer.append(input, send);
  chat.append(composer);
  wrap.append(chat);

  let lastId = 0, lastDay = '';
  const scrollBottom = () => { log.scrollTop = log.scrollHeight; };
  const append = (m) => {
    const day = dayLabel(m.created_at);
    if (day !== lastDay) { log.append(el('div', 'chat-day', day)); lastDay = day; }
    const b = el('div', 'bubble ' + (m.mine ? 'mine' : 'theirs'), m.body);
    b.append(el('time', '', timeLabel(m.created_at)));
    log.append(b);
    if (m.id > lastId) lastId = m.id;
  };
  const doSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    send.disabled = true;
    const res = await opts.send(text);
    send.disabled = false;
    if (res.ok) { input.value = ''; input.style.height = 'auto'; if (opts.afterFirstSend) { opts.afterFirstSend(res); return; } await poll(); input.focus(); }
    else if (res.json.code === 'email_unconfirmed') flash(T('confirm_to_contact'), 'err');
    else if (res.json.code === 'blocked') flash(T('blocked_msg'), 'err');
    else if (res.json.code === 'dm_closed') flash(T('dm_closed'), 'err');
    else flash(res.json.error || T('failed'), 'err');
  };
  send.onclick = doSend;
  input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); doSend(); } };
  const poll = async () => {
    if (!opts.load) return;
    const r = await opts.load(lastId);
    if (!r) return;
    if (r.messages.length) { const empty = log.querySelector('.empty'); if (empty) empty.remove(); r.messages.forEach(append); scrollBottom(); refreshMsgBadge(); }
    if (r.context !== undefined && !opts.context) { const sp = who.querySelector('span'); if (sp && !sp.textContent) sp.textContent = r.context; }
    if (opts.onBlock && $('chatBlock')) {
      const bb = $('chatBlock'); bb.textContent = T(r.blocked_by_me ? 'unblock' : 'block');
      bb.onclick = () => opts.onBlock(!!r.blocked_by_me);
    }
  };
  (async () => {
    if (opts.load) { await poll(); if (!lastId) log.append(el('div', 'empty', opts.hint || T('thread_empty'))); }
    else log.append(el('div', 'empty', opts.hint || ''));
    scrollBottom();
    if (opts.load) chatPoll = setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 4000);
  })();
  input.focus();
}
function openCompose(title, context, send) {
  renderChat({
    title, context, send, load: null, hint: T('compose_hint', title || ''),
    afterFirstSend: (res) => openThread(res.json.thread_type, res.json.thread_id, title),
  });
}
async function openThread(type, id, title) {
  renderChat({
    title,
    context: type === 'dm' ? T('dm_ctx') : undefined,
    load: async (after) => {
      const r = await api('/messages/' + type + '/' + id + (after ? '?after=' + after : ''));
      if (!r.ok) { if (!after) { flash(r.json.error || T('failed'), 'err'); stopChat(); loadThreads(); } return null; }
      return r.json;
    },
    send: (text) => api('/messages/' + type + '/' + id, { method: 'POST', body: { body: text } }),
    onBlock: async (isBlocked) => {
      if (!isBlocked && !confirm(T('block_confirm', title || ''))) return;
      const res = await api('/messages/block', { method: 'POST', body: { thread_type: type, thread_id: id, unblock: isBlocked } });
      if (res.ok) { flash(T(res.json.blocked ? 'blocked_ok' : 'unblocked_ok'), 'ok'); if (res.json.blocked) { stopChat(); loadThreads(); } else openThread(type, id, title); }
      else flash(res.json.error || T('failed'), 'err');
    },
  });
}
async function refreshMsgBadge() {
  if (!me) { $('msgBadge').hidden = true; return; }
  const r = await api('/messages/threads');
  const n = r.ok ? r.json.unread_total : 0;
  $('msgBadge').textContent = n;
  $('msgBadge').hidden = !n;
}
async function loadThreads() {
  const wrap = $('msgArea');
  wrap.replaceChildren();
  if (!me) { wrap.append(el('div', 'empty', T('login_to_see'))); return; }
  const r = await api('/messages/threads');
  refreshMsgBadge();
  if (!r.ok || !r.json.threads.length) { wrap.append(el('div', 'empty', T('no_threads'))); return; }
  for (const th of r.json.threads) {
    const card = el('div', 'card thread');
    const initials = th.counterpart.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    card.append(el('div', 'avatar', initials));
    const mid = el('div');
    mid.style.flex = '1'; mid.style.minWidth = '0';
    mid.append(el('strong', '', th.counterpart));
    mid.append(el('div', 'muted', th.thread_type === 'dm' ? T('dm_ctx') : th.context));
    if (th.last_body) {
      const prev = el('div', 'muted', th.last_body.slice(0, 60));
      prev.style.overflow = 'hidden'; prev.style.textOverflow = 'ellipsis'; prev.style.whiteSpace = 'nowrap';
      mid.append(prev);
    }
    card.append(mid);
    if (th.unread) card.append(el('span', 'tag status-booked', String(th.unread)));
    card.onclick = () => openThread(th.thread_type, th.thread_id, th.counterpart);
    wrap.append(card);
  }
  wrap.append(askLine());
}
// A conversation page that does not exist yet (first DM, first band inquiry):
// same layout as a thread, the first send creates it and hands over to openThread.

// ── Bands ────────────────────────────────────────────
let lastProfile = null;
function renderOnboard() {
  const box = $('onboard');
  if (!me || localStorage.getItem('onboard_done') === '1') { box.hidden = true; return; }
  const p = lastProfile;
  const d1 = !!(p && (p.instruments || []).length && p.home_city);
  const d2 = $('notifBtn').classList.contains('on');
  $('ob1t').classList.toggle('done', d1); $('ob1t').textContent = d1 ? '\u2713' : '1'; $('ob1x').classList.toggle('done', d1); $('ob1b').hidden = d1;
  $('ob2t').classList.toggle('done', d2); $('ob2t').textContent = d2 ? '\u2713' : '2'; $('ob2x').classList.toggle('done', d2); $('ob2b').hidden = d2;
  $('ob3t').classList.toggle('done', d1 && d2); $('ob3t').textContent = d1 && d2 ? '\u2713' : '3';
  if (d1 && d2) { localStorage.setItem('onboard_done', '1'); box.hidden = true; return; }
  box.hidden = false;
}
$('ob1b').onclick = () => { document.querySelector('[data-tab=profile]').click(); showProfileEdit(true); };
$('ob2b').onclick = () => $('notifBtn').click();
let editingBand = null;
let bandFilter = '';
function showBandForm(b) {
  editingBand = b || null;
  const f = $('bandForm');
  f.reset();
  $('bName').value = b ? b.name : '';
  $('bCity').value = b ? (b.home_city || '') : '';
  delete $('bCity').dataset.lat; delete $('bCity').dataset.lng;
  setChecked('bGenres', b ? b.genres : []);
  $('bDesc').value = b ? (b.description || '') : '';
  $('bLinks').value = b ? (b.links || []).join('\\n') : '';
  $('bPitch').value = b ? (b.pitch || '') : '';
  $('bFee').value = b && b.fee_from ? b.fee_from : '';
  $('bCur').value = b ? (b.fee_currency || 'CHF') : 'CHF';
  $('bBookable').checked = !!(b && b.bookable);
  document.querySelector('input[name=bKind][value=' + (b && b.kind === 'jam' ? 'jam' : 'band') + ']').checked = true;
  $('bSeatsRow').hidden = !!b;
  syncBandForm();
  $('bandSubmit').textContent = T(b ? 'save_band' : 'start_band');
  $('bandFormCard').hidden = false;
  $('bandIntro').hidden = true;
  $('bandFormCard').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function hideBandForm() { $('bandFormCard').hidden = true; $('bandIntro').hidden = false; editingBand = null; }
function syncBandForm() {
  const isJam = document.querySelector('input[name=bKind]:checked').value === 'jam';
  $('bBookRow').hidden = isJam;
  $('bBookFields').hidden = isJam || !$('bBookable').checked;
}
document.querySelectorAll('input[name=bKind]').forEach((r) => { r.onchange = syncBandForm; });
$('bBookable').onchange = syncBandForm;
$('bandNewBtn').onclick = () => { if (!me) { $('authDialog').showModal(); return; } showBandForm(null); };
$('bandCancel').onclick = hideBandForm;
$('bandForm').onsubmit = async (e) => {
  e.preventDefault();
  if (!me) { $('authDialog').showModal(); return; }
  const fee = parseInt($('bFee').value, 10);
  const body = {
    name: $('bName').value,
    home_city: $('bCity').value || undefined,
    ...(taBand.coords() ? { home_lat: taBand.coords().lat, home_lng: taBand.coords().lng } : {}),
    genres: checkedValues('bGenres'),
    description: $('bDesc').value,
    links: $('bLinks').value.split('\\n').map((x) => x.trim()).filter(Boolean),
    kind: document.querySelector('input[name=bKind]:checked').value,
    bookable: $('bBookable').checked,
    fee_from: fee > 0 ? fee : undefined,
    fee_currency: $('bCur').value,
    pitch: $('bPitch').value,
    seats: [...document.querySelectorAll('#bSeats input:checked')].map((x) => x.value),
  };
  const r = editingBand
    ? await api('/bands/' + editingBand.id, { method: 'PUT', body })
    : await api('/bands', { method: 'POST', body });
  if (r.ok) { flash(T(editingBand ? 'band_saved' : 'band_created'), 'ok'); hideBandForm(); loadBands(); }
  else if (r.json.code === 'city_unknown') { taBand.showUnknown(); flash(T('city_unknown'), 'err'); }
  else flash(r.json.error || T('failed'), 'err');
};
document.querySelectorAll('#bandSeg button').forEach((b) => {
  b.onclick = () => { bandFilter = b.dataset.bkind; loadBands(); };
});
$('bGo').onclick = loadBands;
$('bCityF').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadBands(); } });
$('bGenreF').onchange = loadBands;
function feeText(b) {
  if (!b.bookable) return '';
  return b.fee_from ? T('from_fee', b.fee_currency + ' ' + Number(b.fee_from).toLocaleString('de-CH')) : T('fee_on_request');
}
async function inquireBand(b) {
  if (!me) { $('authDialog').showModal(); return; }
  if (!me.confirmed) { flash(T('confirm_to_contact'), 'err'); return; }
  openCompose(b.name, T('inquiry_ctx'), (text) => api('/bands/' + b.id + '/inquire', { method: 'POST', body: { message: text } }));
}
async function loadBands() {
  document.querySelectorAll('#bandSeg button').forEach((x) => x.classList.toggle('active', x.dataset.bkind === bandFilter));
  const city = $('bCityF').value.trim();
  await renderBands({
    wrap: $('bandsList'), kind: 'band', bookable: bandFilter === 'bookable', genre: $('bGenreF').value,
    city, radius: $('bRadiusF').value, coords: taBandF.coords(), summary: $('bandSummary'), emptyKey: 'no_bands_near', countKey: 'bands_n',
  });
}
async function renderBands(o) {
  const wrap = o.wrap;
  wrap.replaceChildren(el('div', 'empty', T('loading')));
  if (o.summary) o.summary.hidden = true;
  const params = new URLSearchParams();
  params.set('kind', o.kind);
  if (o.bookable) params.set('bookable', '1');
  if (o.genre) params.set('genre', o.genre);
  const city = o.city;
  if (city) {
    params.set('city', city);
    params.set('radius_km', o.radius);
    if (o.coords) { params.set('lat', o.coords.lat); params.set('lng', o.coords.lng); }
  }
  const r = await api('/bands' + (params.toString() ? '?' + params : ''));
  wrap.replaceChildren();
  const list = r.json.bands || [];
  const summaryText = T(o.countKey, list.length) + (city ? ' \u00b7 ' + city + ' \u00b7 ' + o.radius + ' km' : '');
  if (!list.length) { wrap.append(el('div', 'empty', T(o.emptyKey))); return; }
  if (o.summary) { o.summary.hidden = false; o.summary.textContent = summaryText; }
  else wrap.append(el('p', 'muted board-summary', summaryText));
  for (const b of list) {
    const card = el('div', 'card');
    const head = el('div', 'gig-head');
    const nameA = el('a', '', b.name);
    nameA.href = '/b/' + b.id + '-' + b.slug; nameA.style.fontWeight = '700'; nameA.style.color = 'inherit'; nameA.style.textDecoration = 'none';
    head.append(nameA);
    const metaBits = [];
    if (b.kind === 'jam') metaBits.push(T('jam_group'));
    if (b.home_city) metaBits.push(b.home_city + (b.distance_km != null ? ' (' + b.distance_km + ' km)' : ''));
    metaBits.push(T('members_n2', b.member_count));
    head.append(el('span', 'muted', metaBits.join(' \u00b7 ')));
    card.append(head);
    const tags = el('div');
    if (b.bookable) {
      const fee = el('span', 'tag hot', feeText(b));
      fee.style.background = 'var(--accent-tint)'; fee.style.color = 'var(--accent-deep)'; fee.style.borderColor = 'var(--accent-tint-line)'; fee.style.fontWeight = '700';
      tags.append(fee, document.createTextNode(' '));
    }
    (b.genres || []).forEach((x) => tags.append(el('span', 'tag', genreLabel(x)), document.createTextNode(' ')));
    card.append(tags);
    if (b.pitch) card.append(el('p', '', b.pitch));
    if (b.description) { const d = el('p', 'muted', b.description.length > 220 ? b.description.slice(0, 220) + '\u2026' : b.description); card.append(d); }
    (b.media || []).slice(0, 2).forEach((m) => card.append(mediaEl(m)));
    const bar = el('div', 'actions');
    bar.style.display = 'flex'; bar.style.gap = '8px'; bar.style.flexWrap = 'wrap';
    if (b.is_mine) {
      const edit = el('button', 'ghost small', T('edit'));
      edit.onclick = () => showBandForm(b);
      const manage = el('button', 'ghost small', T('manage'));
      manage.onclick = () => showBandManage(b.id, card);
      bar.append(edit, manage);
    } else {
      const contact = el('button', (b.bookable ? 'primary' : 'ghost') + ' small', T(b.bookable ? 'book_band' : (b.kind === 'jam' ? 'ask_to_join' : 'contact_band')));
      contact.onclick = () => inquireBand(b);
      bar.append(contact);
      for (const seat of b.open_seats) {
        const btn = el('button', 'ghost small', T('apply') + ' \u2014 ' + label(seat.instrument));
        btn.onclick = async () => {
          if (!me) { $('authDialog').showModal(); return; }
          const note = prompt(T('note_prompt')) || '';
          const res = await api('/bands/seats/' + seat.id + '/apply', { method: 'POST', body: { note } });
          if (res.ok) flash(T('applied_seat_ok'), 'ok');
          else flash(res.json.error || T('could_not_apply'), 'err');
        };
        bar.append(btn);
      }
    }
    const page = el('a', 'muted', T('view_band_page'));
    page.href = '/b/' + b.id + '-' + b.slug; page.style.alignSelf = 'center'; page.style.fontSize = '13px';
    bar.append(page);
    card.append(bar);
    wrap.append(card);
  }
  wrap.append(askLine());
}
async function showBandManage(bandId, card) {
  const r = await api('/bands/' + bandId);
  card.querySelectorAll('.application').forEach((n) => n.remove());
  for (const s of r.json.seats || []) {
    const row = el('div', 'application');
    const head = el('div', 'applicant-head');
    const who = el('div');
    who.style.flex = '1';
    who.append(el('strong', '', label(s.instrument)));
    if (s.member) {
      const meta = el('div', 'applicant-meta');
      meta.append(el('span', '', s.member.display_name));
      if (s.member.avg_rating != null) meta.append(el('span', 'rating', '\u2605 ' + s.member.avg_rating));
      if (s.member.gigs_played != null) meta.append(el('span', '', T('applications_gigs', s.member.gigs_played)));
      who.append(meta);
    }
    head.append(who, el('span', 'tag', TS(s.status)));
    row.append(head);
    if (s.status === 'open') {
      const apps = (r.json.applications || []).filter((a) => a.seat_id === s.id && a.status === 'applied');
      for (const a of apps) {
        const line = el('div', 'applicant-meta');
        line.append(el('span', '', a.display_name));
        if (a.review_count > 0) line.append(el('span', 'rating', '\u2605 ' + a.avg_rating + ' (' + a.review_count + ')'));
        if (a.gigs_played != null) line.append(el('span', '', T('applications_gigs', a.gigs_played)));
        if (a.handle) {
          const prof = el('a', 'muted', T('view_profile'));
          prof.href = '/m/' + a.handle; prof.target = '_blank'; prof.rel = 'noopener noreferrer';
          line.append(prof);
        }
        const msgB = el('button', 'ghost small', T('msg_btn'));
        msgB.onclick = () => openThread('seat', a.id, a.display_name);
        line.append(msgB);
        const acc = el('button', 'primary small', T('book', a.display_name));
        acc.onclick = async () => {
          const res = await api('/bands/seats/' + s.id + '/applications/' + a.id + '/accept', { method: 'POST' });
          if (res.ok) { flash(T('joined_ok', res.json.musician_email), 'ok'); loadBands(); }
          else flash(res.json.error || T('failed'), 'err');
        };
        line.append(acc);
        row.append(line);
        if (a.note) row.append(el('p', 'muted', a.note));
      }
      const closeBtn = el('button', 'ghost small', T('close_seat'));
      closeBtn.onclick = async () => {
        const res = await api('/bands/seats/' + s.id + '/close', { method: 'POST' });
        if (res.ok) { flash(T('seat_closed'), 'ok'); loadBands(); } else flash(res.json.error || T('failed'), 'err');
      };
      row.append(closeBtn);
    }
    card.append(row);
  }
  const addRow = el('div', 'application');
  const sel = el('select');
  INSTRUMENTS.forEach((i) => sel.append(new Option(label(i), i)));
  sel.style.width = 'auto';
  const addBtn = el('button', 'ghost small', T('add_seat'));
  addBtn.onclick = async () => {
    const res = await api('/bands/' + bandId + '/seats', { method: 'POST', body: { instrument: sel.value } });
    if (res.ok) { flash(T('seat_added'), 'ok'); showBandManage(bandId, card); } else flash(res.json.error || T('failed'), 'err');
  };
  addRow.append(sel, document.createTextNode(' '), addBtn);
  card.append(addRow);
}

// ── Web push ─────────────────────────────────────────
let vapidKey = null;
function vapidBytes(key) {
  const pad = '='.repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
async function currentSub() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}
async function refreshNotifBtn() { try { return await refreshNotifBtnInner(); } finally { if (typeof renderOnboard === 'function') renderOnboard(); } }
async function refreshNotifBtnInner() {
  const supported = me && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) { $('notifBtn').hidden = true; return; }
  if (vapidKey === null) vapidKey = (await api('/push/vapid')).json.key || false;
  if (!vapidKey) { $('notifBtn').hidden = true; return; }
  const sub = await currentSub().catch(() => null);
  $('notifLabel').textContent = sub ? T('alerts_on') : T('alerts');
  $('notifBtn').classList.toggle('on', !!sub);
  $('notifBtn').setAttribute('aria-label', sub ? T('alerts_on') : T('alerts'));
  $('notifBtn').title = sub ? T('alerts_on') : T('alerts');
  $('notifBtn').hidden = false;
}
// iOS Safari only allows Web Push for apps added to the Home Screen; in the
// plain browser Notification/PushManager do not exist. Guide instead of failing.
function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function pushUnsupportedHint() {
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !isStandalone()) { openInstallDialog(); return; }
  flash(T('alerts_unsupported'), 'err');
}
async function subscribeAlerts() {
  if (!pushSupported()) { pushUnsupportedHint(); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { flash(T('notif_blocked'), 'err'); return; }
  if (vapidKey === null) vapidKey = (await api('/push/vapid')).json.key || false;
  if (!vapidKey) { flash(T('alerts_enable_fail'), 'err'); return; }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(vapidKey) });
  const r = await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
  if (r.ok) flash(T('alerts_on_msg'), 'ok');
  else flash(r.json.error || T('alerts_enable_fail'), 'err');
}
$('notifBtn').onclick = async () => {
  if (!pushSupported()) { pushUnsupportedHint(); return; }
  try {
    const existing = await currentSub();
    if (existing) {
      await api('/push/unsubscribe', { method: 'POST', body: { endpoint: existing.endpoint } });
      await existing.unsubscribe();
      flash(T('alerts_off'), 'ok');
    } else {
      await subscribeAlerts();
    }
  } catch (err) {
    flash(T('alerts_error'), 'err');
  }
  refreshNotifBtn();
};
$('langSel').value = lang;
$('langSel').onchange = async () => {
  localStorage.setItem('lang', $('langSel').value);
  if (me) await api('/auth/lang', { method: 'POST', body: { lang: $('langSel').value } }).catch(() => {});
  location.reload();
};
applyI18n();
(async () => {
  const q = new URLSearchParams(location.search);
  if (q.get('confirmed') === '1') flash(T('email_confirmed'), 'ok');
  if (q.get('confirmed') === '0') flash(T('confirm_invalid'), 'err');
  const resetToken = q.get('reset');
  if (resetToken) {
    const pw = prompt(T('new_pw_prompt'));
    if (pw) {
      const r = await api('/auth/reset', { method: 'POST', body: { token: resetToken, password: pw } });
      if (r.ok) { me = { email: r.json.email, confirmed: true }; flash(T('pw_updated'), 'ok'); }
      else flash(r.json.error || T('reset_failed'), 'err');
    }
  }
  const deepBand = q.get('band'), deepTab = q.get('tab'), deepDm = q.get('dm');
  if (q.toString()) history.replaceState(null, '', '/');
  const r = await api('/auth/me');
  if (r.ok) me = { email: r.json.email, confirmed: !!r.json.confirmed, photo: r.json.photo || null, name: r.json.name || '', handle: r.json.handle || null };
  renderAuth(); loadProfile();
  const deepGig = q.get('gig');
  if (deepGig) {
    landingDismissed = true; $('landing').hidden = true;
    document.querySelector('[data-tab=board]').click();
    boardSeq++; const seqNow = boardSeq;
    await loadBoard();
    const card = $('gig-' + deepGig);
    if (card) { card.scrollIntoView({ block: 'center' }); card.classList.add('hilite'); setTimeout(() => card.classList.remove('hilite'), 2500); }
  } else if (!(deepTab === 'jams' || deepTab === 'band' || deepBand)) mountBoard('musicians');
  if (q.get('feedback') === '1') openFeedback();
  if (deepTab === 'help') $('howBtn').onclick();
  if (deepTab === 'jams') { landingDismissed = true; $('landing').hidden = true; document.querySelector('[data-tab=jams]').click(); }
  if (deepDm) { if (!me) { $('authDialog').showModal(); } else dmUser(deepDm, ''); }
  if (deepTab === 'band' || deepBand) {
    landingDismissed = true; $('landing').hidden = true;
    document.querySelector('[data-tab=bands]').click();
    if (deepBand) {
      const bd = await api('/bands/' + deepBand);
      if (bd.ok && !bd.json.is_mine) inquireBand(bd.json);
    }
  }
})();
</script>
</body>
</html>`;
