// src/ui.ts
// Single-page UI over the JSON API. Server ships static HTML + vanilla JS;
// all state lives in the API. Rendering uses DOM building (textContent),
// never innerHTML with user data.
// Ambient layers for the "backstage editorial" theme (mirrors design/):
// an audio-waveform strip along the header's bottom edge, and a faint violet
// scatter of notation behind the page. Deterministic — same field every load.
import { MEDIA_CSS } from './media';
import { PLACES_JSON } from './places';

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
  #msgBadge { background: var(--accent); color: #fff; border-radius: 999px; padding: 1px 8px; font-size: 12px; margin-left: 6px; }
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
    header .tagline, header .who, header #howBtn { display: none; }
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
    nav #msgBadge { position: absolute; top: 4px; left: calc(50% + 6px); margin: 0; padding: 0 5px; min-width: 16px; height: 16px; font-size: 10.5px; line-height: 16px; }
    /* Tab bar is 63px tall (+ safe area); the footer's bottom padding hides
       under it exactly, and the waveform stands on the tab bar's top edge. */
    footer { padding-bottom: calc(63px + 28px + env(safe-area-inset-bottom)); margin-top: 32px; }
    footer .wave { bottom: calc(63px + env(safe-area-inset-bottom) - 2px); }
    .actions { flex-direction: column; }
    .actions > button { width: 100%; }
    .aud-cta { align-self: stretch; width: 100%; }
    #landing .cta-row { flex-direction: column; }
    #landing .cta-row > button { width: 100%; }
    .filters button.ghost { flex: 1 1 100%; }
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
    display: flex !important; align-items: center; gap: 11px; padding: 12px 18px 15px 12px; border-radius: 16px; overflow: hidden;
    background-color: var(--ink); background-image: radial-gradient(circle at 88% -40%, rgba(100,64,251,0.45), transparent 60%);
    color: #fff; font-size: 14.5px; font-weight: 500; box-shadow: 0 14px 38px rgba(20,19,26,0.35);
    opacity: 0; pointer-events: none; transition: opacity 0.22s ease, transform 0.22s ease; cursor: pointer; }
  #flash.show { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
  #flash .fi { flex: 0 0 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; }
  #flash.ok .fi { background: var(--ok); color: #fff; }
  #flash.err .fi { background: #e0524a; color: #fff; }
  #flash .fbar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--accent-light); transform-origin: left; animation: fbar 5s linear forwards; }
  @keyframes fbar { to { transform: scaleX(0); } }
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
  .filters button.ghost { min-height: 46px; border-radius: 999px; }
  .filters button.busy { opacity: .6; }
  .board-summary { margin: 0 0 10px; font-size: 13.5px; }
  .card.musician { cursor: pointer; }
  .card.musician .mname { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 17px; font-weight: 700; color: inherit; text-decoration: none; }
  .card.musician .chips { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
  .tag.hot { color: var(--accent-deep); border-color: var(--accent-tint-line); background: var(--accent-tint); }
  .alerts-on-line { color: var(--ok); font-weight: 600; margin: 0 0 12px; }
  .seg { display: flex; background: #232230; border-radius: 12px; padding: 4px; gap: 4px; flex: 1 1 100%; max-width: 360px; }
  .seg button { flex: 1; border: 0; background: transparent; color: #b9b6c9; border-radius: 9px; padding: 10px 0; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; min-height: 42px; }
  .seg button.active { background: var(--accent); color: #fff; font-weight: 600; }
  .empty { text-align: center; padding: 36px 10px; color: var(--muted); }
  dialog { border: 1px solid var(--line); border-radius: var(--r); padding: 20px; max-width: 420px; width: 92%; background: var(--card); }
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
  .composer { display: flex; gap: 8px; margin-top: 12px; }
  .composer textarea { flex: 1; min-height: 48px; }
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
  <button class="ghost small" id="howBtn" hidden style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.35);" data-i18n="how_it_works">How it works</button>
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
  <button data-tab="board" class="active"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><span class="lf" data-i18n="nav_board">Gig board</span><span class="ls" data-i18n="nav_board_s">Gigs</span></button>
  <button data-tab="post"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg><span class="lf" data-i18n="nav_post">Post a gig</span><span class="ls" data-i18n="nav_post_s">Post</span></button>
  <button data-tab="mine"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg><span class="lf" data-i18n="nav_mine">My gigs</span><span class="ls" data-i18n="nav_mine_s">My gigs</span></button>
  <button data-tab="bands"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="lf" data-i18n="nav_bands">Bands</span><span class="ls" data-i18n="nav_bands_s">Bands</span></button>
  <button data-tab="msgs"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg><span class="lf" data-i18n="nav_msgs">Messages</span><span class="ls" data-i18n="nav_msgs_s">Messages</span><span id="msgBadge" hidden></span></button>
  <button data-tab="profile"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="lf" data-i18n="nav_profile">Musician profile</span><span class="ls" data-i18n="nav_profile_s">Profile</span></button>
</nav>
<main>
  <div class="msg" id="flash"></div>

  <section id="tab-board">
    <div id="landing" hidden>
      <div style="background-color: var(--ink); background-image: radial-gradient(circle at 85% -20%, rgba(100,64,251,0.45), transparent 60%); border-radius: 16px; padding: 34px 24px 40px; text-align: center; position: relative; z-index: 0; overflow: hidden; margin-bottom: 12px; color: #fff;">
        ${WAVE_SVG}
        <div class="display" style="font-size: 30px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; margin-bottom: 12px;" data-i18n="land_head">Find a dep. Fill a gig. Start a band.</div>
        <p style="max-width: 560px; margin: 0 auto 22px; color: rgba(255,255,255,0.72); font-size: 15px;" data-i18n="land_sub">JamWerk connects local musicians: paid gigs with public fees, free jam partners, and open band seats — matched to your instrument and your area.</p>
        <div class="cta-row" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button class="primary" id="ctaJoin" data-i18n="cta_join">Create your free profile</button>
          <button class="ghost" id="ctaPeople" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.4);" data-i18n="cta_people">See who's here</button>
          <button class="ghost" id="ctaBrowse" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.4);" data-i18n="cta_browse">Browse the board</button>
        </div>
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
      <div class="card" id="landTiles" style="display: flex; flex-direction: column; gap: 14px;">
        <div data-goto="board" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></span>
          <span><b data-i18n="nav_board">Gig board</b><br><span class="muted" data-i18n="land_d_board">Every open gig and jam near you — public fees, filtered by instrument and distance.</span></span>
        </div>
        <div data-goto="post" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"></rect><path d="M12 8v8M8 12h8"></path></svg></span>
          <span><b data-i18n="nav_post">Post a gig</b><br><span class="muted" data-i18n="land_d_post">Need a dep or jam partners? Post in two minutes — matching musicians nearby get alerted.</span></span>
        </div>
        <div data-goto="mine" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path></svg></span>
          <span><b data-i18n="nav_mine">My gigs</b><br><span class="muted" data-i18n="land_d_mine">Track your posts and applications, book musicians, leave reviews after the gig.</span></span>
        </div>
        <div data-goto="bands" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"></path><circle cx="17.5" cy="9" r="2.8"></circle><path d="M15.5 14.8c2.8.3 6 1.9 6 5.2"></path></svg></span>
          <span><b data-i18n="nav_bands">Bands</b><br><span class="muted" data-i18n="land_d_bands">Start a band with open seats, or join one — with members\u2019 real track records.</span></span>
        </div>
        <div data-goto="profile" style="display: flex; gap: 12px; align-items: flex-start; cursor: pointer; min-height: 44px;">
          <span style="width: 36px; height: 36px; border-radius: 10px; background: var(--accent-tint); color: var(--accent-deep); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path></svg></span>
          <span><b data-i18n="nav_profile">Musician profile</b><br><span class="muted" data-i18n="land_d_profile">Your instruments, demos, and reviews — plus a public page you can share anywhere.</span></span>
        </div>
      </div>
      <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; gap: 12px; align-items: baseline;"><span class="display" style="font-size: 22px; font-weight: 800; color: var(--accent); flex-shrink: 0;">1</span><span class="muted" data-i18n="land_s1">Create your free musician profile: instruments, city, travel radius.</span></div>
        <div style="display: flex; gap: 12px; align-items: baseline;"><span class="display" style="font-size: 22px; font-weight: 800; color: var(--accent); flex-shrink: 0;">2</span><span class="muted" data-i18n="land_s2">Browse or post: paid gigs, jam sessions, band seats. Turn on alerts and matches reach your phone.</span></div>
        <div style="display: flex; gap: 12px; align-items: baseline;"><span class="display" style="font-size: 22px; font-weight: 800; color: var(--accent); flex-shrink: 0;">3</span><span class="muted" data-i18n="land_s3">Book or connect. Completed gigs earn reviews that build your public track record.</span></div>
      </div>
      <div class="card" style="display: flex; align-items: center; gap: 12px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6440fb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path></svg>
        <p class="muted" style="margin: 0;" data-i18n="land_alerts">Tap the bell after signing up — gigs for your instrument near you reach your phone the moment they are posted.</p>
      </div>
    </div>
    <div class="filters">
      <div class="seg" id="kindSeg">
        <button type="button" data-kind="gig" class="active" data-i18n="seg_gigs">Paid gigs</button>
        <button type="button" data-kind="practice" data-i18n="seg_practice">Practice partners</button>
        <button type="button" data-kind="musicians" data-i18n="seg_musicians">Musicians</button>
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
      <button class="ghost" id="fGo" data-i18n="btn_filter">Filter</button>
    </div>
    <div id="board"></div>
  </section>

  <section id="tab-post" hidden>
    <div class="msg warn" id="confirmBanner" hidden style="display: none; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;">
      <span data-i18n="confirm_needed">Confirm your email address to post paid gigs — check your inbox (and spam folder).</span>
      <button type="button" class="ghost small" id="resendConfirmBtn" data-i18n="resend_confirm">Resend the email</button>
    </div>
    <div class="card"><form id="postForm">
      <div class="row"><label data-i18n="listing_type">Listing type</label>
        <select id="pKind">
          <option value="gig" data-i18n="opt_gig">Paid gig — dated, fixed fee</option>
          <option value="practice" data-i18n="opt_practice">Practice partner — free, open-ended</option>
        </select>
      </div>
      <div class="grid2">
        <div class="row"><label data-i18n="instrument_needed">Instrument needed</label><select id="pInstrument" required></select></div>
        <div class="row" id="pDateRow"><label data-i18n="date">Date</label><input type="date" id="pDate" required></div>
        <div class="row"><label data-i18n="city">City</label><input type="text" id="pCity" required placeholder="Genève" data-i18n-ph="ph_city_ex"></div>
        <div class="row" id="pFeeRow"><label data-i18n="fee">Fee (whole gig)</label>
          <div style="display: flex; gap: 8px;"><select id="pCurrency" style="width: auto; flex: 0 0 auto;" aria-label="Currency"><option value="CHF">CHF</option><option value="EUR">EUR</option></select><input type="number" id="pFee" min="1" required placeholder="300" style="flex: 1;"></div>
        </div>
        <div class="row"><label data-i18n="call_time">Call time</label><input type="time" id="pCall"></div>
        <div class="row"><label data-i18n="end_time">End time</label><input type="time" id="pEnd"></div>
      </div>
      <div class="row"><label data-i18n="genres_csv">Genres (comma-separated)</label><input type="text" id="pGenres" required placeholder="jazz, funk, samba"></div>
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
      <p class="muted" style="margin: 14px 0 0;"><span data-i18n="missing_q">Missing an instrument, a genre or an option?</span> <button type="button" class="linkish" data-fb="post" data-i18n="tell_us">Tell us →</button></p>
    </form></div>
  </section>

  <section id="tab-mine" hidden><div id="mine"></div></section>

  <section id="tab-msgs" hidden><div id="msgArea"></div></section>

  <section id="tab-bands" hidden>
    <div class="card"><form id="bandForm">
      <div class="grid2">
        <div class="row"><label data-i18n="band_name">Band name</label><input type="text" id="bName" required maxlength="80"></div>
        <div class="row"><label data-i18n="city">City</label><input type="text" id="bCity" placeholder="Genève" data-i18n-ph="ph_city_ex"></div>
      </div>
      <div class="row"><label data-i18n="genres_csv">Genres (comma-separated)</label><input type="text" id="bGenres" required placeholder="indie, rock"></div>
      <div class="row"><label data-i18n="description">Description</label><textarea id="bDesc"></textarea></div>
      <div class="row"><label data-i18n="links_l">Links — YouTube, Spotify, SoundCloud, Vimeo, Bandcamp… (one per line, max 5)</label><textarea id="bLinks" rows="3" placeholder="https://open.spotify.com/artist/…&#10;https://youtube.com/watch?v=…"></textarea></div>
      <div class="row"><label data-i18n="seats_l">Open seats (choose instruments)</label><div class="checks" id="bSeats"></div></div>
      <button class="primary" data-i18n="start_band">Start a band</button>
    </form></div>
    <div id="bandsList"></div>
  </section>

  <section id="tab-profile" hidden>
    <div class="mobile-only" style="display: flex; justify-content: flex-end; margin-bottom: 8px;"><button class="ghost small" id="logoutBtn2" data-i18n="logout">Log out</button></div>
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
      <div class="row"><label data-i18n="genres_csv">Genres (comma-separated)</label><input type="text" id="mGenres" required placeholder="jazz, funk, samba, wedding pop"></div>
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
          <label><input type="checkbox" value="dep"> <span data-i18n="lf_dep">paid dep gigs</span></label>
          <label><input type="checkbox" value="jam"> <span data-i18n="lf_jam">jam partners</span></label>
          <label><input type="checkbox" value="join_band"> <span data-i18n="lf_join_band">to join a band</span></label>
          <label><input type="checkbox" value="start_band"> <span data-i18n="lf_start_band">to start a band</span></label>
        </div>
      </div>
      <div class="row checks">
        <label><input type="checkbox" id="mCharts"> <span data-i18n="reads_charts">reads charts</span></label>
        <label><input type="checkbox" id="mBacking"> <span data-i18n="backing">backing vocals</span></label>
        <label><input type="checkbox" id="mTransport"> <span data-i18n="transport">own transport</span></label>
        <label><input type="checkbox" id="mPa"> <span data-i18n="own_pa">own PA</span></label>
      </div>
      <div class="row"><label data-i18n="demo_links_l">Demo links (one per line, max 5)</label><textarea id="mDemos" placeholder="https://youtube.com/watch?v=…&#10;https://open.spotify.com/track/…&#10;https://soundcloud.com/…"></textarea></div>
      <button class="primary" data-i18n="save_profile">Save profile</button>
      <span class="muted" id="mStats"></span>
      <a id="mPublic" target="_blank" rel="noopener" hidden style="margin-left: 10px;" data-i18n="public_page">View my public page &#8599;</a>
    </form></div>
  </section>
</main>

<footer>
  ${WAVE_SVG}
  <div class="inner">
    <span class="brand" id="footLogo">Jam<span>Werk</span></span>
    <span class="spacer"></span>
    <button type="button" id="footFeedback" data-i18n="feedback">Feedback</button>
    <button type="button" id="footHow" data-i18n="how_it_works">How it works</button>
    <button type="button" id="footInstall" data-i18n="install_link">Install the app</button>
    <span>&copy; 2026 JamWerk</span>
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
const INSTRUMENTS = ['vocals','guitar','bass','double_bass','drums','percussion','keys','piano','accordion','violin','viola','cello','trumpet','trombone','saxophone','clarinet','flute','harmonica','cavaquinho','dj','other'];
const I18N = {
  en: {
    nav_board_s: 'Gigs', nav_post_s: 'Post', nav_mine_s: 'My gigs', nav_bands_s: 'Bands', nav_msgs_s: 'Messages', nav_profile_s: 'Profile', nav_board: 'Gig board',
    nav_msgs: 'Messages', msg_btn: 'Message', msg_send: 'Send', msg_sent: 'Message sent.', msg_placeholder: 'Write a message\u2026', no_threads: 'No conversations yet — they start from an application.', thread_empty: 'No messages yet — say hello.', back: 'Back',
    cta_jam: 'Find jam partners', cta_gigs: 'See paid gigs', land_d_board: 'Every open gig and jam near you — public fees, filtered by instrument and distance.', land_d_post: 'Need a dep or jam partners? Post in two minutes — matching musicians nearby get alerted.', land_d_mine: 'Track your posts and applications, book musicians, leave reviews after the gig.', land_d_bands: 'Start a band with open seats, or join one — with members\u2019 real track records.', land_d_profile: 'Your instruments, demos, and reviews — plus a public page you can share anywhere.',
    how_it_works: 'How it works', tagline: 'gigs · jams · bands', feedback: 'Feedback', fb_label: 'What should we improve?', fb_email_label: 'Your email (optional, if you want a reply)', fb_send: 'Send', fb_sent_t: 'Message sent', fb_thanks: 'Thanks — your feedback reached us.', missing_q: 'Missing an instrument, a genre or an option?', missing_inst_q: 'Your instrument isn\u2019t listed?', tell_us: 'Tell us \u2192', fb_prefill_post: 'Posting a gig — missing: ', fb_prefill_profile: 'My profile — missing instrument: ', fb_fail: 'Could not send feedback', welcome_profile: 'Welcome aboard! We sent you a confirmation email — if it is not in your inbox, check the spam folder. Then set up your musician profile — it is what lets you apply to gigs and jams.',
    land_head: 'Find a dep. Join a jam. Start a band.', land_sub: 'JamWerk connects local musicians: paid gigs with public fees, free jam partners, and open band seats — matched to your instrument and your area.', land_s1: 'Create your free musician profile: instruments, city, travel radius.', land_s2: 'Browse or post: paid gigs, jam sessions, band seats. Turn on alerts and matches reach your phone.', land_s3: 'Book or connect. Completed gigs earn reviews that build your public track record.', aud_jam_t: 'Just here to jam?', aud_jam_p: 'Practice listings are free and casual — no fees, no ratings, no pressure. Find people at your level, from beginners to weekend bands.', aud_pro_t: 'Working musician?', aud_pro_p: 'Paid dep gigs with the fee stated up front, in CHF or EUR. Reviews from real completed gigs build a track record you can share.', land_alerts: 'Tap the bell after signing up — gigs for your instrument near you reach your phone the moment they are posted.', cta_join: 'Create your free profile', cta_browse: 'Browse the board', lvl_label: 'Experience level', whos_welcome: 'Who\u2019s welcome', lvl_any: 'anyone welcome', lvl_hobby: 'hobby', lvl_semi: 'semi-pro', lvl_pro: 'pro',
    nav_bands: 'Bands', start_band: 'Start a band', band_name: 'Band name', band_created: 'Band created.', seats_l: 'Open seats (choose instruments)', members_n2: '{0} members', add_seat: 'Add seat', seat_added: 'Seat added.', close_seat: 'Close seat', seat_closed: 'Seat closed.', joined_ok: '{0} joined the band — contact shared.', applied_seat_ok: 'Applied for the seat.', no_bands: 'No bands yet. Start one!', lineup_full: 'Lineup complete', applications_gigs: '{0} gigs', st_filled: 'filled', nav_post: 'Post a gig', nav_mine: 'My gigs', nav_profile: 'Musician profile',
    seg_musicians: 'Musicians', musicians_near: 'Musicians near you', see_all_musicians: 'See all {0} musicians', musicians_n: '{0} musicians', no_musicians: 'No musicians match yet \u2014 be the first.', cta_people: 'See who\u2019s here', looking_l: 'I\u2019m looking for', lf_dep: 'paid dep gigs', lf_jam: 'jam partners', lf_join_band: 'to join a band', lf_start_band: 'to start a band', seg_gigs: 'Paid gigs', seg_practice: 'Jams', all_instruments: 'All instruments', ph_city: 'City', ph_city_ex: 'Geneva', ph_desc: 'Two 45-min sets, charts provided, backline on site…', btn_filter: 'Filter',
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
    applied_ok: 'Applied. The bandleader will see your profile.', could_not_apply: 'Could not apply',
    gig_posted: 'Gig posted.', practice_posted: 'Practice listing posted.', profile_saved: 'Profile saved.', failed: 'Failed',
    review_saved: 'Review saved.', booked_ok: 'Booked {0}. Others were declined.', connected_ok: 'Connected with {0} — they got your contact.',
    gig_cancelled: 'Gig cancelled.', listing_closed: 'Listing closed.', gig_completed_ok: 'Gig completed — you can now leave a review.',
    confirm_needed: 'Confirm your email address to post paid gigs — check your inbox (and spam folder).', resend_confirm: 'Resend the email', resend_done: 'Confirmation email sent — check your inbox and spam folder.', reset_sent: 'If that account exists, a reset link is on its way — check your spam folder if it does not show up.', email_confirmed: 'Email confirmed — welcome aboard.',
    confirm_invalid: 'That confirmation link is invalid or already used.', pw_updated: 'Password updated — you are logged in.', reset_failed: 'Reset failed',
    alerts_off: 'Alerts off.', alerts_on_msg: 'Alerts on — gigs near you will reach this device.',
    install_link: 'Install the app', install_t: 'Install JamWerk', install_sub: 'Free, no App Store needed \u2014 and gig alerts arrive on your phone from the installed app.', install_now: 'Install now', install_ios_1: 'In Safari, tap the Share button (square with an arrow).', install_ios_2: 'Choose \u201cAdd to Home Screen\u201d, then open JamWerk from your Home Screen.', install_android_1: 'In Chrome, open the \u22ee menu.', install_android_2: 'Tap \u201cInstall app\u201d (or \u201cAdd to Home screen\u201d).', install_desktop_1: 'Click the install icon at the right end of the address bar.', alerts_ios: 'On iPhone: tap Share, then \u201cAdd to Home Screen\u201d \u2014 alerts work from the installed app.', alerts_unsupported: 'This browser does not support push alerts \u2014 you will still get emails.', notif_blocked: 'Notifications are blocked in your browser settings.', alerts_error: 'Could not change alert settings.', alerts_enable_fail: 'Could not enable alerts',
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
    cta_jam: 'Trouver des partenaires de jam', cta_gigs: 'Voir les concerts pay\u00e9s', land_d_board: 'Tous les concerts et jams ouverts pr\u00e8s de chez vous — cachets publics, filtr\u00e9s par instrument et distance.', land_d_post: 'Besoin d\u2019un rempla\u00e7ant ou de partenaires de jam ? Publiez en deux minutes — les musiciens correspondants sont alert\u00e9s.', land_d_mine: 'Suivez vos annonces et candidatures, engagez des musiciens, laissez des avis apr\u00e8s le concert.', land_d_bands: 'Montez un groupe avec des places ouvertes, ou rejoignez-en un — avec le vrai parcours des membres.', land_d_profile: 'Vos instruments, d\u00e9mos et avis — plus une page publique \u00e0 partager partout.',
    how_it_works: 'Comment \u00e7a marche', tagline: 'concerts \u00b7 jams \u00b7 groupes', feedback: 'Vos retours', fb_label: 'Que pouvons-nous améliorer ?', fb_email_label: 'Votre e-mail (facultatif, pour une réponse)', fb_send: 'Envoyer', fb_sent_t: 'Message envoyé', fb_thanks: 'Merci — votre retour nous est bien parvenu.', missing_q: 'Il manque un instrument, un genre ou une option ?', missing_inst_q: 'Votre instrument n\u2019est pas dans la liste ?', tell_us: 'Dites-le-nous \u2192', fb_prefill_post: 'Publication d\u2019une annonce — il manque : ', fb_prefill_profile: 'Mon profil — instrument manquant : ', fb_fail: 'Impossible d’envoyer le retour', welcome_profile: 'Bienvenue ! Un e-mail de confirmation vous a \u00e9t\u00e9 envoy\u00e9 — s\u2019il n\u2019est pas dans votre bo\u00eete de r\u00e9ception, v\u00e9rifiez le dossier spam. Cr\u00e9ez ensuite votre profil musicien — c\u2019est lui qui vous permet de postuler aux concerts et aux jams.',
    land_head: 'Trouvez un rempla\u00e7ant. Rejoignez un jam. Montez un groupe.', land_sub: 'JamWerk connecte les musiciens locaux : concerts pay\u00e9s aux cachets publics, partenaires de jam gratuits et places de groupe ouvertes — selon votre instrument et votre r\u00e9gion.', land_s1: 'Cr\u00e9ez votre profil musicien gratuit : instruments, ville, rayon de d\u00e9placement.', land_s2: 'Parcourez ou publiez : concerts pay\u00e9s, jams, places de groupe. Activez les alertes et les annonces arrivent sur votre t\u00e9l\u00e9phone.', land_s3: 'R\u00e9servez ou connectez-vous. Les concerts effectu\u00e9s g\u00e9n\u00e8rent des avis qui construisent votre r\u00e9putation publique.', aud_jam_t: 'Envie de jammer ?', aud_jam_p: 'Les annonces de jam sont gratuites et d\u00e9contract\u00e9es — pas de cachet, pas de notes, pas de pression. Trouvez des gens de votre niveau, du d\u00e9butant au groupe du week-end.', aud_pro_t: 'Musicien professionnel ?', aud_pro_p: 'Concerts pay\u00e9s avec le cachet annonc\u00e9 d\u2019avance, en CHF ou EUR. Les avis de vrais concerts construisent une r\u00e9putation partageable.', land_alerts: 'Touchez la cloche apr\u00e8s l\u2019inscription — les concerts pour votre instrument pr\u00e8s de chez vous arrivent sur votre t\u00e9l\u00e9phone d\u00e8s leur publication.', cta_join: 'Cr\u00e9er un profil gratuit', cta_browse: 'Voir les annonces', lvl_label: 'Niveau', whos_welcome: 'Qui est bienvenu', lvl_any: 'ouvert \u00e0 tous', lvl_hobby: 'amateur', lvl_semi: 'semi-pro', lvl_pro: 'pro',
    nav_bands: 'Groupes', start_band: 'Créer un groupe', band_name: 'Nom du groupe', band_created: 'Groupe créé.', seats_l: 'Places ouvertes (choisissez les instruments)', members_n2: '{0} membres', add_seat: 'Ajouter une place', seat_added: 'Place ajoutée.', close_seat: 'Fermer la place', seat_closed: 'Place fermée.', joined_ok: '{0} a rejoint le groupe — contact partagé.', applied_seat_ok: 'Candidature envoyée pour la place.', no_bands: 'Pas encore de groupes. Créez-en un !', lineup_full: 'Formation au complet', applications_gigs: '{0} concerts', st_filled: 'pourvue', nav_post: 'Publier une annonce', nav_mine: 'Mes concerts', nav_profile: 'Profil musicien',
    seg_musicians: 'Musiciens', musicians_near: 'Musiciens pr\u00e8s de vous', see_all_musicians: 'Voir les {0} musiciens', musicians_n: '{0} musiciens', no_musicians: 'Aucun musicien ne correspond pour le moment \u2014 soyez le premier.', cta_people: 'Voir qui est l\u00e0', looking_l: 'Je cherche', lf_dep: 'des remplacements pay\u00e9s', lf_jam: 'des partenaires de jam', lf_join_band: '\u00e0 rejoindre un groupe', lf_start_band: '\u00e0 monter un groupe', seg_gigs: 'Concerts payés', seg_practice: 'Jams', all_instruments: 'Tous les instruments', ph_city: 'Ville', ph_city_ex: 'Genève', ph_desc: 'Deux sets de 45 min, grilles fournies, backline sur place…', btn_filter: 'Filtrer',
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
    applied_ok: 'Candidature envoyée. Le chef de groupe verra votre profil.', could_not_apply: 'Candidature impossible',
    gig_posted: 'Concert publié.', practice_posted: 'Annonce de répétition publiée.', profile_saved: 'Profil enregistré.', failed: 'Échec',
    review_saved: 'Avis enregistré.', booked_ok: '{0} engagé·e. Les autres ont été déclinés.', connected_ok: 'Mis en contact avec {0} — il/elle a reçu vos coordonnées.',
    gig_cancelled: 'Concert annulé.', listing_closed: 'Annonce fermée.', gig_completed_ok: 'Concert terminé — vous pouvez laisser un avis.',
    confirm_needed: 'Confirmez votre adresse e-mail pour publier des concerts payés — vérifiez votre boîte de réception (et le dossier spam).', resend_confirm: 'Renvoyer l\u2019e-mail', resend_done: 'E-mail de confirmation envoyé — vérifiez votre boîte de réception et le dossier spam.', reset_sent: 'Si ce compte existe, un lien de réinitialisation arrive — vérifiez le dossier spam s\u2019il n\u2019apparaît pas.', email_confirmed: 'E-mail confirmé — bienvenue !',
    confirm_invalid: 'Ce lien de confirmation est invalide ou déjà utilisé.', pw_updated: 'Mot de passe mis à jour — vous êtes connecté.', reset_failed: 'Échec de la réinitialisation',
    alerts_off: 'Alertes désactivées.', alerts_on_msg: 'Alertes activées — les concerts près de chez vous arriveront sur cet appareil.',
    install_link: 'Installer l\u2019app', install_t: 'Installer JamWerk', install_sub: 'Gratuit, sans App Store \u2014 et les alertes de concerts arrivent sur votre t\u00e9l\u00e9phone depuis l\u2019app install\u00e9e.', install_now: 'Installer maintenant', install_ios_1: 'Dans Safari, touchez le bouton Partager (carr\u00e9 avec une fl\u00e8che).', install_ios_2: 'Choisissez \u00ab\u202fSur l\u2019\u00e9cran d\u2019accueil\u202f\u00bb, puis ouvrez JamWerk depuis l\u2019\u00e9cran d\u2019accueil.', install_android_1: 'Dans Chrome, ouvrez le menu \u22ee.', install_android_2: 'Touchez \u00ab\u202fInstaller l\u2019application\u202f\u00bb (ou \u00ab\u202fAjouter \u00e0 l\u2019\u00e9cran d\u2019accueil\u202f\u00bb).', install_desktop_1: 'Cliquez sur l\u2019ic\u00f4ne d\u2019installation \u00e0 droite de la barre d\u2019adresse.', alerts_ios: 'Sur iPhone : touchez Partager puis \u00ab\u202fSur l\u2019\u00e9cran d\u2019accueil\u202f\u00bb \u2014 les alertes fonctionnent depuis l\u2019app install\u00e9e.', alerts_unsupported: 'Ce navigateur ne prend pas en charge les alertes push \u2014 vous recevrez quand m\u00eame les e-mails.', notif_blocked: 'Les notifications sont bloquées dans votre navigateur.', alerts_error: 'Impossible de modifier les alertes.', alerts_enable_fail: 'Impossible d\u2019activer les alertes',
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
    cta_jam: 'Jam-Partner finden', cta_gigs: 'Bezahlte Gigs ansehen', land_d_board: 'Alle offenen Gigs und Jams in deiner N\u00e4he — \u00f6ffentliche Gagen, gefiltert nach Instrument und Distanz.', land_d_post: 'Ersatz oder Jam-Partner gesucht? In zwei Minuten inseriert — passende Musiker:innen in der N\u00e4he werden benachrichtigt.', land_d_mine: 'Behalte Anzeigen und Bewerbungen im Blick, buche Musiker:innen, bewerte nach dem Gig.', land_d_bands: 'Gr\u00fcnde eine Band mit offenen Pl\u00e4tzen oder tritt einer bei — mit echtem Leistungsausweis der Mitglieder.', land_d_profile: 'Deine Instrumente, Demos und Bewertungen — plus eine \u00f6ffentliche Seite zum Teilen.',
    how_it_works: 'So funktioniert\u2019s', tagline: 'Gigs \u00b7 Jams \u00b7 Bands', feedback: 'Feedback', fb_label: 'Was sollen wir verbessern?', fb_email_label: 'Deine E-Mail (optional, f\u00fcr eine Antwort)', fb_send: 'Senden', fb_sent_t: 'Nachricht gesendet', fb_thanks: 'Danke \u2014 dein Feedback ist bei uns angekommen.', missing_q: 'Fehlt ein Instrument, ein Genre oder eine Option?', missing_inst_q: 'Dein Instrument fehlt in der Liste?', tell_us: 'Sag es uns \u2192', fb_prefill_post: 'Gig einstellen \u2014 es fehlt: ', fb_prefill_profile: 'Mein Profil \u2014 fehlendes Instrument: ', fb_fail: 'Feedback konnte nicht gesendet werden', welcome_profile: 'Willkommen! Wir haben dir eine Best\u00e4tigungs-E-Mail geschickt — falls sie nicht im Posteingang ist, schau im Spam-Ordner nach. Richte dann dein Musikerprofil ein — damit kannst du dich auf Gigs und Jams bewerben.',
    land_head: 'Finde einen Ersatz. Finde Jam-Partner. Gr\u00fcnde eine Band.', land_sub: 'JamWerk verbindet lokale Musiker:innen: bezahlte Gigs mit \u00f6ffentlichen Gagen, kostenlose Jam-Partner und offene Bandpl\u00e4tze — passend zu Instrument und Region.', land_s1: 'Erstelle dein gratis Musikerprofil: Instrumente, Stadt, Reiseradius.', land_s2: 'St\u00f6bern oder inserieren: bezahlte Gigs, Jams, Bandpl\u00e4tze. Alerts an, und Treffer erreichen dein Handy.', land_s3: 'Buchen oder verbinden. Abgeschlossene Gigs bringen Bewertungen f\u00fcr deinen \u00f6ffentlichen Leistungsausweis.', aud_jam_t: 'Einfach nur jammen?', aud_jam_p: 'Jam-Anzeigen sind gratis und locker — keine Gagen, keine Bewertungen, kein Druck. Finde Leute auf deinem Niveau, vom Anf\u00e4nger bis zur Wochenendband.', aud_pro_t: 'Berufsmusiker:in?', aud_pro_p: 'Bezahlte Ersatz-Gigs mit vorab genannter Gage in CHF oder EUR. Bewertungen aus echten Gigs bauen einen teilbaren Leistungsausweis auf.', land_alerts: 'Tippe nach der Anmeldung auf die Glocke — Gigs f\u00fcr dein Instrument in deiner N\u00e4he erreichen dein Handy, sobald sie erscheinen.', cta_join: 'Gratis Profil erstellen', cta_browse: 'Anzeigen ansehen', lvl_label: 'Erfahrungsstufe', whos_welcome: 'Wer ist willkommen', lvl_any: 'alle willkommen', lvl_hobby: 'Hobby', lvl_semi: 'semiprofessionell', lvl_pro: 'Profi',
    nav_bands: 'Bands', start_band: 'Band gründen', band_name: 'Bandname', band_created: 'Band erstellt.', seats_l: 'Offene Plätze (Instrumente wählen)', members_n2: '{0} Mitglieder', add_seat: 'Platz hinzufügen', seat_added: 'Platz hinzugefügt.', close_seat: 'Platz schliessen', seat_closed: 'Platz geschlossen.', joined_ok: '{0} ist der Band beigetreten — Kontakt geteilt.', applied_seat_ok: 'Für den Platz beworben.', no_bands: 'Noch keine Bands. Gründe eine!', lineup_full: 'Besetzung komplett', applications_gigs: '{0} Gigs', st_filled: 'besetzt', nav_post: 'Gig einstellen', nav_mine: 'Meine Gigs', nav_profile: 'Musikerprofil',
    seg_musicians: 'Musiker:innen', musicians_near: 'Musiker:innen in deiner N\u00e4he', see_all_musicians: 'Alle {0} Musiker:innen', musicians_n: '{0} Musiker:innen', no_musicians: 'Noch niemand passt \u2014 sei die erste Person.', cta_people: 'Wer ist da?', looking_l: 'Ich suche', lf_dep: 'bezahlte Ersatz-Gigs', lf_jam: 'Jam-Partner', lf_join_band: 'eine Band zum Einsteigen', lf_start_band: 'Leute f\u00fcr eine neue Band', seg_gigs: 'Bezahlte Gigs', seg_practice: 'Jams', all_instruments: 'Alle Instrumente', ph_city: 'Stadt', ph_city_ex: 'Genf', ph_desc: 'Zwei 45-Minuten-Sets, Charts vorhanden, Backline vor Ort…', btn_filter: 'Filtern',
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
    applied_ok: 'Beworben. Der Bandleader sieht dein Profil.', could_not_apply: 'Bewerbung nicht möglich',
    gig_posted: 'Gig veröffentlicht.', practice_posted: 'Übungs-Anzeige veröffentlicht.', profile_saved: 'Profil gespeichert.', failed: 'Fehlgeschlagen',
    review_saved: 'Bewertung gespeichert.', booked_ok: '{0} gebucht. Die anderen wurden abgesagt.', connected_ok: 'Mit {0} verbunden — deine Kontaktdaten wurden geteilt.',
    gig_cancelled: 'Gig abgesagt.', listing_closed: 'Anzeige geschlossen.', gig_completed_ok: 'Gig abgeschlossen — du kannst jetzt bewerten.',
    confirm_needed: 'Bestätige deine E-Mail-Adresse, um bezahlte Gigs einzustellen — schau in den Posteingang (und Spam-Ordner).', resend_confirm: 'E-Mail erneut senden', resend_done: 'Bestätigungs-E-Mail gesendet — schau in Posteingang und Spam-Ordner.', reset_sent: 'Falls das Konto existiert, ist ein Reset-Link unterwegs — schau auch im Spam-Ordner nach.', email_confirmed: 'E-Mail bestätigt — willkommen an Bord.',
    confirm_invalid: 'Dieser Bestätigungslink ist ungültig oder schon benutzt.', pw_updated: 'Passwort aktualisiert — du bist angemeldet.', reset_failed: 'Zurücksetzen fehlgeschlagen',
    alerts_off: 'Alerts aus.', alerts_on_msg: 'Alerts an — Gigs in deiner Nähe erreichen dieses Gerät.',
    install_link: 'App installieren', install_t: 'JamWerk installieren', install_sub: 'Gratis, ohne App Store \u2014 Gig-Alerts kommen aus der installierten App aufs Handy.', install_now: 'Jetzt installieren', install_ios_1: 'In Safari auf Teilen tippen (Quadrat mit Pfeil).', install_ios_2: '\u201eZum Home-Bildschirm\u201c w\u00e4hlen und JamWerk vom Home-Bildschirm \u00f6ffnen.', install_android_1: 'In Chrome das \u22ee-Men\u00fc \u00f6ffnen.', install_android_2: '\u201eApp installieren\u201c antippen (oder \u201eZum Startbildschirm hinzuf\u00fcgen\u201c).', install_desktop_1: 'Auf das Installations-Symbol rechts in der Adressleiste klicken.', alerts_ios: 'Auf dem iPhone: Teilen antippen, dann \u201eZum Home-Bildschirm\u201c \u2014 Alerts funktionieren aus der installierten App.', alerts_unsupported: 'Dieser Browser unterst\u00fctzt keine Push-Alerts \u2014 E-Mails kommen trotzdem an.', notif_blocked: 'Benachrichtigungen sind im Browser blockiert.', alerts_error: 'Alert-Einstellungen konnten nicht geändert werden.', alerts_enable_fail: 'Alerts konnten nicht aktiviert werden',
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
    cta_jam: 'Trova partner per jam', cta_gigs: 'Vedi i concerti pagati', land_d_board: 'Tutti i concerti e le jam aperti vicino a te — cachet pubblici, filtrati per strumento e distanza.', land_d_post: 'Cerchi un sostituto o partner per una jam? Pubblica in due minuti — i musicisti compatibili nelle vicinanze ricevono un avviso.', land_d_mine: 'Segui annunci e candidature, ingaggia musicisti, lascia recensioni dopo il concerto.', land_d_bands: 'Crea un gruppo con posti aperti o unisciti a uno — con il vero percorso dei membri.', land_d_profile: 'I tuoi strumenti, demo e recensioni — pi\u00f9 una pagina pubblica da condividere ovunque.',
    how_it_works: 'Come funziona', tagline: 'concerti · jam · band', feedback: 'Feedback', fb_label: 'Cosa possiamo migliorare?', fb_email_label: 'La tua e-mail (facoltativa, per una risposta)', fb_send: 'Invia', fb_sent_t: 'Messaggio inviato', fb_thanks: 'Grazie — il tuo feedback ci è arrivato.', missing_q: 'Manca uno strumento, un genere o un\u2019opzione?', missing_inst_q: 'Il tuo strumento non è in lista?', tell_us: 'Diccelo \u2192', fb_prefill_post: 'Pubblicazione annuncio — manca: ', fb_prefill_profile: 'Il mio profilo — strumento mancante: ', fb_fail: 'Impossibile inviare il feedback', welcome_profile: 'Benvenuto/a! Ti abbiamo inviato un\u2019e-mail di conferma — se non \u00e8 nella posta in arrivo, controlla la cartella spam. Poi crea il tuo profilo musicista — \u00e8 ci\u00f2 che ti permette di candidarti a concerti e jam.',
    land_head: 'Trova un sostituto. Trova una jam. Crea un gruppo.', land_sub: 'JamWerk collega i musicisti locali: concerti pagati con cachet pubblici, partner di jam gratuiti e posti nei gruppi — in base al tuo strumento e alla tua zona.', land_s1: 'Crea il tuo profilo musicista gratuito: strumenti, citt\u00e0, raggio di spostamento.', land_s2: 'Sfoglia o pubblica: concerti pagati, jam, posti nei gruppi. Attiva gli avvisi e le corrispondenze arrivano sul telefono.', land_s3: 'Prenota o connettiti. I concerti completati generano recensioni che costruiscono la tua reputazione pubblica.', aud_jam_t: 'Vuoi solo suonare?', aud_jam_p: 'Gli annunci di prova sono gratuiti e informali — niente cachet, niente voti, niente pressione. Trova persone del tuo livello, dai principianti alle band del weekend.', aud_pro_t: 'Musicista professionista?', aud_pro_p: 'Concerti pagati con il cachet dichiarato in anticipo, in CHF o EUR. Le recensioni di concerti reali costruiscono una reputazione condivisibile.', land_alerts: 'Tocca la campanella dopo la registrazione — i concerti per il tuo strumento vicino a te arrivano sul telefono appena pubblicati.', cta_join: 'Crea il tuo profilo gratuito', cta_browse: 'Guarda gli annunci', lvl_label: 'Livello', whos_welcome: 'Chi \u00e8 benvenuto', lvl_any: 'aperto a tutti', lvl_hobby: 'amatoriale', lvl_semi: 'semi-pro', lvl_pro: 'pro',
    nav_bands: 'Gruppi', start_band: 'Crea un gruppo', band_name: 'Nome del gruppo', band_created: 'Gruppo creato.', seats_l: 'Posti aperti (scegli gli strumenti)', members_n2: '{0} membri', add_seat: 'Aggiungi posto', seat_added: 'Posto aggiunto.', close_seat: 'Chiudi il posto', seat_closed: 'Posto chiuso.', joined_ok: '{0} è entrato/a nel gruppo — contatto condiviso.', applied_seat_ok: 'Candidatura inviata per il posto.', no_bands: 'Ancora nessun gruppo. Creane uno!', lineup_full: 'Formazione al completo', applications_gigs: '{0} concerti', st_filled: 'assegnato', nav_post: 'Pubblica annuncio', nav_mine: 'I miei concerti', nav_profile: 'Profilo musicista',
    seg_musicians: 'Musicisti', musicians_near: 'Musicisti vicino a te', see_all_musicians: 'Vedi tutti i {0} musicisti', musicians_n: '{0} musicisti', no_musicians: 'Nessun musicista corrisponde ancora \u2014 sii il primo.', cta_people: 'Guarda chi c\u2019\u00e8', looking_l: 'Cerco', lf_dep: 'sostituzioni pagate', lf_jam: 'partner per jam', lf_join_band: 'di entrare in un gruppo', lf_start_band: 'di fondare un gruppo', seg_gigs: 'Concerti pagati', seg_practice: 'Jam', all_instruments: 'Tutti gli strumenti', ph_city: 'Città', ph_city_ex: 'Ginevra', ph_desc: 'Due set da 45 min, spartiti forniti, backline sul posto…', btn_filter: 'Filtra',
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
    applied_ok: 'Candidatura inviata. Il bandleader vedrà il tuo profilo.', could_not_apply: 'Candidatura non possibile',
    gig_posted: 'Concerto pubblicato.', practice_posted: 'Annuncio di prova pubblicato.', profile_saved: 'Profilo salvato.', failed: 'Errore',
    review_saved: 'Recensione salvata.', booked_ok: '{0} ingaggiato/a. Gli altri sono stati declinati.', connected_ok: 'In contatto con {0} — ha ricevuto i tuoi recapiti.',
    gig_cancelled: 'Concerto annullato.', listing_closed: 'Annuncio chiuso.', gig_completed_ok: 'Concerto completato — ora puoi lasciare una recensione.',
    confirm_needed: 'Conferma il tuo indirizzo e-mail per pubblicare concerti pagati — controlla la posta in arrivo (e la cartella spam).', resend_confirm: 'Reinvia l\u2019e-mail', resend_done: 'E-mail di conferma inviata — controlla posta in arrivo e cartella spam.', reset_sent: 'Se l\u2019account esiste, un link di reimpostazione è in arrivo — controlla anche la cartella spam.', email_confirmed: 'E-mail confermata — benvenuto/a!',
    confirm_invalid: 'Questo link di conferma non è valido o è già stato usato.', pw_updated: 'Password aggiornata — sei connesso.', reset_failed: 'Reimpostazione non riuscita',
    alerts_off: 'Avvisi disattivati.', alerts_on_msg: 'Avvisi attivi — i concerti vicino a te arriveranno su questo dispositivo.',
    install_link: 'Installa l\u2019app', install_t: 'Installa JamWerk', install_sub: 'Gratis, senza App Store \u2014 e gli avvisi arrivano sul telefono dall\u2019app installata.', install_now: 'Installa ora', install_ios_1: 'In Safari, tocca Condividi (quadrato con freccia).', install_ios_2: 'Scegli \u201cAggiungi a Home\u201d, poi apri JamWerk dalla schermata Home.', install_android_1: 'In Chrome, apri il menu \u22ee.', install_android_2: 'Tocca \u201cInstalla app\u201d (o \u201cAggiungi a schermata Home\u201d).', install_desktop_1: 'Clicca l\u2019icona di installazione a destra nella barra degli indirizzi.', alerts_ios: 'Su iPhone: tocca Condividi, poi \u201cAggiungi a Home\u201d \u2014 gli avvisi funzionano dall\u2019app installata.', alerts_unsupported: 'Questo browser non supporta gli avvisi push \u2014 riceverai comunque le e-mail.', notif_blocked: 'Le notifiche sono bloccate nel browser.', alerts_error: 'Impossibile modificare gli avvisi.', alerts_enable_fail: 'Impossibile attivare gli avvisi',
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
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = T(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = T(n.dataset.i18nPh); });
  document.documentElement.lang = lang;
  if (typeof renderAuthMode === 'function') renderAuthMode();
}
let me = null;
let boardKind = 'gig';
let landingDismissed = false;
$('ctaBrowse').onclick = () => { landingDismissed = true; $('landing').hidden = true; };
$('ctaJam').onclick = () => { landingDismissed = true; $('landing').hidden = true; switchKind('practice'); };
$('ctaGigs').onclick = () => { landingDismissed = true; $('landing').hidden = true; switchKind('gig'); };
$('ctaPeople').onclick = () => { landingDismissed = true; $('landing').hidden = true; switchKind('musicians'); };
document.querySelectorAll('#landTiles [data-goto]').forEach((tile) => {
  tile.onclick = () => {
    landingDismissed = true;
    $('landing').hidden = true;
    document.querySelector('[data-tab=' + tile.dataset.goto + ']').click();
  };
});
$('howBtn').onclick = () => {
  landingDismissed = false;
  document.querySelector('[data-tab=board]').click();
  $('landing').hidden = false;
  window.scrollTo({ top: 0 });
};
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
  f.append(el('span', 'fi', kind === 'ok' ? '\u2713' : '!'), el('span', '', text), el('span', 'fbar'));
  f.onclick = () => { f.classList.remove('show'); clearTimeout(flashTimer); };
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => f.classList.remove('show'), 5000);
};
const label = (i) => (I18N[lang].inst && I18N[lang].inst[i]) || i.replace(/_/g, ' ');
const parseCsv = (s) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

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
  $('howBtn').hidden = !!me;
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
function renderAuthMode() {
  $('authTitle').textContent = registering ? T('register') : T('login');
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
  const body = { email: $('aEmail').value, password: $('aPassword').value };
  if (registering) { body.display_name = $('aName').value; body.lang = lang; body.turnstile_token = tsToken(tsAuth); }
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
document.querySelectorAll('#tabs button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    ['board','post','mine','bands','msgs','profile'].forEach((t) => { $('tab-' + t).hidden = t !== b.dataset.tab; });
    if (b.dataset.tab === 'mine') loadMine();
    if (b.dataset.tab === 'bands') loadBands();
    if (b.dataset.tab === 'msgs') loadThreads();
    if (b.dataset.tab === 'board') loadBoard();
  };
});

