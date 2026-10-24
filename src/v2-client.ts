// Client for /v2 only. Served as its own /assets/v2.*.js file.
// Kept free of ${} so it can live in a template literal below.
export const V2_CLIENT = `
(function () {
  var boot = JSON.parse(document.getElementById('v2-boot').textContent);
  var COPY = boot.copy;
  var lang = boot.lang;
  var me = boot.authed ? { ok: true } : null;
  var currentTab = 'home';
  var lastFaces = null;
  var tsWidget = null;
  var authMode = 'login';
  var installEvent = null;
  var PATHS = { home: '/v2', musicians: '/v2/musicians', bands: '/v2/bands', jams: '/v2/jams', gigs: '/v2/gigs' };
  var EMBED_OK = ['https://www.youtube-nocookie.com/', 'https://player.vimeo.com/', 'https://open.spotify.com/', 'https://w.soundcloud.com/'];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function T(k, a) {
    var pack = COPY[lang] || COPY.en;
    var v = pack[k] != null ? pack[k] : (COPY.en[k] != null ? COPY.en[k] : k);
    return String(v).split('{0}').join(a == null ? '' : String(a));
  }
  function initials(name) {
    var parts = String(name || '').trim().split(/\\s+/).slice(0, 2);
    var s = '';
    for (var i = 0; i < parts.length; i++) if (parts[i]) s += parts[i].charAt(0);
    return s.toUpperCase() || '?';
  }
  function labelInst(id) {
    var list = boot.instruments || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i][lang] || list[i].en;
    return String(id || '').replace(/_/g, ' ');
  }
  function genreLabel(id) {
    var list = boot.genres || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i][lang] || list[i].en;
    return String(id || '').replace(/_/g, ' ');
  }
  function safeEmbed(url) {
    if (!url) return '';
    for (var i = 0; i < EMBED_OK.length; i++) if (url.indexOf(EMBED_OK[i]) === 0) return url;
    return '';
  }
  function fillInstruments() {
    var sels = document.querySelectorAll('select.inst');
    for (var s = 0; s < sels.length; s++) {
      var sel = sels[s];
      var cur = sel.value;
      sel.replaceChildren();
      var all = document.createElement('option');
      all.value = '';
      all.textContent = T('all_instruments');
      sel.append(all);
      var list = boot.instruments || [];
      for (var i = 0; i < list.length; i++) {
        var o = document.createElement('option');
        o.value = list[i].id;
        o.textContent = list[i][lang] || list[i].en;
        sel.append(o);
      }
      sel.value = cur;
    }
  }
  function fillGenres() {
    var sel = $('bandGenre');
    if (!sel) return;
    var cur = sel.value;
    sel.replaceChildren();
    var all = document.createElement('option');
    all.value = '';
    all.textContent = T('all_genres');
    sel.append(all);
    var list = boot.genres || [];
    for (var i = 0; i < list.length; i++) {
      var o = document.createElement('option');
      o.value = list[i].id;
      o.textContent = list[i][lang] || list[i].en;
      sel.append(o);
    }
    sel.value = cur;
  }
  function fillTerms() {
    var span = $('termsText');
    if (!span) return;
    span.replaceChildren();
    span.append(document.createTextNode(T('terms_before')));
    var a1 = document.createElement('a');
    a1.href = '/about#terms';
    a1.textContent = T('terms_link');
    span.append(a1);
    span.append(document.createTextNode(T('terms_mid')));
    var a2 = document.createElement('a');
    a2.href = '/about#privacy';
    a2.textContent = T('privacy_link');
    span.append(a2);
    span.append(document.createTextNode(T('terms_after')));
  }
  function applyI18n() {
    document.documentElement.lang = lang;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = T(nodes[i].getAttribute('data-i18n'));
    var ph = document.querySelectorAll('[data-i18n-ph]');
    for (var j = 0; j < ph.length; j++) ph[j].setAttribute('placeholder', T(ph[j].getAttribute('data-i18n-ph')));
    var langs = document.querySelectorAll('#langs button');
    for (var k = 0; k < langs.length; k++) langs[k].setAttribute('aria-pressed', langs[k].getAttribute('data-lang') === lang ? 'true' : 'false');
    fillInstruments();
    fillGenres();
    fillTerms();
    var titles = { home: 'title_home', musicians: 'title_musicians', bands: 'title_bands', jams: 'title_jams', gigs: 'title_gigs' };
    document.title = T(titles[currentTab] || 'title_home');
    var authBtn = $('authBtn');
    if (authBtn) authBtn.textContent = me ? T('logout') : T('login');
    var submit = $('authSubmit');
    if (submit && $('authDialog').open) submit.textContent = authMode === 'register' ? T('create_profile') : T('login');
  }
  function setLang(next) {
    if (!COPY[next] || next === lang) return;
    lang = next;
    document.cookie = 'jw-v2-lang=' + next + ';path=/;max-age=31536000;samesite=lax';
    applyI18n();
    if (lastFaces) renderFaces(lastFaces);
    if (currentTab === 'musicians') loadMusicians();
    else if (currentTab === 'bands') loadBands();
    else if (currentTab === 'jams') loadJams();
    else if (currentTab === 'gigs') loadGigs();
  }

  function tabFromLocation() {
    var path = location.pathname.replace(/\\/$/, '') || '/v2';
    if (path === '/v2/musicians') return 'musicians';
    if (path === '/v2/bands') return 'bands';
    if (path === '/v2/jams') return 'jams';
    if (path === '/v2/gigs' || path.indexOf('/v2/gigs/') === 0) return 'gigs';
    return 'home';
  }
  function go(tab, params) {
    var url = new URL(PATHS[tab] || '/v2', location.origin);
    if (params) params.forEach(function (v, k) { if (v) url.searchParams.set(k, v); });
    history.pushState({ tab: tab }, '', url);
    show(tab);
  }
  function show(tab) {
    currentTab = tab;
    var names = ['home', 'musicians', 'bands', 'jams', 'gigs'];
    for (var i = 0; i < names.length; i++) {
      var page = $('page-' + names[i]);
      if (page) page.hidden = names[i] !== tab;
    }
    var nav = document.querySelectorAll('[data-go]');
    for (var n = 0; n < nav.length; n++) {
      var on = nav[n].getAttribute('data-go') === tab;
      nav[n].classList.toggle('active', on);
      if (on) nav[n].setAttribute('aria-current', 'page');
      else nav[n].removeAttribute('aria-current');
    }
    syncForm(tab === 'bands' ? 'band' : tab === 'jams' ? 'jam' : tab === 'gigs' ? 'gig' : tab === 'musicians' ? 'mus' : '');
    applyI18n();
    window.scrollTo(0, 0);
    if (tab === 'home') loadFaces();
    if (tab === 'musicians') loadMusicians();
    if (tab === 'bands') loadBands();
    if (tab === 'jams') loadJams();
    if (tab === 'gigs') loadGigs();
  }
  function syncForm(prefix) {
    if (!prefix) return;
    var q = new URLSearchParams(location.search);
    var inst = $(prefix + 'Inst');
    if (inst) inst.value = q.get('instrument') || '';
    var genre = $(prefix + 'Genre');
    if (genre) genre.value = q.get('genre') || '';
    var city = $(prefix + 'City');
    if (city) city.value = q.get('city') || '';
    var lat = $(prefix + 'Lat');
    if (lat) lat.value = q.get('lat') || '';
    var lng = $(prefix + 'Lng');
    if (lng) lng.value = q.get('lng') || '';
    var radius = $(prefix + 'Radius');
    if (radius && q.get('radius_km')) radius.value = q.get('radius_km');
    if (prefix === 'band') {
      var buttons = document.querySelectorAll('#bandSeg button');
      var want = q.get('bookable') || '';
      for (var i = 0; i < buttons.length; i++) buttons[i].classList.toggle('active', (buttons[i].getAttribute('data-bookable') || '') === want);
    }
    var status = $(prefix + 'Loc');
    if (status) status.textContent = (q.get('lat') && !q.get('city')) ? T('using_location') : '';
  }
  function boardParams(prefix) {
    var p = new URLSearchParams();
    var inst = $(prefix + 'Inst');
    var genre = $(prefix + 'Genre');
    var city = $(prefix + 'City');
    var lat = $(prefix + 'Lat');
    var lng = $(prefix + 'Lng');
    var radius = $(prefix + 'Radius');
    if (inst && inst.value) p.set('instrument', inst.value);
    if (genre && genre.value) p.set('genre', genre.value);
    if (lat && lng && lat.value && lng.value) {
      p.set('lat', lat.value);
      p.set('lng', lng.value);
    } else if (city && city.value.trim()) p.set('city', city.value.trim());
    if (radius && radius.value && (p.has('city') || p.has('lat'))) p.set('radius_km', radius.value);
    if (prefix === 'band') {
      var active = document.querySelector('#bandSeg button.active');
      var book = active ? (active.getAttribute('data-bookable') || '') : '';
      if (book) p.set('bookable', book);
    }
    return p;
  }
  function narrowed(p) {
    return p.has('instrument') || p.has('city') || p.has('lat') || p.has('genre') || p.has('bookable');
  }
  function fetchJson(url) {
    return fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('bad');
      return r.json();
    });
  }
  function note(text) {
    var p = el('p', 'note');
    p.textContent = text;
    return p;
  }
  function emptyCard(hKey, pKey, ctaLabel, href) {
    var card = el('div', 'empty-card');
    var h = el('h2');
    h.textContent = T(hKey);
    var p = el('p');
    p.textContent = T(pKey);
    card.append(h, p);
    if (href) {
      var a = el('a', 'primary');
      a.href = href;
      a.textContent = ctaLabel;
      card.append(a);
    } else {
      var b = el('button', 'primary');
      b.type = 'button';
      b.textContent = ctaLabel;
      b.addEventListener('click', function () { openAuth('register'); });
      card.append(b);
    }
    return card;
  }
  function chipsFor(m) {
    var chips = el('div', 'chips');
    var map = { dep: 'lf_dep', jam: 'lf_jam', join_band: 'lf_join', start_band: 'lf_start' };
    var lf = m.looking_for || [];
    for (var i = 0; i < lf.length; i++) if (map[lf[i]]) {
      var c = el('span', 'chip hot');
      c.textContent = T(map[lf[i]]);
      chips.append(c);
    }
    var genres = m.genres || [];
    for (var g = 0; g < genres.length && g < 3; g++) {
      var chip = el('span', 'chip');
      chip.textContent = genreLabel(genres[g]);
      chips.append(chip);
    }
    return chips;
  }
  function musicianCard(m) {
    var card = el('article', 'card person-card');
    var a = el('a', 'person');
    a.href = '/m/' + encodeURIComponent(m.handle || '');
    var av = el('span', 'avatar');
    if (m.photo) {
      var img = document.createElement('img');
      img.src = m.photo;
      img.alt = '';
      av.append(img);
    } else av.textContent = initials(m.display_name);
    var who = el('span', 'who');
    var name = el('strong');
    name.textContent = m.display_name || '';
    var meta = el('span', 'meta');
    var bits = [];
    var inst = (m.instruments || []).map(labelInst).filter(Boolean).join(', ');
    if (inst) bits.push(inst);
    if (m.home_city) bits.push(m.home_city);
    if (m.distance_km != null) bits.push(m.distance_km + ' km');
    meta.textContent = bits.join(' · ');
    who.append(name, meta);
    a.append(av, who);
    card.append(a, chipsFor(m));
    return card;
  }
  function bandCard(b) {
    var card = el('article', 'card');
    if (b.cover) {
      var img = document.createElement('img');
      img.className = 'cover';
      img.src = b.cover;
      img.alt = '';
      card.append(img);
    }
    var h = el('h3');
    var a = document.createElement('a');
    a.href = '/b/' + b.id + '-' + (b.slug || 'band');
    a.textContent = b.name || '';
    h.append(a);
    card.append(h);
    var meta = el('p', 'meta');
    var bits = [];
    if (b.home_city) bits.push(b.home_city);
    if (b.distance_km != null) bits.push(b.distance_km + ' km');
    if (b.fee_from) bits.push(T('from_fee', (b.fee_currency || 'CHF') + ' ' + b.fee_from));
    meta.textContent = bits.join(' · ');
    if (bits.length) card.append(meta);
    if (b.pitch) {
      var pitch = el('p');
      pitch.textContent = b.pitch;
      card.append(pitch);
    }
    var chips = el('div', 'chips');
    (b.genres || []).slice(0, 4).forEach(function (g) {
      var c = el('span', 'chip');
      c.textContent = genreLabel(g);
      chips.append(c);
    });
    if (chips.childNodes.length) card.append(chips);
    var more = el('a', 'more');
    more.href = a.href;
    more.textContent = T('band_page');
    card.append(more);
    return card;
  }
  function gigCard(g) {
    var card = el('article', 'card');
    var h = el('h3');
    h.textContent = labelInst(g.instrument || '');
    card.append(h);
    var meta = el('p', 'meta');
    var bits = [];
    if (g.venue_city) bits.push(g.venue_city);
    if (g.distance_km != null) bits.push(g.distance_km + ' km');
    if (g.gig_date) {
      var d = new Date(String(g.gig_date).slice(0, 10) + 'T12:00:00');
      bits.push(isNaN(d.getTime()) ? g.gig_date : d.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' }));
    }
    if (g.kind === 'practice') bits.push(T('free_jam'));
    else if (g.fee_chf != null) bits.push((g.currency || 'CHF') + ' ' + g.fee_chf);
    meta.textContent = bits.join(' · ');
    card.append(meta);
    if (g.description) {
      var p = el('p');
      p.textContent = String(g.description).slice(0, 180);
      card.append(p);
    }
    return card;
  }
  function paint(box, list, widened, render, emptyH, emptyP, cta, href) {
    box.replaceChildren();
    if (!list.length) {
      box.append(emptyCard(emptyH, emptyP, cta, href));
      return;
    }
    if (widened) box.append(note(T('widened')));
    for (var i = 0; i < list.length; i++) box.append(render(list[i]));
  }
  function loadMusicians() {
    var box = $('musResults');
    box.textContent = T('loading');
    var p = boardParams('mus');
    var narrow = narrowed(p);
    fetchJson('/musicians?' + p.toString()).then(function (data) {
      var list = data.musicians || [];
      if (!list.length && narrow) {
        return fetchJson('/musicians').then(function (all) {
          var more = all.musicians || [];
          paint(box, more, more.length > 0, musicianCard, 'empty_mus_h', 'empty_mus_p', T('create_profile'), '');
        });
      }
      paint(box, list, false, musicianCard, 'empty_mus_h', 'empty_mus_p', T('create_profile'), '');
    }).catch(function () { box.textContent = T('load_error'); });
  }
  function loadBands() {
    var box = $('bandResults');
    box.textContent = T('loading');
    var p = boardParams('band');
    p.set('kind', 'band');
    var narrow = narrowed(p);
    fetchJson('/bands?' + p.toString()).then(function (data) {
      var list = data.bands || [];
      if (!list.length && narrow) {
        var wide = new URLSearchParams();
        wide.set('kind', 'band');
        if (p.get('bookable')) wide.set('bookable', p.get('bookable'));
        return fetchJson('/bands?' + wide.toString()).then(function (all) {
          var more = all.bands || [];
          paint(box, more, more.length > 0, bandCard, 'empty_bands_h', 'empty_bands_p', T('list_band'), '/bands');
        });
      }
      paint(box, list, false, bandCard, 'empty_bands_h', 'empty_bands_p', T('list_band'), '/bands');
    }).catch(function () { box.textContent = T('load_error'); });
  }
  function loadGigs() {
    var box = $('gigResults');
    box.textContent = T('loading');
    var p = boardParams('gig');
    p.set('kind', 'gig');
    var narrow = narrowed(p);
    fetchJson('/gigs?' + p.toString()).then(function (data) {
      var list = data.gigs || [];
      if (!list.length && narrow) {
        return fetchJson('/gigs?kind=gig').then(function (all) {
          var more = all.gigs || [];
          paint(box, more, more.length > 0, gigCard, 'empty_gigs_h', 'empty_gigs_p', T('post_gig'), '/post');
        });
      }
      paint(box, list, false, gigCard, 'empty_gigs_h', 'empty_gigs_p', T('post_gig'), '/post');
    }).catch(function () { box.textContent = T('load_error'); });
  }
  function loadJams() {
    var box = $('jamResults');
    box.textContent = T('loading');
    var p = boardParams('jam');
    var g = new URLSearchParams(p);
    g.set('kind', 'practice');
    var groups = new URLSearchParams();
    groups.set('kind', 'jam');
    if (p.get('city')) groups.set('city', p.get('city'));
    if (p.get('lat')) { groups.set('lat', p.get('lat')); groups.set('lng', p.get('lng')); }
    if (p.get('radius_km') && (groups.has('city') || groups.has('lat'))) groups.set('radius_km', p.get('radius_km'));
    var narrow = narrowed(p);
    Promise.all([fetchJson('/gigs?' + g.toString()), fetchJson('/bands?' + groups.toString())]).then(function (pair) {
      var gigList = pair[0].gigs || [];
      var groupList = pair[1].bands || [];
      if (!gigList.length && !groupList.length && narrow) {
        return Promise.all([fetchJson('/gigs?kind=practice'), fetchJson('/bands?kind=jam')]).then(function (wide) {
          renderJams(box, wide[0].gigs || [], wide[1].bands || [], true);
        });
      }
      renderJams(box, gigList, groupList, false);
    }).catch(function () { box.textContent = T('load_error'); });
  }
  function renderJams(box, gigList, groupList, widenedFlag) {
    box.replaceChildren();
    if (!gigList.length && !groupList.length) {
      box.append(emptyCard('empty_jams_h', 'empty_jams_p', T('post_jam'), '/jams'));
      return;
    }
    if (widenedFlag) box.append(note(T('widened')));
    for (var i = 0; i < gigList.length; i++) box.append(gigCard(gigList[i]));
    if (groupList.length) {
      var h = el('h3', 'subhead');
      h.textContent = T('jam_groups');
      box.append(h);
      for (var j = 0; j < groupList.length; j++) box.append(bandCard(groupList[j]));
    }
  }

  function faceCard(m) {
    var a = el('a', 'face');
    a.href = '/m/' + encodeURIComponent(m.handle || '');
    var av = el('span', 'avatar');
    if (m.photo) {
      var img = document.createElement('img');
      img.src = m.photo;
      img.alt = '';
      av.append(img);
    } else av.textContent = m.initials || initials(m.name);
    var who = el('span', 'who');
    var name = el('strong');
    name.textContent = m.name || '';
    var meta = el('span', 'meta');
    var inst = (m.instruments || []).map(labelInst).filter(Boolean).join(', ');
    meta.textContent = [inst, m.city || ''].filter(Boolean).join(' · ');
    who.append(name, meta);
    a.append(av, who);
    return a;
  }
  function renderFaces(list) {
    lastFaces = list || [];
    var section = $('faces');
    var row = $('faceRow');
    var sound = $('soundBlock');
    if (!section || !row || !sound) return;
    row.replaceChildren();
    sound.replaceChildren();
    if (!lastFaces.length) { section.hidden = true; return; }
    section.hidden = false;
    for (var i = 0; i < lastFaces.length; i++) row.append(faceCard(lastFaces[i]));
    var played = 0;
    for (var j = 0; j < lastFaces.length && played < 2; j++) {
      var m = lastFaces[j];
      if (!m.demo) continue;
      var block = el('div', 'sound');
      var cap = el('p', 'sound-cap');
      cap.textContent = T('listen') + ' — ' + (m.name || '') + (m.city ? ' · ' + m.city : '');
      block.append(cap);
      var embed = safeEmbed(m.demo.embed);
      if (embed) {
        var frame = document.createElement('iframe');
        frame.src = embed;
        frame.title = m.demo.host || 'demo';
        frame.loading = 'lazy';
        frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        if (m.demo.kind === 'youtube' || m.demo.kind === 'vimeo') frame.allowFullscreen = true;
        else if (m.demo.height) frame.height = String(m.demo.height);
        var holder = el('div', (m.demo.kind === 'youtube' || m.demo.kind === 'vimeo') ? 'media video' : 'media');
        holder.append(frame);
        block.append(holder);
      } else if (m.demo.url && /^https?:\\/\\//i.test(m.demo.url)) {
        var link = el('a', 'more');
        link.href = m.demo.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer nofollow';
        link.textContent = m.demo.host || m.demo.url;
        block.append(link);
      }
      sound.append(block);
      played++;
    }
    if (!played) {
      var p = el('p', 'muted demo-missing');
      p.textContent = T('no_demo');
      sound.append(p);
    }
  }
  function loadFaces() {
    fetchJson('/v2/api/spotlight').then(function (data) {
      renderFaces((data && data.musicians) || []);
    }).catch(function () {});
  }

  function attachPlaces(input, latEl, lngEl) {
    var box = el('div', 'suggest');
    box.hidden = true;
    input.parentNode.append(box);
    var timer = null;
    input.addEventListener('input', function () {
      latEl.value = '';
      lngEl.value = '';
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { box.hidden = true; box.replaceChildren(); return; }
      timer = setTimeout(function () {
        fetchJson('/places?q=' + encodeURIComponent(q)).then(function (data) {
          box.replaceChildren();
          var places = data.places || [];
          for (var i = 0; i < places.length; i++) {
            (function (p) {
              var b = el('button', 'sug');
              b.type = 'button';
              b.textContent = p.name + (p.region ? ' · ' + p.region : '');
              b.addEventListener('click', function () {
                input.value = p.name;
                latEl.value = String(p.lat);
                lngEl.value = String(p.lng);
                box.hidden = true;
              });
              box.append(b);
            })(places[i]);
          }
          box.hidden = box.childNodes.length === 0;
        }).catch(function () { box.hidden = true; });
      }, 180);
    });
    document.addEventListener('click', function (e) {
      if (e.target !== input && !box.contains(e.target)) box.hidden = true;
    });
  }
  function bindNear(btn, cityEl, latEl, lngEl, statusEl, after) {
    btn.addEventListener('click', function () {
      if (!navigator.geolocation) { statusEl.textContent = T('near_unsupported'); return; }
      statusEl.textContent = T('loading');
      navigator.geolocation.getCurrentPosition(function (pos) {
        latEl.value = String(pos.coords.latitude);
        lngEl.value = String(pos.coords.longitude);
        cityEl.value = '';
        statusEl.textContent = T('using_location');
        if (after) after();
      }, function () { statusEl.textContent = T('near_denied'); }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
    });
  }
  function submitBoard(tab, prefix) {
    var p = boardParams(prefix);
    var url = new URL(PATHS[tab], location.origin);
    p.forEach(function (v, k) { if (v) url.searchParams.set(k, v); });
    history.pushState({ tab: tab }, '', url);
    show(tab);
  }

  function renderAuth() {
    $('authTitle').textContent = authMode === 'register' ? T('auth_reg_h') : T('auth_login_h');
    $('nameRow').hidden = authMode !== 'register';
    $('termsRow').hidden = authMode !== 'register';
    $('tsRow').hidden = authMode !== 'register';
    $('authForgot').hidden = authMode === 'register';
    $('authSwitch').textContent = authMode === 'register' ? T('have_account') : T('need_account');
    $('authSubmit').textContent = authMode === 'register' ? T('create_profile') : T('login');
    $('authMsg').textContent = '';
    $('authMsg').className = 'msg';
  }
  function openAuth(mode) {
    authMode = mode === 'register' ? 'register' : 'login';
    renderAuth();
    var dlg = $('authDialog');
    if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
    if (authMode === 'register' && window.turnstile && tsWidget == null && $('tsBox')) {
      tsWidget = window.turnstile.render('#tsBox', { sitekey: boot.turnstile });
    }
  }
  function refreshMe() {
    fetch('/auth/me', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (data) {
      me = data && data.email ? data : null;
      var extras = $('memberExtras');
      if (extras) extras.hidden = !me;
      applyI18n();
    }).catch(function () {});
  }
  function openA2hs() {
    var nativeBtn = $('a2hsInstall');
    if (nativeBtn) nativeBtn.hidden = !installEvent;
    var dlg = $('a2hsDialog');
    if (dlg && typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
  }

  var qLang = new URLSearchParams(location.search).get('lang');
  if (qLang && COPY[qLang]) {
    lang = qLang;
    document.cookie = 'jw-v2-lang=' + qLang + ';path=/;max-age=31536000;samesite=lax';
  }

  document.querySelectorAll('#langs button').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
  });
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { go(b.getAttribute('data-go'), null); });
  });
  var logo = $('logoHome');
  if (logo) logo.addEventListener('click', function (e) { e.preventDefault(); go('home', null); });
  var footHow = $('footHow');
  if (footHow) footHow.addEventListener('click', function (e) {
    e.preventDefault();
    var jump = function () {
      var how = $('how');
      if (how) how.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (currentTab !== 'home') { go('home', null); setTimeout(jump, 60); }
    else jump();
  });

  var hero = $('heroSearch');
  if (hero) hero.addEventListener('submit', function (e) {
    e.preventDefault();
    var p = new URLSearchParams();
    if ($('hInst').value) p.set('instrument', $('hInst').value);
    if ($('hLat').value && $('hLng').value) { p.set('lat', $('hLat').value); p.set('lng', $('hLng').value); }
    else if ($('hCity').value.trim()) p.set('city', $('hCity').value.trim());
    if ($('hRadius').value && (p.has('city') || p.has('lat'))) p.set('radius_km', $('hRadius').value);
    go('musicians', p);
  });
  $('musForm').addEventListener('submit', function (e) { e.preventDefault(); submitBoard('musicians', 'mus'); });
  $('bandForm').addEventListener('submit', function (e) { e.preventDefault(); submitBoard('bands', 'band'); });
  $('jamForm').addEventListener('submit', function (e) { e.preventDefault(); submitBoard('jams', 'jam'); });
  $('gigForm').addEventListener('submit', function (e) { e.preventDefault(); submitBoard('gigs', 'gig'); });
  document.querySelectorAll('#bandSeg button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#bandSeg button').forEach(function (x) { x.classList.toggle('active', x === b); });
      submitBoard('bands', 'band');
    });
  });

  attachPlaces($('hCity'), $('hLat'), $('hLng'));
  attachPlaces($('musCity'), $('musLat'), $('musLng'));
  attachPlaces($('bandCity'), $('bandLat'), $('bandLng'));
  attachPlaces($('jamCity'), $('jamLat'), $('jamLng'));
  attachPlaces($('gigCity'), $('gigLat'), $('gigLng'));
  bindNear($('hNear'), $('hCity'), $('hLat'), $('hLng'), $('hLoc'), null);
  bindNear($('musNear'), $('musCity'), $('musLat'), $('musLng'), $('musLoc'), function () { submitBoard('musicians', 'mus'); });
  bindNear($('bandNear'), $('bandCity'), $('bandLat'), $('bandLng'), $('bandLoc'), function () { submitBoard('bands', 'band'); });
  bindNear($('jamNear'), $('jamCity'), $('jamLat'), $('jamLng'), $('jamLoc'), function () { submitBoard('jams', 'jam'); });
  bindNear($('gigNear'), $('gigCity'), $('gigLat'), $('gigLng'), $('gigLoc'), function () { submitBoard('gigs', 'gig'); });

  $('heroJoin').addEventListener('click', function () { openAuth('register'); });
  var musJoin = $('musJoin');
  if (musJoin) musJoin.addEventListener('click', function () { openAuth('register'); });
  $('authBtn').addEventListener('click', function () {
    if (me) { fetch('/auth/logout', { method: 'POST' }).then(function () { location.reload(); }); return; }
    openAuth('login');
  });
  $('authSwitch').addEventListener('click', function () { authMode = authMode === 'register' ? 'login' : 'register'; renderAuth(); });
  $('authClose').addEventListener('click', function () { $('authDialog').close(); });
  $('authForgot').addEventListener('click', function () {
    var email = $('aEmail').value;
    fetch('/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email: email }) })
      .then(function () { $('authMsg').className = 'msg ok'; $('authMsg').textContent = T('forgot_sent'); });
  });
  $('authForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('authMsg');
    if (authMode === 'register' && !$('aTerms').checked) {
      msg.className = 'msg err';
      msg.textContent = T('terms_needed');
      return;
    }
    var body = { email: $('aEmail').value, password: $('aPassword').value, lang: lang };
    var path = '/auth/login';
    if (authMode === 'register') {
      path = '/auth/register';
      body.display_name = $('aName').value;
      body.accept_terms = true;
      body.turnstile_token = (tsWidget != null && window.turnstile) ? (window.turnstile.getResponse(tsWidget) || '') : '';
    }
    fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (!res.ok) {
          msg.className = 'msg err';
          msg.textContent = res.data.error || T('load_error');
          if (tsWidget != null && window.turnstile) window.turnstile.reset(tsWidget);
          return;
        }
        $('authDialog').close();
        me = { ok: true };
        $('memberExtras').hidden = false;
        applyI18n();
        if (authMode === 'register') {
          var flash = $('flash');
          flash.hidden = false;
          flash.className = 'flash ok';
          flash.textContent = T('welcome');
        }
      }).catch(function () { msg.className = 'msg err'; msg.textContent = T('load_error'); });
  });

  $('inviteBtn').addEventListener('click', function () {
    var text = T('invite_text') + ' https://jamwerk.app';
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  });
  $('a2hsBtn').addEventListener('click', openA2hs);
  $('alertsBtn').addEventListener('click', function () {
    var canPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!canPush) { openA2hs(); return; }
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg) { openA2hs(); return; }
      return Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') return;
        return fetchJson('/push/vapid').then(function (data) {
          if (!data || !data.key) { openA2hs(); return; }
          var pad = '='.repeat((4 - (data.key.length % 4)) % 4);
          var raw = atob((data.key + pad).replace(/-/g, '+').replace(/_/g, '/'));
          var bytes = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }).then(function (sub) {
            return fetch('/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(sub.toJSON()) });
          });
        });
      });
    }).catch(function () { openA2hs(); });
  });
  $('a2hsClose').addEventListener('click', function () { $('a2hsDialog').close(); });
  $('a2hsInstall').addEventListener('click', function () {
    if (!installEvent) return;
    installEvent.prompt();
    installEvent = null;
    $('a2hsInstall').hidden = true;
  });
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
  });
  window.addEventListener('popstate', function () { show(tabFromLocation()); });

  applyI18n();
  refreshMe();
  show(tabFromLocation());
})();
`;
