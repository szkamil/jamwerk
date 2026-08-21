// src/ui.ts
// Single-page UI over the JSON API. Server ships static HTML + vanilla JS;
// all state lives in the API. Rendering uses DOM building (textContent),
// never innerHTML with user data.
// Ambient layers for the "backstage editorial" theme (mirrors design/):
// an audio-waveform strip along the header's bottom edge, and a faint violet
// scatter of notation behind the page. Deterministic — same field every load.
const WAVE_SVG = (() => {
  const heights = [8, 14, 10, 22, 30, 18, 12, 26, 36, 24, 14, 20, 32, 16, 10, 24, 34, 28, 16, 12, 22, 38, 26, 14, 18, 30, 20, 10, 16, 28, 36, 22, 12, 20, 26, 18, 32, 14, 8];
  let bars = '';
  for (let i = 0; i < 120; i++) {
    const h = heights[i % heights.length];
    bars += `<rect x="${i * 10 + 2}" y="${40 - h}" width="6" height="${h}" rx="2"></rect>`;
  }
  return `<svg class="wave" viewBox="0 0 1200 40" preserveAspectRatio="none" fill="#a58bff" aria-hidden="true">${bars}</svg>`;
})();

const NOTES_LAYER = (() => {
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
<title>JamWerk — find a dep, fill a gig</title>
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
  header h1 { font-family: 'Bricolage Grotesque', 'Avenir Next Condensed', system-ui, sans-serif; font-size: 25px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
  header h1 span { color: var(--accent-light); }
  header .spacer { flex: 1; }
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
  .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; align-items: center; }
  .filters select, .filters input { width: auto; flex: 1 1 130px; border-radius: 999px; padding: 10px 14px; }
  .seg { display: flex; background: #232230; border-radius: 12px; padding: 4px; gap: 4px; flex: 1 1 100%; max-width: 360px; }
  .seg button { flex: 1; border: 0; background: transparent; color: #b9b6c9; border-radius: 9px; padding: 10px 0; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; min-height: 42px; }
  .seg button.active { background: var(--accent); color: #fff; font-weight: 600; }
  .empty { text-align: center; padding: 36px 10px; color: var(--muted); }
  dialog { border: 1px solid var(--line); border-radius: var(--r); padding: 20px; max-width: 420px; width: 92%; background: var(--card); }
  dialog::backdrop { background: rgba(20,19,26,.5); }
  .application { border-top: 1px solid var(--line); padding-top: 10px; margin-top: 10px; }
</style>
</head>
<body>
${NOTES_LAYER}
<header>
  ${WAVE_SVG}
  <h1>Jam<span>Werk</span></h1>
  <span style="color: rgba(255,255,255,0.55); font-size: 13.5px;">find a dep, fill a gig</span>
  <span class="spacer"></span>
  <span class="who" id="who"></span>
  <button class="ghost small" id="authBtn" style="background: transparent; color: #fff; border-color: rgba(255,255,255,0.35);">Log in</button>
</header>
<nav id="tabs">
  <button data-tab="board" class="active">Gig board</button>
  <button data-tab="post">Post a gig</button>
  <button data-tab="mine">My gigs</button>
  <button data-tab="profile">Musician profile</button>
</nav>
<main>
  <div class="msg" id="flash"></div>

  <section id="tab-board">
    <div class="filters">
      <div class="seg" id="kindSeg">
        <button type="button" data-kind="gig" class="active">Paid gigs</button>
        <button type="button" data-kind="practice">Practice partners</button>
      </div>
      <select id="fInstrument"><option value="">All instruments</option></select>
      <input type="text" id="fCity" placeholder="City">
      <select id="fRadius">
        <option value="25">25 km</option>
        <option value="50" selected>50 km</option>
        <option value="100">100 km</option>
      </select>
      <button class="ghost" id="fGo">Filter</button>
    </div>
    <div id="board"></div>
  </section>

  <section id="tab-post" hidden>
    <div class="card"><form id="postForm">
      <div class="row"><label>Listing type</label>
        <select id="pKind">
          <option value="gig">Paid gig — dated, fixed fee</option>
          <option value="practice">Practice partner — free, open-ended</option>
        </select>
      </div>
      <div class="grid2">
        <div class="row"><label>Instrument needed</label><select id="pInstrument" required></select></div>
        <div class="row" id="pDateRow"><label>Date</label><input type="date" id="pDate" required></div>
        <div class="row"><label>City</label><input type="text" id="pCity" required placeholder="Bern"></div>
        <div class="row" id="pFeeRow"><label>Fee (CHF, whole gig)</label><input type="number" id="pFee" min="1" required placeholder="300"></div>
        <div class="row"><label>Call time</label><input type="time" id="pCall"></div>
        <div class="row"><label>End time</label><input type="time" id="pEnd"></div>
      </div>
      <div class="row"><label>Genres (comma-separated)</label><input type="text" id="pGenres" required placeholder="jazz, funk"></div>
      <div class="row"><label>Description</label><textarea id="pDesc" required placeholder="Two 45min sets, charts provided, backline on site…"></textarea></div>
      <div class="row checks">
        <label><input type="checkbox" id="pCharts"> must read charts</label>
        <label><input type="checkbox" id="pRehearsal"> one rehearsal</label>
      </div>
      <button class="primary">Post gig</button>
    </form></div>
  </section>

  <section id="tab-mine" hidden><div id="mine"></div></section>

  <section id="tab-profile" hidden>
    <div class="card"><form id="profileForm">
      <div class="row"><label>Instruments</label><div class="checks" id="mInstruments"></div></div>
      <div class="row"><label>Genres (comma-separated)</label><input type="text" id="mGenres" required placeholder="jazz, funk, wedding pop"></div>
      <div class="grid2">
        <div class="row"><label>Home city</label><input type="text" id="mCity" placeholder="Bern"></div>
        <div class="row"><label>Travel radius (km)</label><input type="number" id="mRadius" value="30" min="1" max="300"></div>
      </div>
      <div class="row checks">
        <label><input type="checkbox" id="mCharts"> reads charts</label>
        <label><input type="checkbox" id="mBacking"> backing vocals</label>
        <label><input type="checkbox" id="mTransport"> own transport</label>
        <label><input type="checkbox" id="mPa"> own PA</label>
      </div>
      <div class="row"><label>Demo links (one per line, max 5)</label><textarea id="mDemos" placeholder="https://youtube.com/…"></textarea></div>
      <button class="primary">Save profile</button>
      <span class="muted" id="mStats"></span>
    </form></div>
  </section>
</main>

<dialog id="authDialog">
  <form id="authForm">
    <h2 id="authTitle" style="margin-top:0">Log in</h2>
    <div class="msg" id="authMsg"></div>
    <div class="row"><label>Email</label><input type="email" id="aEmail" required autocomplete="username"></div>
    <div class="row"><label>Password</label><input type="password" id="aPassword" required minlength="8" autocomplete="current-password"></div>
    <div class="row" id="aNameRow" hidden><label>Name (shown to bandleaders)</label><input type="text" id="aName"></div>
    <button class="primary" id="authSubmit">Log in</button>
    <button type="button" class="ghost" id="authSwitch">Need an account? Register</button>
    <button type="button" class="ghost" id="authForgot">Forgot password?</button>
    <button type="button" class="ghost" id="authClose">Close</button>
  </form>
</dialog>

<script>
const $ = (id) => document.getElementById(id);
const INSTRUMENTS = ['vocals','guitar','bass','double_bass','drums','percussion','keys','piano','accordion','violin','viola','cello','trumpet','trombone','saxophone','clarinet','flute','harmonica','dj','other'];
let me = null;
let boardKind = 'gig';

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
const label = (i) => i.replace(/_/g, ' ');
const parseCsv = (s) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

// ── Auth ─────────────────────────────────────────────
let registering = false;
function renderAuth() {
  $('who').textContent = me ? me.email : '';
  $('authBtn').textContent = me ? 'Log out' : 'Log in';
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
  $('authTitle').textContent = registering ? 'Register' : 'Log in';
  $('authSubmit').textContent = registering ? 'Register' : 'Log in';
  $('authSwitch').textContent = registering ? 'Have an account? Log in' : 'Need an account? Register';
  $('aNameRow').hidden = !registering;
};
$('authClose').onclick = () => $('authDialog').close();
$('authForgot').onclick = async () => {
  const email = $('aEmail').value || prompt('Your account email:');
  if (!email) return;
  await api('/auth/forgot', { method: 'POST', body: { email } });
  $('authDialog').close();
  flash('If that account exists, a reset link is on its way.', 'ok');
};
$('authForm').onsubmit = async (e) => {
  e.preventDefault();
  const body = { email: $('aEmail').value, password: $('aPassword').value };
  if (registering) body.display_name = $('aName').value;
  const r = await api(registering ? '/auth/register' : '/auth/login', { method: 'POST', body });
  if (!r.ok) { const m = $('authMsg'); m.className = 'msg err'; m.textContent = r.json.error || 'Failed'; return; }
  me = { email: r.json.email };
  $('authDialog').close(); renderAuth(); loadBoard(); loadProfile();
};

// ── Tabs ─────────────────────────────────────────────
document.querySelectorAll('#tabs button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    ['board','post','mine','profile'].forEach((t) => { $('tab-' + t).hidden = t !== b.dataset.tab; });
    if (b.dataset.tab === 'mine') loadMine();
    if (b.dataset.tab === 'board') loadBoard();
  };
});

// ── Board ────────────────────────────────────────────
function gigCard(g, actions) {
  const c = el('div', 'card');
  const head = el('div', 'gig-head');
  head.append(el('strong', '', label(g.instrument)));
  head.append(el('span', 'tag status-' + g.status, g.status));
  head.append(el('span', 'muted', (g.gig_date || 'flexible') + ' · ' + g.venue_city + (g.distance_km != null ? ' · ' + g.distance_km + ' km' : '')));
  head.append(el('span', 'fee', g.kind === 'practice' ? 'Jam' : 'CHF ' + g.fee_chf));
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
    board.append(el('div', 'empty', boardKind === 'practice'
      ? 'No practice listings match. Post one!' : 'No open gigs match. Post one!'));
    return;
  }
  r.json.gigs.forEach((g) => board.append(gigCard(g, (gig) => {
    const bar = el('div');
    if (gig.is_mine) { bar.append(el('span', 'muted', 'Your gig — manage it under “My gigs”.')); return bar; }
    const btn = el('button', 'primary small', 'Apply');
    btn.onclick = async () => {
      if (!me) { $('authDialog').showModal(); return; }
      const note = prompt('Note to the bandleader (optional):') || '';
      const res = await api('/gigs/' + gig.id + '/apply', { method: 'POST', body: { note } });
      if (res.ok) flash('Applied. The bandleader will see your profile.', 'ok');
      else flash(res.json.error || 'Could not apply', 'err');
    };
    bar.append(btn);
    return bar;
  })));
}
$('fGo').onclick = loadBoard;
$('fRadius').onchange = loadBoard;
document.querySelectorAll('#kindSeg button').forEach((b) => {
  b.onclick = () => {
    boardKind = b.dataset.kind;
    document.querySelectorAll('#kindSeg button').forEach((x) => x.classList.toggle('active', x === b));
    loadBoard();
  };
});

// Practice listings have no fee and no fixed date.
$('pKind').onchange = () => {
  const practice = $('pKind').value === 'practice';
  $('pFeeRow').hidden = practice;
  $('pFee').required = !practice;
  $('pDate').required = !practice;
  $('pDateRow').querySelector('label').textContent = practice ? 'Date (optional)' : 'Date';
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
    requirements: { reads_charts: $('pCharts').checked, rehearsal: $('pRehearsal').checked },
  };
  const r = await api('/gigs', { method: 'POST', body });
  if (r.ok) {
    flash(practice ? 'Practice listing posted.' : 'Gig posted.', 'ok');
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
  if (!me) { wrap.append(el('div', 'empty', 'Log in to see your gigs and applications.')); return; }
  const r = await api('/gigs/mine');
  wrap.append(el('h2', '', 'Gigs I posted'));
  if (!r.json.posted.length) wrap.append(el('div', 'muted', 'None yet.'));
  for (const g of r.json.posted) {
    wrap.append(gigCard(g, (gig) => {
      const bar = el('div');
      bar.append(el('span', 'muted', gig.application_count + ' application(s) '));
      if (gig.status === 'open' || gig.status === 'booked') {
        const manage = el('button', 'ghost small', gig.status === 'open' ? 'Review applications' : 'Manage');
        manage.onclick = () => showManage(gig.id, bar);
        bar.append(manage);
      }
      if (gig.status === 'completed') {
        const rev = el('button', 'ghost small', 'Review musician');
        rev.onclick = () => submitReview(gig.id);
        bar.append(rev);
      }
      return bar;
    }));
  }
  wrap.append(el('h2', '', 'Gigs I applied to'));
  if (!r.json.applications.length) wrap.append(el('div', 'muted', 'None yet.'));
  for (const g of r.json.applications) {
    wrap.append(gigCard(g, (gig) => {
      const bar = el('div');
      bar.append(el('span', 'tag', 'application: ' + gig.application_status));
      if (gig.status === 'completed' && gig.application_status === 'accepted') {
        const rev = el('button', 'ghost small', 'Review bandleader');
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
    row.append(el('strong', '', a.musician_email), el('span', 'tag', a.status));
    if (a.gigs_played != null) row.append(el('span', 'muted', ' ' + a.gigs_played + ' gigs played · ' + (a.instruments || []).map(label).join(', ')));
    if (a.note) row.append(el('p', 'muted', a.note));
    (a.demo_links || []).forEach((u) => {
      const link = el('a', '', 'demo'); link.href = u; link.target = '_blank'; link.rel = 'noopener noreferrer';
      row.append(document.createTextNode(' '), link);
    });
    if (a.status === 'applied' || a.status === 'shortlisted') {
      const practice = r.json.kind === 'practice';
      const acc = el('button', 'primary small', practice ? 'Connect' : 'Book this musician');
      acc.onclick = async () => {
        const res = await api('/gigs/' + gigId + '/applications/' + a.id + '/accept', { method: 'POST' });
        if (res.ok) {
          flash(practice
            ? 'Connected with ' + res.json.musician_email + ' — they got your contact.'
            : 'Booked ' + res.json.musician_email + '. Others were declined.', 'ok');
          loadMine();
        } else flash(res.json.error || 'Failed', 'err');
      };
      row.append(document.createTextNode(' '), acc);
    }
    bar.append(row);
  }
  if (r.json.kind === 'practice' && r.json.status === 'open') {
    const close = el('button', 'ghost small', 'Close listing');
    close.onclick = async () => {
      const res = await api('/gigs/' + gigId + '/cancel', { method: 'POST', body: {} });
      if (res.ok) { flash('Listing closed.', 'ok'); loadMine(); } else flash(res.json.error || 'Failed', 'err');
    };
    const row = el('div', 'application');
    row.append(close);
    bar.append(row);
  }
  if (r.json.status === 'booked') {
    const done = el('button', 'primary small', 'Mark gig as completed');
    done.onclick = async () => {
      const res = await api('/gigs/' + gigId + '/complete', { method: 'POST' });
      if (res.ok) { flash('Gig completed — you can now leave a review.', 'ok'); loadMine(); }
      else flash(res.json.error || 'Failed', 'err');
    };
    const cancelBtn = el('button', 'ghost small', 'Cancel gig');
    cancelBtn.onclick = async () => {
      const reason = prompt('Reason for cancelling?') || '';
      const res = await api('/gigs/' + gigId + '/cancel', { method: 'POST', body: { reason } });
      if (res.ok) { flash('Gig cancelled.', 'ok'); loadMine(); } else flash(res.json.error || 'Failed', 'err');
    };
    const row = el('div', 'application');
    row.append(done, document.createTextNode(' '), cancelBtn);
    bar.append(row);
  }
}
async function submitReview(gigId) {
  const rating = parseInt(prompt('Rating 1-5:'), 10);
  if (!(rating >= 1 && rating <= 5)) return;
  const comment = prompt('Comment (optional):') || '';
  const r = await api('/gigs/' + gigId + '/review', { method: 'POST', body: { rating, comment } });
  if (r.ok) flash('Review saved.', 'ok'); else flash(r.json.error || 'Failed', 'err');
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
  $('mCharts').checked = !!r.json.reads_charts;
  $('mBacking').checked = !!r.json.sings_backing;
  $('mTransport').checked = !!r.json.own_transport;
  $('mPa').checked = !!r.json.own_pa;
  $('mDemos').value = (r.json.demo_links || []).join('\\n');
  $('mStats').textContent = ' ' + r.json.gigs_played + ' gigs played through JamWerk';
}
$('profileForm').onsubmit = async (e) => {
  e.preventDefault();
  if (!me) { $('authDialog').showModal(); return; }
  const body = {
    instruments: [...document.querySelectorAll('#mInstruments input:checked')].map((x) => x.value),
    genres: parseCsv($('mGenres').value),
    home_city: $('mCity').value || undefined,
    travel_radius_km: parseInt($('mRadius').value, 10) || 30,
    reads_charts: $('mCharts').checked,
    sings_backing: $('mBacking').checked,
    own_transport: $('mTransport').checked,
    own_pa: $('mPa').checked,
    demo_links: $('mDemos').value.split('\\n').map((x) => x.trim()).filter(Boolean),
  };
  const r = await api('/musicians/me', { method: 'POST', body });
  if (r.ok) flash('Profile saved.', 'ok'); else flash(r.json.error || 'Failed', 'err');
};

// ── Init ─────────────────────────────────────────────
for (const i of INSTRUMENTS) {
  $('fInstrument').append(new Option(label(i), i));
  $('pInstrument').append(new Option(label(i), i));
  const cb = el('label');
  const input = el('input'); input.type = 'checkbox'; input.value = i;
  cb.append(input, document.createTextNode(label(i)));
  $('mInstruments').append(cb);
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
(async () => {
  const q = new URLSearchParams(location.search);
  if (q.get('confirmed') === '1') flash('Email confirmed — welcome aboard.', 'ok');
  if (q.get('confirmed') === '0') flash('That confirmation link is invalid or already used.', 'err');
  const resetToken = q.get('reset');
  if (resetToken) {
    const pw = prompt('Set a new password (min 8 characters):');
    if (pw) {
      const r = await api('/auth/reset', { method: 'POST', body: { token: resetToken, password: pw } });
      if (r.ok) { me = { email: r.json.email }; flash('Password updated — you are logged in.', 'ok'); }
      else flash(r.json.error || 'Reset failed', 'err');
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