// ── Board ────────────────────────────────────────────
function gigCard(g, actions) {
  const c = el('div', 'card');
  const head = el('div', 'gig-head');
  head.append(el('strong', '', label(g.instrument)));
  head.append(el('span', 'tag status-' + g.status, TS(g.status)));
  head.append(el('span', 'muted', (g.gig_date || T('flexible')) + ' · ' + g.venue_city + (g.distance_km != null ? ' · ' + g.distance_km + ' km' : '')));
  head.append(el('span', 'fee', g.kind === 'practice' ? T('jam') : (g.currency || 'CHF') + ' ' + g.fee_chf));
  c.append(head);
  const tags = el('div');
  (g.genres || []).forEach((x) => tags.append(el('span', 'tag', x), document.createTextNode(' ')));
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
  const meta = el('div', 'applicant-meta');
  if ((m.instruments || []).length) meta.append(el('span', '', m.instruments.map(label).join(', ')));
  if (m.level) meta.append(el('span', '', T({ hobby: 'lvl_hobby', semi_pro: 'lvl_semi', pro: 'lvl_pro' }[m.level] || 'lvl_hobby')));
  if (m.home_city) meta.append(el('span', '', m.home_city + (m.distance_km != null ? ' \u00b7 ' + m.distance_km + ' km' : '')));
  if (m.review_count > 0) meta.append(el('span', 'rating', '\u2605 ' + m.avg_rating + ' (' + m.review_count + ')'));
  if (m.gigs_played) meta.append(el('span', '', T('gigs_through', m.gigs_played).trim()));
  who.append(meta);
  head.append(who);
  card.append(head);
  const chips = el('div', 'chips');
  (m.looking_for || []).forEach((k) => chips.append(el('span', 'tag hot', T(LF_KEYS[k] || k))));
  (m.genres || []).slice(0, 4).forEach((g) => chips.append(el('span', 'tag', g)));
  if (chips.childElementCount) card.append(chips);
  card.onclick = (e) => { if (e.target.tagName !== 'A') location.href = '/m/' + m.handle; };
  return card;
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
}
async function loadBoard() {
  const params = new URLSearchParams();
  params.set('kind', boardKind);
  if ($('fInstrument').value) params.set('instrument', $('fInstrument').value);
  if ($('fCity').value.trim()) {
    params.set('city', $('fCity').value.trim());
    params.set('radius_km', $('fRadius').value);
  }
  if (boardKind === 'musicians') { await loadMusicians(params); return; }
  const city = $('fCity').value.trim(), km = $('fRadius').value;
  const fBtn = $('fGo');
  const board = $('board');
  board.replaceChildren(el('p', 'muted', T('loading')));
  fBtn.disabled = true; fBtn.classList.add('busy');
  const r = await api('/gigs?' + params);
  fBtn.disabled = false; fBtn.classList.remove('busy');
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
    await appendMusicians(board, params, true);
    return;
  }
  r.json.gigs.forEach((g) => board.append(gigCard(g, (gig) => {
    const bar = el('div');
    if (gig.is_mine) { bar.append(el('span', 'muted', T('your_gig'))); return bar; }
    const btn = el('button', 'primary small', T('apply'));
    btn.onclick = async () => {
      if (!me) { $('authDialog').showModal(); return; }
      const note = prompt(T('note_prompt')) || '';
      const res = await api('/gigs/' + gig.id + '/apply', { method: 'POST', body: { note } });
      if (res.ok) flash(T('applied_ok'), 'ok');
      else flash(res.json.error || T('could_not_apply'), 'err');
    };
    bar.append(btn);
    return bar;
  })));
}
$('fGo').onclick = loadBoard;
$('fRadius').onchange = loadBoard;
function switchKind(k) {
  boardKind = k;
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
  $('pLevelRow').hidden = !practice;
  $('pFee').required = !practice;
  $('pDate').required = !practice;
  $('pDateRow').querySelector('label').textContent = practice ? T('date_opt') : T('date');
};

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
const taCity = attachPlaces($('pCity'), true), taHome = attachPlaces($('mCity'), true), taBand = attachPlaces($('bCity'), true), taFilter = attachPlaces($('fCity'), false);
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
    instrument: $('pInstrument').value,
    genres: parseCsv($('pGenres').value),
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
    if (a.status === 'applied' || a.status === 'shortlisted') {
      const practice = r.json.kind === 'practice';
      const acc = el('button', 'primary small', practice ? T('connect', a.display_name) : T('book', a.display_name));
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
  if (!r.ok) return;
  document.querySelectorAll('#mInstruments input').forEach((cb) => { cb.checked = r.json.instruments.includes(cb.value); });
  $('mGenres').value = r.json.genres.join(', ');
  $('mCity').value = r.json.home_city || '';
  taHome.markPicked();
  $('mRadius').value = r.json.travel_radius_km;
  $('mLevel').value = r.json.level || '';
  document.querySelectorAll('#mLooking input').forEach((x) => { x.checked = (r.json.looking_for || []).includes(x.value); });
  $('mCharts').checked = !!r.json.reads_charts;
  $('mBacking').checked = !!r.json.sings_backing;
  $('mTransport').checked = !!r.json.own_transport;
  $('mPa').checked = !!r.json.own_pa;
  $('mDemos').value = (r.json.demo_links || []).join('\\n');
  $('mStats').textContent = T('gigs_through', r.json.gigs_played);
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
    genres: parseCsv($('mGenres').value),
    home_city: $('mCity').value || undefined,
    ...(taHome.coords() ? { home_lat: taHome.coords().lat, home_lng: taHome.coords().lng } : {}),
    travel_radius_km: parseInt($('mRadius').value, 10) || 30,
    level: $('mLevel').value || undefined,
    looking_for: [...document.querySelectorAll('#mLooking input:checked')].map((x) => x.value),
    reads_charts: $('mCharts').checked,
    sings_backing: $('mBacking').checked,
    own_transport: $('mTransport').checked,
    own_pa: $('mPa').checked,
    demo_links: $('mDemos').value.split('\\n').map((x) => x.trim()).filter(Boolean),
  };
  const r = await api('/musicians/me', { method: 'POST', body });
  if (r.ok) { flash(T('profile_saved'), 'ok'); loadProfile(); }
  else if (r.json.code === 'city_unknown') { taHome.showUnknown(); flash(T('city_unknown'), 'err'); }
  else flash(r.json.error || T('failed'), 'err');
};

