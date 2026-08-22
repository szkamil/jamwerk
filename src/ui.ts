// src/ui.ts
// Single-page UI over the JSON API. Server ships static HTML + vanilla JS;
// all state lives in the API. Rendering uses DOM building (textContent),
// never innerHTML with user data.
// Ambient layers for the "backstage editorial" theme (mirrors design/):
// an audio-waveform strip along the header's bottom edge, and a faint violet
// scatter of notation behind the page. Deterministic — same field every load.
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
  body { margin: 0; font: 16px/1.5 'Instrument Sans', system-ui, sans-serif; background: var(--paper); color: #1b1a16; }
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
  footer .wave { position: absolute; left: 0; right: 0; top: -2px; width: 100%; height: 32px; z-index: -1; opacity: 0.28; transform: scaleY(-1); }
  footer .inner { max-width: 860px; margin: 0 auto; display: flex; gap: 8px 18px; align-items: center; flex-wrap: wrap; }
  footer .brand { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 18px; font-weight: 800; letter-spacing: -0.4px; color: #fff; cursor: pointer; }
  footer .brand span { color: var(--accent-light); }
  footer button { background: none; border: 0; padding: 0; font: inherit; color: rgba(255,255,255,0.75); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  header .who { font-size: 14px; opacity: .8; }
  nav { display: flex; gap: 6px; padding: 14px 20px 0; max-width: 860px; margin: 0 auto; flex-wrap: wrap; }
  nav button { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 9px 16px; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; min-height: 44px; }
  nav button.active { background: var(--ink); color: #fff; border-color: var(--ink); font-weight: 600; }
  main { max-width: 860px; margin: 0 auto; padding: 16px 20px 64px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(20,19,26,0.05); }
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
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 560px) { .grid2 { grid-template-columns: 1fr; } }
  button.primary { background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 10px; padding: 12px 20px; font: inherit; font-weight: 600; cursor: pointer; min-height: 46px; }
  button.primary:hover { background: var(--accent-deep); }
  button.ghost { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px 16px; font: inherit; cursor: pointer; }
  button.small { padding: 7px 14px; font-size: 14px; min-height: 40px; }
  .checks { display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .checks label { font-weight: 400; display: flex; align-items: center; gap: 5px; font-size: 14px; margin: 0; }
  .msg { padding: 10px 14px; border-radius: 10px; margin-bottom: 12px; font-size: 14.5px; display: none; }
  .msg.err { display: block; background: #fdecea; color: var(--warn); }
  .msg.ok { display: block; background: #e7f6ef; color: var(--ok); }
  /* The page-level toast floats above the content so confirmations are seen
     wherever the user is scrolled (e.g. the footer feedback form). */
  #flash { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 3000; margin: 0; max-width: min(92vw, 480px); box-shadow: 0 8px 28px rgba(20,19,26,0.25); }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; align-items: stretch; }
  .filters select, .filters input { width: auto; flex: 1 1 150px; border-radius: 999px; padding: 8px 16px; min-height: 46px; }
  .filters select {
    appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2314131a' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 15px center; padding-right: 38px;
  }
  .filters #fRadius { flex: 0 1 auto; min-width: 106px; }
  .filters button.ghost { min-height: 46px; border-radius: 999px; }
  .seg { display: flex; background: #232230; border-radius: 12px; padding: 4px; gap: 4px; flex: 1 1 100%; max-width: 360px; }
  .seg button { flex: 1; border: 0; background: transparent; color: #b9b6c9; border-radius: 9px; padding: 10px 0; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; min-height: 42px; }
  .seg button.active { background: var(--accent); color: #fff; font-weight: 600; }
  .empty { text-align: center; padding: 36px 10px; color: var(--muted); }
  dialog { border: 1px solid var(--line); border-radius: var(--r); padding: 20px; max-width: 420px; width: 92%; background: var(--card); }
  dialog::backdrop { background: rgba(20,19,26,.5); }
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
  <span style="color: rgba(255,255,255,0.55); font-size: 13.5px;" data-i18n="tagline">gigs · jams · bands</span>
  <span class="spacer"></span>
  <span class="who" id="who"></span>
  <button class="ghost small" id="howBtn" hidden style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.35);" data-i18n="how_it_works">How it works</button>
  <select id="langSel" style="width: auto; background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.35); border-radius: 10px; padding: 7px 8px; font-size: 14px;">
    <option value="en">EN</option>
    <option value="fr">FR</option>
    <option value="de">DE</option>
    <option value="it">IT</option>
  </select>
  <button class="ghost small" id="notifBtn" hidden style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.35); display: flex; align-items: center; gap: 6px;">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path></svg>
    <span id="notifLabel">Alerts</span>
  </button>
  <button class="ghost small" id="authBtn" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.35);">Log in</button>
</header>
<nav id="tabs">
  <button data-tab="board" class="active" data-i18n="nav_board">Gig board</button>
  <button data-tab="post" data-i18n="nav_post">Post a gig</button>
  <button data-tab="mine" data-i18n="nav_mine">My gigs</button>
  <button data-tab="bands" data-i18n="nav_bands">Bands</button>
  <button data-tab="msgs"><span data-i18n="nav_msgs">Messages</span><span id="msgBadge" hidden style="background: var(--accent); color: #fff; border-radius: 999px; padding: 1px 8px; font-size: 12px; margin-left: 6px;"></span></button>
  <button data-tab="profile" data-i18n="nav_profile">Musician profile</button>
</nav>
<main>
  <div class="msg" id="flash"></div>

  <section id="tab-board">
    <div id="landing" hidden>
      <div style="background-color: var(--ink); background-image: radial-gradient(circle at 85% -20%, rgba(100,64,251,0.45), transparent 60%); border-radius: 16px; padding: 34px 24px 40px; text-align: center; position: relative; z-index: 0; overflow: hidden; margin-bottom: 12px; color: #fff;">
        ${WAVE_SVG}
        <div class="display" style="font-size: 30px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; margin-bottom: 12px;" data-i18n="land_head">Find a dep. Fill a gig. Start a band.</div>
        <p style="max-width: 560px; margin: 0 auto 22px; color: rgba(255,255,255,0.72); font-size: 15px;" data-i18n="land_sub">JamWerk connects local musicians: paid gigs with public fees, free jam partners, and open band seats — matched to your instrument and your area.</p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button class="primary" id="ctaJoin" data-i18n="cta_join">Create your free profile</button>
          <button class="ghost" id="ctaBrowse" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.4);" data-i18n="cta_browse">Browse the board</button>
        </div>
      </div>
      <div class="grid2">
        <div class="card" style="display: flex; flex-direction: column;">
          <div class="display" style="font-size: 17px; font-weight: 700; margin-bottom: 6px;" data-i18n="aud_jam_t">Just here to jam?</div>
          <p class="muted" style="margin: 0 0 12px; flex: 1;" data-i18n="aud_jam_p">Practice listings are free and casual — no fees, no ratings, no pressure. Find people at your level, from beginners to weekend bands.</p>
          <button class="primary" id="ctaJam" style="align-self: flex-start;" data-i18n="cta_jam">Find jam partners</button>
        </div>
        <div class="card" style="display: flex; flex-direction: column;">
          <div class="display" style="font-size: 17px; font-weight: 700; margin-bottom: 6px;" data-i18n="aud_pro_t">Working musician?</div>
          <p class="muted" style="margin: 0 0 12px; flex: 1;" data-i18n="aud_pro_p">Paid dep gigs with the fee stated up front, in CHF. Reviews from real completed gigs build a track record you can share.</p>
          <button class="primary" id="ctaGigs" style="align-self: flex-start;" data-i18n="cta_gigs">See paid gigs</button>
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
        <div class="row"><label data-i18n="city">City</label><input type="text" id="pCity" required placeholder="Bern"></div>
        <div class="row" id="pFeeRow"><label data-i18n="fee">Fee (CHF, whole gig)</label><input type="number" id="pFee" min="1" required placeholder="300"></div>
        <div class="row"><label data-i18n="call_time">Call time</label><input type="time" id="pCall"></div>
        <div class="row"><label data-i18n="end_time">End time</label><input type="time" id="pEnd"></div>
      </div>
      <div class="row"><label data-i18n="genres_csv">Genres (comma-separated)</label><input type="text" id="pGenres" required placeholder="jazz, funk"></div>
      <div class="row"><label data-i18n="description">Description</label><textarea id="pDesc" required placeholder="Two 45min sets, charts provided, backline on site…"></textarea></div>
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
    </form></div>
  </section>

  <section id="tab-mine" hidden><div id="mine"></div></section>

  <section id="tab-msgs" hidden><div id="msgArea"></div></section>

  <section id="tab-bands" hidden>
    <div class="card"><form id="bandForm">
      <div class="grid2">
        <div class="row"><label data-i18n="band_name">Band name</label><input type="text" id="bName" required maxlength="80"></div>
        <div class="row"><label data-i18n="city">City</label><input type="text" id="bCity" placeholder="Bern"></div>
      </div>
      <div class="row"><label data-i18n="genres_csv">Genres (comma-separated)</label><input type="text" id="bGenres" required placeholder="indie, rock"></div>
      <div class="row"><label data-i18n="description">Description</label><textarea id="bDesc"></textarea></div>
      <div class="row"><label data-i18n="seats_l">Open seats (choose instruments)</label><div class="checks" id="bSeats"></div></div>
      <button class="primary" data-i18n="start_band">Start a band</button>
    </form></div>
    <div id="bandsList"></div>
  </section>

  <section id="tab-profile" hidden>
    <div class="card"><form id="profileForm">
      <div class="row"><label data-i18n="instruments_l">Instruments</label><div class="checks" id="mInstruments"></div></div>
      <div class="row"><label data-i18n="genres_csv">Genres (comma-separated)</label><input type="text" id="mGenres" required placeholder="jazz, funk, wedding pop"></div>
      <div class="grid2">
        <div class="row"><label data-i18n="home_city">Home city</label><input type="text" id="mCity" placeholder="Bern"></div>
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
      <div class="row checks">
        <label><input type="checkbox" id="mCharts"> <span data-i18n="reads_charts">reads charts</span></label>
        <label><input type="checkbox" id="mBacking"> <span data-i18n="backing">backing vocals</span></label>
        <label><input type="checkbox" id="mTransport"> <span data-i18n="transport">own transport</span></label>
        <label><input type="checkbox" id="mPa"> <span data-i18n="own_pa">own PA</span></label>
      </div>
      <div class="row"><label data-i18n="demo_links_l">Demo links (one per line, max 5)</label><textarea id="mDemos" placeholder="https://youtube.com/…"></textarea></div>
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
    <span>&copy; 2026 JamWerk</span>
  </div>
</footer>

<dialog id="authDialog">
  <form id="authForm">
    <h2 id="authTitle" style="margin-top:0">Log in</h2>
    <div class="msg" id="authMsg"></div>
    <div class="row"><label data-i18n="email">Email</label><input type="email" id="aEmail" required autocomplete="username"></div>
    <div class="row"><label data-i18n="password">Password</label><input type="password" id="aPassword" required minlength="8" autocomplete="current-password"></div>
    <div class="row" id="aNameRow" hidden><label data-i18n="name_label">Name (shown to bandleaders)</label><input type="text" id="aName"></div>
    <div class="row" id="tsAuthRow" hidden><div id="tsAuth"></div></div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px;">
      <button class="primary" id="authSubmit">Log in</button>
      <button type="button" class="ghost" id="authSwitch">Need an account? Register</button>
      <button type="button" class="ghost" id="authForgot" data-i18n="forgot">Forgot password?</button>
      <button type="button" class="ghost" id="authClose" data-i18n="close">Close</button>
    </div>
  </form>
</dialog>

<dialog id="fbDialog">
  <form id="fbForm">
    <h2 style="margin-top:0" data-i18n="feedback">Feedback</h2>
    <div class="msg" id="fbMsg"></div>
    <div class="row"><label data-i18n="fb_label">What should we improve?</label><textarea id="fbBody" required minlength="5" maxlength="2000" rows="5"></textarea></div>
    <div class="row" id="fbEmailRow"><label data-i18n="fb_email_label">Your email (optional, if you want a reply)</label><input type="email" id="fbEmail"></div>
    <div class="row"><div id="tsFb"></div></div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px;">
      <button class="primary" data-i18n="fb_send">Send</button>
      <button type="button" class="ghost" id="fbClose" data-i18n="close">Close</button>
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
const INSTRUMENTS = ['vocals','guitar','bass','double_bass','drums','percussion','keys','piano','accordion','violin','viola','cello','trumpet','trombone','saxophone','clarinet','flute','harmonica','dj','other'];
const I18N = {
  en: {
    nav_board: 'Gig board',
    nav_msgs: 'Messages', msg_btn: 'Message', msg_send: 'Send', msg_sent: 'Message sent.', msg_placeholder: 'Write a message\u2026', no_threads: 'No conversations yet — they start from an application.', thread_empty: 'No messages yet — say hello.', back: 'Back',
    cta_jam: 'Find jam partners', cta_gigs: 'See paid gigs', land_d_board: 'Every open gig and jam near you — public fees, filtered by instrument and distance.', land_d_post: 'Need a dep or jam partners? Post in two minutes — matching musicians nearby get alerted.', land_d_mine: 'Track your posts and applications, book musicians, leave reviews after the gig.', land_d_bands: 'Start a band with open seats, or join one — with members\u2019 real track records.', land_d_profile: 'Your instruments, demos, and reviews — plus a public page you can share anywhere.',
    how_it_works: 'How it works', tagline: 'gigs · jams · bands', feedback: 'Feedback', fb_label: 'What should we improve?', fb_email_label: 'Your email (optional, if you want a reply)', fb_send: 'Send', fb_sent_t: 'Message sent', fb_thanks: 'Thanks — your feedback reached us.', fb_fail: 'Could not send feedback', welcome_profile: 'Welcome aboard! Set up your musician profile — it is what lets you apply to gigs and jams.',
    land_head: 'Find a dep. Join a jam. Start a band.', land_sub: 'JamWerk connects local musicians: paid gigs with public fees, free jam partners, and open band seats — matched to your instrument and your area.', land_s1: 'Create your free musician profile: instruments, city, travel radius.', land_s2: 'Browse or post: paid gigs, jam sessions, band seats. Turn on alerts and matches reach your phone.', land_s3: 'Book or connect. Completed gigs earn reviews that build your public track record.', aud_jam_t: 'Just here to jam?', aud_jam_p: 'Practice listings are free and casual — no fees, no ratings, no pressure. Find people at your level, from beginners to weekend bands.', aud_pro_t: 'Working musician?', aud_pro_p: 'Paid dep gigs with the fee stated up front, in CHF. Reviews from real completed gigs build a track record you can share.', land_alerts: 'Tap the bell after signing up — gigs for your instrument near you reach your phone the moment they are posted.', cta_join: 'Create your free profile', cta_browse: 'Browse the board', lvl_label: 'Experience level', whos_welcome: 'Who\u2019s welcome', lvl_any: 'anyone welcome', lvl_hobby: 'hobby', lvl_semi: 'semi-pro', lvl_pro: 'pro',
    nav_bands: 'Bands', start_band: 'Start a band', band_name: 'Band name', band_created: 'Band created.', seats_l: 'Open seats (choose instruments)', members_n2: '{0} members', add_seat: 'Add seat', seat_added: 'Seat added.', close_seat: 'Close seat', seat_closed: 'Seat closed.', joined_ok: '{0} joined the band — contact shared.', applied_seat_ok: 'Applied for the seat.', no_bands: 'No bands yet. Start one!', lineup_full: 'Lineup complete', applications_gigs: '{0} gigs', st_filled: 'filled', nav_post: 'Post a gig', nav_mine: 'My gigs', nav_profile: 'Musician profile',
    seg_gigs: 'Paid gigs', seg_practice: 'Practice partners', all_instruments: 'All instruments', ph_city: 'City', btn_filter: 'Filter',
    login: 'Log in', logout: 'Log out', alerts: 'Alerts', alerts_on: 'Alerts on', register: 'Register',
    email: 'Email', password: 'Password', name_label: 'Name (shown to bandleaders)',
    need_account: 'Need an account? Register', have_account: 'Have an account? Log in', forgot: 'Forgot password?', close: 'Close',
    listing_type: 'Listing type', opt_gig: 'Paid gig — dated, fixed fee', opt_practice: 'Practice partner — free, open-ended',
    instrument_needed: 'Instrument needed', date: 'Date', date_opt: 'Date (optional)', city: 'City', fee: 'Fee (CHF, whole gig)',
    call_time: 'Call time', end_time: 'End time', genres_csv: 'Genres (comma-separated)', description: 'Description',
    req_charts: 'must read charts', req_rehearsal: 'one rehearsal', post_gig_btn: 'Post gig',
    instruments_l: 'Instruments', home_city: 'Home city', radius: 'Travel radius (km)',
    reads_charts: 'reads charts', backing: 'backing vocals', transport: 'own transport', own_pa: 'own PA',
    demo_links_l: 'Demo links (one per line, max 5)', save_profile: 'Save profile', public_page: 'View my public page \u2197',
    empty_gigs: 'No paid gigs found at the moment.', empty_practice: 'No jam or practice partners found at the moment.', empty_sub: 'Turn on alerts and you’ll hear the moment something is posted for your instrument near you.', empty_alerts_btn: 'Enable alerts', alerts_already: 'Alerts are already on — you’ll hear as soon as something is posted.',
    your_gig: 'Your gig — manage it under \u201cMy gigs\u201d.', apply: 'Apply', jam: 'Jam', flexible: 'flexible',
    applied_ok: 'Applied. The bandleader will see your profile.', could_not_apply: 'Could not apply',
    gig_posted: 'Gig posted.', practice_posted: 'Practice listing posted.', profile_saved: 'Profile saved.', failed: 'Failed',
    review_saved: 'Review saved.', booked_ok: 'Booked {0}. Others were declined.', connected_ok: 'Connected with {0} — they got your contact.',
    gig_cancelled: 'Gig cancelled.', listing_closed: 'Listing closed.', gig_completed_ok: 'Gig completed — you can now leave a review.',
    reset_sent: 'If that account exists, a reset link is on its way.', email_confirmed: 'Email confirmed — welcome aboard.',
    confirm_invalid: 'That confirmation link is invalid or already used.', pw_updated: 'Password updated — you are logged in.', reset_failed: 'Reset failed',
    alerts_off: 'Alerts off.', alerts_on_msg: 'Alerts on — gigs near you will reach this device.',
    notif_blocked: 'Notifications are blocked in your browser settings.', alerts_error: 'Could not change alert settings.', alerts_enable_fail: 'Could not enable alerts',
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
    inst: {},
  },
  fr: {
    nav_board: 'Tableau des concerts',
    nav_msgs: 'Messages', msg_btn: 'Message', msg_send: 'Envoyer', msg_sent: 'Message envoy\u00e9.', msg_placeholder: '\u00c9crivez un message\u2026', no_threads: 'Pas encore de conversations — elles commencent par une candidature.', thread_empty: 'Pas encore de messages — dites bonjour.', back: 'Retour',
    cta_jam: 'Trouver des partenaires de jam', cta_gigs: 'Voir les concerts pay\u00e9s', land_d_board: 'Tous les concerts et jams ouverts pr\u00e8s de chez vous — cachets publics, filtr\u00e9s par instrument et distance.', land_d_post: 'Besoin d\u2019un rempla\u00e7ant ou de partenaires de jam ? Publiez en deux minutes — les musiciens correspondants sont alert\u00e9s.', land_d_mine: 'Suivez vos annonces et candidatures, engagez des musiciens, laissez des avis apr\u00e8s le concert.', land_d_bands: 'Montez un groupe avec des places ouvertes, ou rejoignez-en un — avec le vrai parcours des membres.', land_d_profile: 'Vos instruments, d\u00e9mos et avis — plus une page publique \u00e0 partager partout.',
    how_it_works: 'Comment \u00e7a marche', tagline: 'concerts \u00b7 jams \u00b7 groupes', feedback: 'Vos retours', fb_label: 'Que pouvons-nous améliorer ?', fb_email_label: 'Votre e-mail (facultatif, pour une réponse)', fb_send: 'Envoyer', fb_sent_t: 'Message envoyé', fb_thanks: 'Merci — votre retour nous est bien parvenu.', fb_fail: 'Impossible d’envoyer le retour', welcome_profile: 'Bienvenue ! Cr\u00e9ez votre profil musicien — c\u2019est lui qui vous permet de postuler aux concerts et aux jams.',
    land_head: 'Trouvez un rempla\u00e7ant. Rejoignez un jam. Montez un groupe.', land_sub: 'JamWerk connecte les musiciens locaux : concerts pay\u00e9s aux cachets publics, partenaires de jam gratuits et places de groupe ouvertes — selon votre instrument et votre r\u00e9gion.', land_s1: 'Cr\u00e9ez votre profil musicien gratuit : instruments, ville, rayon de d\u00e9placement.', land_s2: 'Parcourez ou publiez : concerts pay\u00e9s, jams, places de groupe. Activez les alertes et les annonces arrivent sur votre t\u00e9l\u00e9phone.', land_s3: 'R\u00e9servez ou connectez-vous. Les concerts effectu\u00e9s g\u00e9n\u00e8rent des avis qui construisent votre r\u00e9putation publique.', aud_jam_t: 'Envie de jammer ?', aud_jam_p: 'Les annonces de jam sont gratuites et d\u00e9contract\u00e9es — pas de cachet, pas de notes, pas de pression. Trouvez des gens de votre niveau, du d\u00e9butant au groupe du week-end.', aud_pro_t: 'Musicien professionnel ?', aud_pro_p: 'Concerts pay\u00e9s avec le cachet annonc\u00e9 d\u2019avance, en CHF. Les avis de vrais concerts construisent une r\u00e9putation partageable.', land_alerts: 'Touchez la cloche apr\u00e8s l\u2019inscription — les concerts pour votre instrument pr\u00e8s de chez vous arrivent sur votre t\u00e9l\u00e9phone d\u00e8s leur publication.', cta_join: 'Cr\u00e9er un profil gratuit', cta_browse: 'Voir les annonces', lvl_label: 'Niveau', whos_welcome: 'Qui est bienvenu', lvl_any: 'ouvert \u00e0 tous', lvl_hobby: 'amateur', lvl_semi: 'semi-pro', lvl_pro: 'pro',
    nav_bands: 'Groupes', start_band: 'Créer un groupe', band_name: 'Nom du groupe', band_created: 'Groupe créé.', seats_l: 'Places ouvertes (choisissez les instruments)', members_n2: '{0} membres', add_seat: 'Ajouter une place', seat_added: 'Place ajoutée.', close_seat: 'Fermer la place', seat_closed: 'Place fermée.', joined_ok: '{0} a rejoint le groupe — contact partagé.', applied_seat_ok: 'Candidature envoyée pour la place.', no_bands: 'Pas encore de groupes. Créez-en un !', lineup_full: 'Formation au complet', applications_gigs: '{0} concerts', st_filled: 'pourvue', nav_post: 'Publier une annonce', nav_mine: 'Mes concerts', nav_profile: 'Profil musicien',
    seg_gigs: 'Concerts payés', seg_practice: 'Partenaires de répétition', all_instruments: 'Tous les instruments', ph_city: 'Ville', btn_filter: 'Filtrer',
    login: 'Connexion', logout: 'Déconnexion', alerts: 'Alertes', alerts_on: 'Alertes activées', register: 'Créer un compte',
    email: 'E-mail', password: 'Mot de passe', name_label: 'Nom (visible par les chefs de groupe)',
    need_account: 'Pas de compte ? Créez-en un', have_account: 'Déjà un compte ? Connexion', forgot: 'Mot de passe oublié ?', close: 'Fermer',
    listing_type: 'Type d\u2019annonce', opt_gig: 'Concert payé — daté, cachet fixe', opt_practice: 'Partenaire de répétition — gratuit, sans date',
    instrument_needed: 'Instrument recherché', date: 'Date', date_opt: 'Date (facultatif)', city: 'Ville', fee: 'Cachet (CHF, concert entier)',
    call_time: 'Heure d\u2019arrivée', end_time: 'Heure de fin', genres_csv: 'Genres (séparés par des virgules)', description: 'Description',
    req_charts: 'lecture de partitions exigée', req_rehearsal: 'une répétition', post_gig_btn: 'Publier',
    instruments_l: 'Instruments', home_city: 'Ville de résidence', radius: 'Rayon de déplacement (km)',
    reads_charts: 'lit les partitions', backing: 'ch\u0153urs', transport: 'véhicule personnel', own_pa: 'sono personnelle',
    demo_links_l: 'Liens démos (un par ligne, max 5)', save_profile: 'Enregistrer le profil', public_page: 'Voir ma page publique \u2197',
    empty_gigs: 'Aucun concert payé trouvé pour le moment.', empty_practice: 'Aucun partenaire de jam ni annonce trouvés pour le moment.', empty_sub: 'Activez les alertes et vous serez prévenu dès qu’une annonce est publiée pour votre instrument près de chez vous.', empty_alerts_btn: 'Activer les alertes', alerts_already: 'Les alertes sont déjà activées — vous serez prévenu dès la prochaine annonce.',
    your_gig: 'Votre annonce — gérez-la dans \u00ab Mes concerts \u00bb.', apply: 'Postuler', jam: 'Jam', flexible: 'flexible',
    applied_ok: 'Candidature envoyée. Le chef de groupe verra votre profil.', could_not_apply: 'Candidature impossible',
    gig_posted: 'Concert publié.', practice_posted: 'Annonce de répétition publiée.', profile_saved: 'Profil enregistré.', failed: 'Échec',
    review_saved: 'Avis enregistré.', booked_ok: '{0} engagé·e. Les autres ont été déclinés.', connected_ok: 'Mis en contact avec {0} — il/elle a reçu vos coordonnées.',
    gig_cancelled: 'Concert annulé.', listing_closed: 'Annonce fermée.', gig_completed_ok: 'Concert terminé — vous pouvez laisser un avis.',
    reset_sent: 'Si ce compte existe, un lien de réinitialisation arrive.', email_confirmed: 'E-mail confirmé — bienvenue !',
    confirm_invalid: 'Ce lien de confirmation est invalide ou déjà utilisé.', pw_updated: 'Mot de passe mis à jour — vous êtes connecté.', reset_failed: 'Échec de la réinitialisation',
    alerts_off: 'Alertes désactivées.', alerts_on_msg: 'Alertes activées — les concerts près de chez vous arriveront sur cet appareil.',
    notif_blocked: 'Les notifications sont bloquées dans votre navigateur.', alerts_error: 'Impossible de modifier les alertes.', alerts_enable_fail: 'Impossible d\u2019activer les alertes',
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
    inst: { vocals: 'chant', guitar: 'guitare', bass: 'basse', double_bass: 'contrebasse', drums: 'batterie', percussion: 'percussions', keys: 'claviers', piano: 'piano', accordion: 'accordéon', violin: 'violon', viola: 'alto', cello: 'violoncelle', trumpet: 'trompette', trombone: 'trombone', saxophone: 'saxophone', clarinet: 'clarinette', flute: 'fl\u00fbte', harmonica: 'harmonica', dj: 'dj', other: 'autre' },
  },
  de: {
    nav_board: 'Gig-Board',
    nav_msgs: 'Nachrichten', msg_btn: 'Nachricht', msg_send: 'Senden', msg_sent: 'Nachricht gesendet.', msg_placeholder: 'Nachricht schreiben\u2026', no_threads: 'Noch keine Unterhaltungen — sie beginnen mit einer Bewerbung.', thread_empty: 'Noch keine Nachrichten — sag hallo.', back: 'Zur\u00fcck',
    cta_jam: 'Jam-Partner finden', cta_gigs: 'Bezahlte Gigs ansehen', land_d_board: 'Alle offenen Gigs und Jams in deiner N\u00e4he — \u00f6ffentliche Gagen, gefiltert nach Instrument und Distanz.', land_d_post: 'Ersatz oder Jam-Partner gesucht? In zwei Minuten inseriert — passende Musiker:innen in der N\u00e4he werden benachrichtigt.', land_d_mine: 'Behalte Anzeigen und Bewerbungen im Blick, buche Musiker:innen, bewerte nach dem Gig.', land_d_bands: 'Gr\u00fcnde eine Band mit offenen Pl\u00e4tzen oder tritt einer bei — mit echtem Leistungsausweis der Mitglieder.', land_d_profile: 'Deine Instrumente, Demos und Bewertungen — plus eine \u00f6ffentliche Seite zum Teilen.',
    how_it_works: 'So funktioniert\u2019s', tagline: 'Gigs \u00b7 Jams \u00b7 Bands', feedback: 'Feedback', fb_label: 'Was sollen wir verbessern?', fb_email_label: 'Deine E-Mail (optional, f\u00fcr eine Antwort)', fb_send: 'Senden', fb_sent_t: 'Nachricht gesendet', fb_thanks: 'Danke \u2014 dein Feedback ist bei uns angekommen.', fb_fail: 'Feedback konnte nicht gesendet werden', welcome_profile: 'Willkommen! Richte dein Musikerprofil ein — damit kannst du dich auf Gigs und Jams bewerben.',
    land_head: 'Finde einen Ersatz. Finde Jam-Partner. Gr\u00fcnde eine Band.', land_sub: 'JamWerk verbindet lokale Musiker:innen: bezahlte Gigs mit \u00f6ffentlichen Gagen, kostenlose Jam-Partner und offene Bandpl\u00e4tze — passend zu Instrument und Region.', land_s1: 'Erstelle dein gratis Musikerprofil: Instrumente, Stadt, Reiseradius.', land_s2: 'St\u00f6bern oder inserieren: bezahlte Gigs, Jams, Bandpl\u00e4tze. Alerts an, und Treffer erreichen dein Handy.', land_s3: 'Buchen oder verbinden. Abgeschlossene Gigs bringen Bewertungen f\u00fcr deinen \u00f6ffentlichen Leistungsausweis.', aud_jam_t: 'Einfach nur jammen?', aud_jam_p: 'Jam-Anzeigen sind gratis und locker — keine Gagen, keine Bewertungen, kein Druck. Finde Leute auf deinem Niveau, vom Anf\u00e4nger bis zur Wochenendband.', aud_pro_t: 'Berufsmusiker:in?', aud_pro_p: 'Bezahlte Ersatz-Gigs mit vorab genannter Gage in CHF. Bewertungen aus echten Gigs bauen einen teilbaren Leistungsausweis auf.', land_alerts: 'Tippe nach der Anmeldung auf die Glocke — Gigs f\u00fcr dein Instrument in deiner N\u00e4he erreichen dein Handy, sobald sie erscheinen.', cta_join: 'Gratis Profil erstellen', cta_browse: 'Anzeigen ansehen', lvl_label: 'Erfahrungsstufe', whos_welcome: 'Wer ist willkommen', lvl_any: 'alle willkommen', lvl_hobby: 'Hobby', lvl_semi: 'semiprofessionell', lvl_pro: 'Profi',
    nav_bands: 'Bands', start_band: 'Band gründen', band_name: 'Bandname', band_created: 'Band erstellt.', seats_l: 'Offene Plätze (Instrumente wählen)', members_n2: '{0} Mitglieder', add_seat: 'Platz hinzufügen', seat_added: 'Platz hinzugefügt.', close_seat: 'Platz schliessen', seat_closed: 'Platz geschlossen.', joined_ok: '{0} ist der Band beigetreten — Kontakt geteilt.', applied_seat_ok: 'Für den Platz beworben.', no_bands: 'Noch keine Bands. Gründe eine!', lineup_full: 'Besetzung komplett', applications_gigs: '{0} Gigs', st_filled: 'besetzt', nav_post: 'Gig einstellen', nav_mine: 'Meine Gigs', nav_profile: 'Musikerprofil',
    seg_gigs: 'Bezahlte Gigs', seg_practice: 'Übungspartner', all_instruments: 'Alle Instrumente', ph_city: 'Stadt', btn_filter: 'Filtern',
    login: 'Anmelden', logout: 'Abmelden', alerts: 'Alerts', alerts_on: 'Alerts an', register: 'Registrieren',
    email: 'E-Mail', password: 'Passwort', name_label: 'Name (für Bandleader sichtbar)',
    need_account: 'Kein Konto? Registrieren', have_account: 'Schon ein Konto? Anmelden', forgot: 'Passwort vergessen?', close: 'Schliessen',
    listing_type: 'Anzeigentyp', opt_gig: 'Bezahlter Gig — mit Datum, fixe Gage', opt_practice: 'Übungspartner — gratis, offen',
    instrument_needed: 'Gesuchtes Instrument', date: 'Datum', date_opt: 'Datum (optional)', city: 'Stadt', fee: 'Gage (CHF, ganzer Gig)',
    call_time: 'Treffzeit', end_time: 'Ende', genres_csv: 'Genres (kommagetrennt)', description: 'Beschreibung',
    req_charts: 'Notenlesen erforderlich', req_rehearsal: 'eine Probe', post_gig_btn: 'Veröffentlichen',
    instruments_l: 'Instrumente', home_city: 'Wohnort', radius: 'Reiseradius (km)',
    reads_charts: 'liest Noten', backing: 'Backing Vocals', transport: 'eigenes Fahrzeug', own_pa: 'eigene PA',
    demo_links_l: 'Demo-Links (einer pro Zeile, max. 5)', save_profile: 'Profil speichern', public_page: 'Meine öffentliche Seite \u2197',
    empty_gigs: 'Im Moment keine bezahlten Gigs gefunden.', empty_practice: 'Im Moment keine Jam-Partner oder Anzeigen gefunden.', empty_sub: 'Schalte Alerts ein und du erfährst sofort, wenn etwas für dein Instrument in deiner Nähe eingestellt wird.', empty_alerts_btn: 'Alerts einschalten', alerts_already: 'Alerts sind schon an — du erfährst es, sobald etwas eingestellt wird.',
    your_gig: 'Dein Gig — verwalte ihn unter \u201eMeine Gigs\u201c.', apply: 'Bewerben', jam: 'Jam', flexible: 'flexibel',
    applied_ok: 'Beworben. Der Bandleader sieht dein Profil.', could_not_apply: 'Bewerbung nicht möglich',
    gig_posted: 'Gig veröffentlicht.', practice_posted: 'Übungs-Anzeige veröffentlicht.', profile_saved: 'Profil gespeichert.', failed: 'Fehlgeschlagen',
    review_saved: 'Bewertung gespeichert.', booked_ok: '{0} gebucht. Die anderen wurden abgesagt.', connected_ok: 'Mit {0} verbunden — deine Kontaktdaten wurden geteilt.',
    gig_cancelled: 'Gig abgesagt.', listing_closed: 'Anzeige geschlossen.', gig_completed_ok: 'Gig abgeschlossen — du kannst jetzt bewerten.',
    reset_sent: 'Falls das Konto existiert, ist ein Reset-Link unterwegs.', email_confirmed: 'E-Mail bestätigt — willkommen an Bord.',
    confirm_invalid: 'Dieser Bestätigungslink ist ungültig oder schon benutzt.', pw_updated: 'Passwort aktualisiert — du bist angemeldet.', reset_failed: 'Zurücksetzen fehlgeschlagen',
    alerts_off: 'Alerts aus.', alerts_on_msg: 'Alerts an — Gigs in deiner Nähe erreichen dieses Gerät.',
    notif_blocked: 'Benachrichtigungen sind im Browser blockiert.', alerts_error: 'Alert-Einstellungen konnten nicht geändert werden.', alerts_enable_fail: 'Alerts konnten nicht aktiviert werden',
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
    inst: { vocals: 'Gesang', guitar: 'Gitarre', bass: 'Bass', double_bass: 'Kontrabass', drums: 'Schlagzeug', percussion: 'Percussion', keys: 'Keys', piano: 'Klavier', accordion: 'Akkordeon', violin: 'Violine', viola: 'Bratsche', cello: 'Cello', trumpet: 'Trompete', trombone: 'Posaune', saxophone: 'Saxophon', clarinet: 'Klarinette', flute: 'Fl\u00f6te', harmonica: 'Mundharmonika', dj: 'DJ', other: 'Sonstiges' },
  },
  it: {
    nav_board: 'Bacheca concerti',
    nav_msgs: 'Messaggi', msg_btn: 'Messaggio', msg_send: 'Invia', msg_sent: 'Messaggio inviato.', msg_placeholder: 'Scrivi un messaggio\u2026', no_threads: 'Ancora nessuna conversazione — iniziano da una candidatura.', thread_empty: 'Ancora nessun messaggio — saluta.', back: 'Indietro',
    cta_jam: 'Trova partner per jam', cta_gigs: 'Vedi i concerti pagati', land_d_board: 'Tutti i concerti e le jam aperti vicino a te — cachet pubblici, filtrati per strumento e distanza.', land_d_post: 'Cerchi un sostituto o partner per una jam? Pubblica in due minuti — i musicisti compatibili nelle vicinanze ricevono un avviso.', land_d_mine: 'Segui annunci e candidature, ingaggia musicisti, lascia recensioni dopo il concerto.', land_d_bands: 'Crea un gruppo con posti aperti o unisciti a uno — con il vero percorso dei membri.', land_d_profile: 'I tuoi strumenti, demo e recensioni — pi\u00f9 una pagina pubblica da condividere ovunque.',
    how_it_works: 'Come funziona', tagline: 'concerti · jam · band', feedback: 'Feedback', fb_label: 'Cosa possiamo migliorare?', fb_email_label: 'La tua e-mail (facoltativa, per una risposta)', fb_send: 'Invia', fb_sent_t: 'Messaggio inviato', fb_thanks: 'Grazie — il tuo feedback ci è arrivato.', fb_fail: 'Impossibile inviare il feedback', welcome_profile: 'Benvenuto/a! Crea il tuo profilo musicista — \u00e8 ci\u00f2 che ti permette di candidarti a concerti e jam.',
    land_head: 'Trova un sostituto. Trova una jam. Crea un gruppo.', land_sub: 'JamWerk collega i musicisti locali: concerti pagati con cachet pubblici, partner di jam gratuiti e posti nei gruppi — in base al tuo strumento e alla tua zona.', land_s1: 'Crea il tuo profilo musicista gratuito: strumenti, citt\u00e0, raggio di spostamento.', land_s2: 'Sfoglia o pubblica: concerti pagati, jam, posti nei gruppi. Attiva gli avvisi e le corrispondenze arrivano sul telefono.', land_s3: 'Prenota o connettiti. I concerti completati generano recensioni che costruiscono la tua reputazione pubblica.', aud_jam_t: 'Vuoi solo suonare?', aud_jam_p: 'Gli annunci di prova sono gratuiti e informali — niente cachet, niente voti, niente pressione. Trova persone del tuo livello, dai principianti alle band del weekend.', aud_pro_t: 'Musicista professionista?', aud_pro_p: 'Concerti pagati con il cachet dichiarato in anticipo, in CHF. Le recensioni di concerti reali costruiscono una reputazione condivisibile.', land_alerts: 'Tocca la campanella dopo la registrazione — i concerti per il tuo strumento vicino a te arrivano sul telefono appena pubblicati.', cta_join: 'Crea il tuo profilo gratuito', cta_browse: 'Guarda gli annunci', lvl_label: 'Livello', whos_welcome: 'Chi \u00e8 benvenuto', lvl_any: 'aperto a tutti', lvl_hobby: 'amatoriale', lvl_semi: 'semi-pro', lvl_pro: 'pro',
    nav_bands: 'Gruppi', start_band: 'Crea un gruppo', band_name: 'Nome del gruppo', band_created: 'Gruppo creato.', seats_l: 'Posti aperti (scegli gli strumenti)', members_n2: '{0} membri', add_seat: 'Aggiungi posto', seat_added: 'Posto aggiunto.', close_seat: 'Chiudi il posto', seat_closed: 'Posto chiuso.', joined_ok: '{0} è entrato/a nel gruppo — contatto condiviso.', applied_seat_ok: 'Candidatura inviata per il posto.', no_bands: 'Ancora nessun gruppo. Creane uno!', lineup_full: 'Formazione al completo', applications_gigs: '{0} concerti', st_filled: 'assegnato', nav_post: 'Pubblica annuncio', nav_mine: 'I miei concerti', nav_profile: 'Profilo musicista',
    seg_gigs: 'Concerti pagati', seg_practice: 'Partner di prova', all_instruments: 'Tutti gli strumenti', ph_city: 'Città', btn_filter: 'Filtra',
    login: 'Accedi', logout: 'Esci', alerts: 'Avvisi', alerts_on: 'Avvisi attivi', register: 'Registrati',
    email: 'E-mail', password: 'Password', name_label: 'Nome (visibile ai bandleader)',
    need_account: 'Nessun account? Registrati', have_account: 'Hai già un account? Accedi', forgot: 'Password dimenticata?', close: 'Chiudi',
    listing_type: 'Tipo di annuncio', opt_gig: 'Concerto pagato — con data, cachet fisso', opt_practice: 'Partner di prova — gratuito, senza data',
    instrument_needed: 'Strumento cercato', date: 'Data', date_opt: 'Data (facoltativa)', city: 'Città', fee: 'Cachet (CHF, intero concerto)',
    call_time: 'Orario di ritrovo', end_time: 'Orario di fine', genres_csv: 'Generi (separati da virgole)', description: 'Descrizione',
    req_charts: 'lettura spartiti richiesta', req_rehearsal: 'una prova', post_gig_btn: 'Pubblica',
    instruments_l: 'Strumenti', home_city: 'Città di residenza', radius: 'Raggio di spostamento (km)',
    reads_charts: 'legge spartiti', backing: 'cori', transport: 'mezzo proprio', own_pa: 'impianto proprio',
    demo_links_l: 'Link demo (uno per riga, max 5)', save_profile: 'Salva profilo', public_page: 'La mia pagina pubblica \u2197',
    empty_gigs: 'Nessun concerto pagato trovato al momento.', empty_practice: 'Nessun partner di jam o annuncio trovato al momento.', empty_sub: 'Attiva gli avvisi e saprai subito quando viene pubblicato qualcosa per il tuo strumento vicino a te.', empty_alerts_btn: 'Attiva gli avvisi', alerts_already: 'Gli avvisi sono già attivi — saprai subito quando viene pubblicato qualcosa.',
    your_gig: 'Il tuo annuncio — gestiscilo in \u00abI miei concerti\u00bb.', apply: 'Candidati', jam: 'Jam', flexible: 'flessibile',
    applied_ok: 'Candidatura inviata. Il bandleader vedrà il tuo profilo.', could_not_apply: 'Candidatura non possibile',
    gig_posted: 'Concerto pubblicato.', practice_posted: 'Annuncio di prova pubblicato.', profile_saved: 'Profilo salvato.', failed: 'Errore',
    review_saved: 'Recensione salvata.', booked_ok: '{0} ingaggiato/a. Gli altri sono stati declinati.', connected_ok: 'In contatto con {0} — ha ricevuto i tuoi recapiti.',
    gig_cancelled: 'Concerto annullato.', listing_closed: 'Annuncio chiuso.', gig_completed_ok: 'Concerto completato — ora puoi lasciare una recensione.',
    reset_sent: 'Se l\u2019account esiste, un link di reimpostazione è in arrivo.', email_confirmed: 'E-mail confermata — benvenuto/a!',
    confirm_invalid: 'Questo link di conferma non è valido o è già stato usato.', pw_updated: 'Password aggiornata — sei connesso.', reset_failed: 'Reimpostazione non riuscita',
    alerts_off: 'Avvisi disattivati.', alerts_on_msg: 'Avvisi attivi — i concerti vicino a te arriveranno su questo dispositivo.',
    notif_blocked: 'Le notifiche sono bloccate nel browser.', alerts_error: 'Impossibile modificare gli avvisi.', alerts_enable_fail: 'Impossibile attivare gli avvisi',
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
    inst: { vocals: 'voce', guitar: 'chitarra', bass: 'basso', double_bass: 'contrabbasso', drums: 'batteria', percussion: 'percussioni', keys: 'tastiere', piano: 'pianoforte', accordion: 'fisarmonica', violin: 'violino', viola: 'viola', cello: 'violoncello', trumpet: 'tromba', trombone: 'trombone', saxophone: 'sassofono', clarinet: 'clarinetto', flute: 'flauto', harmonica: 'armonica', dj: 'dj', other: 'altro' },
  },
};
let lang = localStorage.getItem('lang') || (navigator.language || 'en').slice(0, 2);
if (!I18N[lang]) lang = 'en';
const T = (k, a) => {
  const v = I18N[lang][k] !== undefined ? I18N[lang][k] : I18N.en[k];
  return v === undefined ? k : String(v).replace('{0}', a === undefined ? '' : a);
};
const TS = (s) => T('st_' + s) === 'st_' + s ? s : T('st_' + s);
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = T(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = T(n.dataset.i18nPh); });
  document.documentElement.lang = lang;
}
let me = null;
let boardKind = 'gig';
let landingDismissed = false;
$('ctaBrowse').onclick = () => { landingDismissed = true; $('landing').hidden = true; };
$('ctaJam').onclick = () => { landingDismissed = true; $('landing').hidden = true; switchKind('practice'); };
$('ctaGigs').onclick = () => { landingDismissed = true; $('landing').hidden = true; switchKind('gig'); };
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
$('footFeedback').onclick = () => {
  $('fbEmailRow').hidden = !!me;
  $('fbMsg').className = 'msg';
  $('fbForm').hidden = false;
  $('fbDone').hidden = true;
  $('fbDialog').showModal();
  if (tsFb === null) tsFb = tsRender('tsFb');
};
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
const flash = (text, kind) => {
  const f = $('flash');
  f.className = 'msg ' + kind;
  f.textContent = text;
  setTimeout(() => { f.className = 'msg'; }, 5000);
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
  $('landing').hidden = !!me || landingDismissed;
  $('howBtn').hidden = !!me;
  refreshMsgBadge();
  $('who').textContent = me ? me.email : '';
  $('authBtn').textContent = me ? T('logout') : T('login');
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
$('authSwitch').onclick = () => {
  registering = !registering;
  $('authTitle').textContent = registering ? T('register') : T('login');
  $('authSubmit').textContent = registering ? T('register') : T('login');
  $('authSwitch').textContent = registering ? T('have_account') : T('need_account');
  $('aNameRow').hidden = !registering;
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
  const body = { email: $('aEmail').value, password: $('aPassword').value };
  if (registering) { body.display_name = $('aName').value; body.lang = lang; body.turnstile_token = tsToken(tsAuth); }
  const r = await api(registering ? '/auth/register' : '/auth/login', { method: 'POST', body });
  if (!r.ok) { const m = $('authMsg'); m.className = 'msg err'; m.textContent = r.json.error || 'Failed'; if (registering) tsReset(tsAuth); return; }
  me = { email: r.json.email };
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
  head.append(el('span', 'fee', g.kind === 'practice' ? T('jam') : 'CHF ' + g.fee_chf));
  c.append(head);
  const tags = el('div');
  (g.genres || []).forEach((x) => tags.append(el('span', 'tag', x), document.createTextNode(' ')));
  if (g.requirements && g.requirements.reads_charts) tags.append(el('span', 'tag', 'reads charts'));
  c.append(tags);
  c.append(el('p', '', g.description));
  if (actions) c.append(actions(g));
  return c;
}
async function loadBoard() {
  const params = new URLSearchParams();
  params.set('kind', boardKind);
  if ($('fInstrument').value) params.set('instrument', $('fInstrument').value);
  if ($('fCity').value.trim()) {
    params.set('city', $('fCity').value.trim());
    params.set('radius_km', $('fRadius').value);
  }
  const r = await api('/gigs?' + params);
  const board = $('board');
  board.replaceChildren();
  if (!r.json.gigs || !r.json.gigs.length) {
    const card = el('div', 'card');
    const title = el('div', 'display', boardKind === 'practice' ? T('empty_practice') : T('empty_gigs'));
    title.style.cssText = 'font-size: 17px; font-weight: 700; margin-bottom: 6px;';
    card.append(title, el('p', 'muted', T('empty_sub')));
    const bar = el('div');
    bar.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';
    const main = el('button', 'primary small', me ? T('empty_alerts_btn') : T('cta_join'));
    main.onclick = async () => {
      if (!me) { if (!registering) $('authSwitch').onclick(); $('authDialog').showModal(); return; }
      try {
        if (await currentSub()) { flash(T('alerts_already'), 'ok'); return; }
        await subscribeAlerts();
        refreshNotifBtn();
      } catch { flash(T('alerts_error'), 'err'); }
    };
    const post = el('button', 'ghost small', T('nav_post'));
    post.onclick = () => document.querySelector('[data-tab=post]').click();
    bar.append(main, post);
    card.append(bar);
    board.append(card);
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
  const practice = $('pKind').value === 'practice';
  $('pFeeRow').hidden = practice;
  $('pLevelRow').hidden = !practice;
  $('pFee').required = !practice;
  $('pDate').required = !practice;
  $('pDateRow').querySelector('label').textContent = practice ? T('date_opt') : T('date');
};

// ── Post ─────────────────────────────────────────────
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
    fee_chf: practice ? undefined : parseInt($('pFee').value, 10),
    call_time: $('pCall').value || undefined,
    end_time: $('pEnd').value || undefined,
    description: $('pDesc').value,
    requirements: { reads_charts: $('pCharts').checked, rehearsal: $('pRehearsal').checked, level: practice ? $('pLevel').value : undefined },
  };
  const r = await api('/gigs', { method: 'POST', body });
  if (r.ok) {
    flash(practice ? T('practice_posted') : T('gig_posted'), 'ok');
    $('postForm').reset(); $('pKind').onchange();
    boardKind = practice ? 'practice' : 'gig';
    document.querySelectorAll('#kindSeg button').forEach((x) => x.classList.toggle('active', x.dataset.kind === boardKind));
    document.querySelector('[data-tab=board]').click();
  }
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
    head.append(el('div', 'avatar', initials));
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
  $('mRadius').value = r.json.travel_radius_km;
  $('mLevel').value = r.json.level || '';
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
    travel_radius_km: parseInt($('mRadius').value, 10) || 30,
    level: $('mLevel').value || undefined,
    reads_charts: $('mCharts').checked,
    sings_backing: $('mBacking').checked,
    own_transport: $('mTransport').checked,
    own_pa: $('mPa').checked,
    demo_links: $('mDemos').value.split('\\n').map((x) => x.trim()).filter(Boolean),
  };
  const r = await api('/musicians/me', { method: 'POST', body });
  if (r.ok) { flash(T('profile_saved'), 'ok'); loadProfile(); } else flash(r.json.error || T('failed'), 'err');
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
    genres: parseCsv($('bGenres').value),
    description: $('bDesc').value,
    seats: [...document.querySelectorAll('#bSeats input:checked')].map((x) => x.value),
  };
  const r = await api('/bands', { method: 'POST', body });
  if (r.ok) { flash(T('band_created'), 'ok'); $('bandForm').reset(); loadBands(); }
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
  $('notifBtn').hidden = false;
}
async function subscribeAlerts() {
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
      if (r.ok) { me = { email: r.json.email }; flash(T('pw_updated'), 'ok'); }
      else flash(r.json.error || T('reset_failed'), 'err');
    }
  }
  if (q.toString()) history.replaceState(null, '', '/');
  const r = await api('/auth/me');
  if (r.ok) me = { email: r.json.email };
  renderAuth(); loadBoard(); loadProfile();
})();
</script>
</body>
</html>`;