// ── Init ─────────────────────────────────────────────
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
    mid.append(el('div', 'muted', th.context));
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
}
async function openThread(type, id, title) {
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'msgs'));
  ['board','post','mine','bands','msgs','profile'].forEach((t) => { $('tab-' + t).hidden = t !== 'msgs'; });
  const wrap = $('msgArea');
  wrap.replaceChildren();
  const r = await api('/messages/' + type + '/' + id);
  if (!r.ok) { flash(r.json.error || T('failed'), 'err'); loadThreads(); return; }
  refreshMsgBadge();

  const head = el('div', 'card');
  const bar = el('div');
  bar.style.display = 'flex'; bar.style.alignItems = 'center'; bar.style.gap = '10px';
  const back = el('button', 'ghost small', '\u2190 ' + T('back'));
  back.onclick = loadThreads;
  bar.append(back, el('strong', '', title || ''), el('span', 'muted', r.json.context));
  head.append(bar);

  const list = el('div');
  list.style.display = 'flex'; list.style.flexDirection = 'column'; list.style.margin = '14px 0';
  if (!r.json.messages.length) list.append(el('div', 'empty', T('thread_empty')));
  for (const m of r.json.messages) {
    const b = el('div', 'bubble ' + (m.mine ? 'mine' : 'theirs'), m.body);
    const ts = el('time', '', m.created_at.slice(0, 16).replace('T', ' '));
    b.append(ts);
    list.append(b);
  }
  head.append(list);

  const composer = el('div', 'composer');
  const input = el('textarea');
  input.placeholder = T('msg_placeholder');
  const send = el('button', 'primary', T('msg_send'));
  send.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;
    send.disabled = true;
    const res = await api('/messages/' + type + '/' + id, { method: 'POST', body: { body: text } });
    send.disabled = false;
    if (res.ok) { input.value = ''; flash(T('msg_sent'), 'ok'); openThread(type, id, title); }
    else flash(res.json.error || T('failed'), 'err');
  };
  composer.append(input, send);
  head.append(composer);
  wrap.append(head);
  window.scrollTo({ top: 0 });
}

// ── Bands ────────────────────────────────────────────
$('bandForm').onsubmit = async (e) => {
  e.preventDefault();
  if (!me) { $('authDialog').showModal(); return; }
  const body = {
    name: $('bName').value,
    home_city: $('bCity').value || undefined,
    ...(taBand.coords() ? { home_lat: taBand.coords().lat, home_lng: taBand.coords().lng } : {}),
    genres: parseCsv($('bGenres').value),
    description: $('bDesc').value,
    links: $('bLinks').value.split('\\n').map((x) => x.trim()).filter(Boolean),
    seats: [...document.querySelectorAll('#bSeats input:checked')].map((x) => x.value),
  };
  const r = await api('/bands', { method: 'POST', body });
  if (r.ok) { flash(T('band_created'), 'ok'); $('bandForm').reset(); loadBands(); }
  else if (r.json.code === 'city_unknown') { taBand.showUnknown(); flash(T('city_unknown'), 'err'); }
  else flash(r.json.error || T('failed'), 'err');
};
async function loadBands() {
  const wrap = $('bandsList');
  wrap.replaceChildren();
  const r = await api('/bands');
  if (!r.json.bands || !r.json.bands.length) { wrap.append(el('div', 'empty', T('no_bands'))); return; }
  for (const b of r.json.bands) {
    const card = el('div', 'card');
    const head = el('div', 'gig-head');
    head.append(el('strong', '', b.name));
    head.append(el('span', 'muted', (b.home_city ? b.home_city + ' · ' : '') + T('members_n2', b.member_count)));
    card.append(head);
    const tags = el('div');
    (b.genres || []).forEach((x) => tags.append(el('span', 'tag', x), document.createTextNode(' ')));
    card.append(tags);
    if (b.description) card.append(el('p', '', b.description));
    (b.media || []).forEach((m) => card.append(mediaEl(m)));
    const bar = el('div');
    bar.style.display = 'flex'; bar.style.gap = '8px'; bar.style.flexWrap = 'wrap';
    if (b.is_mine) {
      const manage = el('button', 'ghost small', T('manage'));
      manage.onclick = () => showBandManage(b.id, card);
      bar.append(manage);
    } else {
      for (const seat of b.open_seats) {
        const btn = el('button', 'primary small', T('apply') + ' — ' + label(seat.instrument));
        btn.onclick = async () => {
          if (!me) { $('authDialog').showModal(); return; }
          const note = prompt(T('note_prompt')) || '';
          const res = await api('/bands/seats/' + seat.id + '/apply', { method: 'POST', body: { note } });
          if (res.ok) flash(T('applied_seat_ok'), 'ok');
          else flash(res.json.error || T('could_not_apply'), 'err');
        };
        bar.append(btn);
      }
      if (!b.open_seats.length) bar.append(el('span', 'muted', T('lineup_full')));
    }
    card.append(bar);
    wrap.append(card);
  }
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
async function refreshNotifBtn() {
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
  if (q.toString()) history.replaceState(null, '', '/');
  const r = await api('/auth/me');
  if (r.ok) me = { email: r.json.email, confirmed: !!r.json.confirmed, photo: r.json.photo || null };
  renderAuth(); loadBoard(); loadProfile();
})();
</script>
</body>
</html>`;
