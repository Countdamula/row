// =============================================================
// palaestra-music.js — the music dock for The Palaestra.
//
// Reads THE VAULT's own Music & Playlists shelf, `vault:media:
// playlists`, straight out of localStorage. Read-only: this file
// never writes a `vault:` key and never calls The Vault's sync, so
// no second Supabase Realtime subscription is opened for a
// collection this page does not own. It reflects whatever has
// already synced to this device, plus a live `storage` listener so
// an edit made in The Vault in another tab shows up here without a
// reload. Same precedent as fitnessstudio.html's own music panel
// (which points at the older `enthub:playlists`), and as
// tasks-data.js's importers.
//
// WHAT IS NEW HERE: a music button on the side of every exercise and
// every workout. A button carries a SCOPE (which exercise or
// template it belongs to) and, if that record has one, a PINNED
// track id. Clicking it opens the dock and starts the pinned track
// straight away; with nothing pinned it opens filtered and waits.
// Pinning a track fires a `pal:music:pin` event carrying { scope,
// trackId } — this file does not know what an exercise is, and the
// page does not know what a track is.
//
// USAGE
//   PalMusic.init();                       once, after DOM ready
//   PalMusic.button({ scope, trackId })    returns button HTML
//   PalMusic.open({ scope, trackId, label })
//   document.addEventListener('pal:music:pin', e => …)  { scope, trackId }
//
// Any element carrying data-pal-music="<scope>" is handled by one
// delegated listener, so re-rendered rows never need re-binding.
//
// A button that also carries data-pal-music-toggle is a GLOBAL opener
// rather than a row's own — the music button beside quick-add on both
// pages. It closes the dock if the dock is already open, and it tracks
// aria-expanded. A row's button never closes: clicking one exercise's
// music while another's is showing should switch to it, not shut.
// =============================================================

(function (global) {
  'use strict';

  var VAULT_KEY = 'vault:media:playlists';
  var STATE_KEY = 'pal:musicstate';     // last category + volume; `pal:`, so it syncs with the rest
  var IS_FILE = global.location.protocol === 'file:';

  var dock = null;
  var items = [];
  var queue = [];
  var index = -1;
  var filter = 'All';
  var scope = '';
  var pinnedInScope = '';
  var ytPlayer = null, ytLoading = false;
  var volume = 70;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------
  // DATA — read The Vault, never write it.
  // ------------------------------------------------------------
  function load() {
    try {
      var raw = localStorage.getItem(VAULT_KEY);
      var list = raw == null ? [] : JSON.parse(raw);
      items = Array.isArray(list) ? list.filter(function (x) { return x && x.url; }) : [];
    } catch (e) { items = []; }
    items.sort(function (a, b) {
      return (a.order == null ? 9e9 : a.order) - (b.order == null ? 9e9 : b.order);
    });
  }
  // The chips are the categories actually present on the records, not
  // a hard-coded list — so a category added in The Vault appears here.
  function categories() {
    var seen = {}, out = [];
    items.forEach(function (it) {
      var c = String(it.category || '').trim();
      if (c && !seen[c]) { seen[c] = 1; out.push(c); }
    });
    out.sort();
    return out;
  }
  function visible() {
    if (filter === 'All') return items;
    if (filter === '★') return items.filter(function (it) { return it.favorite; });
    return items.filter(function (it) { return it.category === filter; });
  }
  function byId(id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }

  function readState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeState(patch) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(Object.assign(readState(), patch))); }
    catch (e) {}
  }

  // ------------------------------------------------------------
  // SOURCES
  // ------------------------------------------------------------
  function sourceOf(url) {
    var u = String(url || '');
    if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
    if (/open\.spotify\.com/.test(u)) return 'spotify';
    if (/soundcloud\.com/.test(u)) return 'soundcloud';
    return 'other';
  }
  function youTubeId(url) {
    try {
      var u = new URL(url);
      if (u.hostname.indexOf('youtu.be') !== -1) return u.pathname.slice(1).split('/')[0] || null;
      if (u.hostname.indexOf('youtube.com') !== -1) {
        if (u.pathname === '/watch') return u.searchParams.get('v');
        var m = u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/);
        if (m) return m[2];
      }
    } catch (e) {}
    return null;
  }
  function spotifyEmbed(url) {
    try {
      var u = new URL(url);
      return 'https://open.spotify.com/embed' + u.pathname;
    } catch (e) { return ''; }
  }

  // The YouTube IFrame API verifies the page's real origin over
  // postMessage. Under file:// there isn't one — Chrome reports it as
  // the literal string "null" — so the handshake fails and the player
  // shows a configuration error. That is not a broken link; it is
  // specific to opening the file directly instead of through a real
  // http(s) origin. Under file:// fall back to a plain embed iframe,
  // which plays fine, just without in-dock play/pause and volume.
  function ensureYtApi(cb) {
    if (global.YT && global.YT.Player) { cb(); return; }
    var prev = global.onYouTubeIframeAPIReady;
    global.onYouTubeIframeAPIReady = function () {
      if (typeof prev === 'function') prev();
      cb();
    };
    if (ytLoading) return;
    ytLoading = true;
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  // ------------------------------------------------------------
  // DOCK
  // ------------------------------------------------------------
  function build() {
    if (dock) return dock;
    dock = document.createElement('aside');
    dock.className = 'pal-music';
    dock.id = 'palMusic';
    dock.setAttribute('aria-label', 'Music');
    dock.setAttribute('aria-hidden', 'true');
    dock.innerHTML =
      '<div class="pal-music__head">' +
        '<div>' +
          '<div class="pal-eyebrow" style="margin:0">From The Vault</div>' +
          '<div class="pal-h3" id="palMusicScope">Music</div>' +
        '</div>' +
        '<button class="pal-btn pal-btn--icon pal-btn--ghost" id="palMusicClose" aria-label="Close music">✕</button>' +
      '</div>' +
      '<div class="pal-music__chips" id="palMusicChips"></div>' +
      '<div class="pal-music__list" id="palMusicList"></div>' +
      '<div class="pal-music__player">' +
        '<div class="pal-music__now">' +
          '<div class="pal-track__cover" id="palMusicCover">♪</div>' +
          '<div class="pal-track__main">' +
            '<div class="pal-track__title" id="palMusicTitle">Nothing playing</div>' +
            '<div class="pal-track__sub" id="palMusicSub">Pick a track below</div>' +
          '</div>' +
        '</div>' +
        '<div class="pal-music__stage" id="palMusicStage"></div>' +
        '<a class="pal-btn pal-btn--sm" id="palMusicOut" href="#" target="_blank" rel="noopener" hidden>↗ Open track</a>' +
        '<div class="pal-music__controls">' +
          '<button class="pal-music__ctrl" id="palMusicPrev" aria-label="Previous track">⏮</button>' +
          '<button class="pal-music__ctrl pal-music__ctrl--play" id="palMusicPlay" aria-label="Play or pause">▶</button>' +
          '<button class="pal-music__ctrl" id="palMusicNext" aria-label="Next track">⏭</button>' +
        '</div>' +
        '<input class="pal-music__vol" id="palMusicVol" type="range" min="0" max="100" value="70" aria-label="Volume">' +
      '</div>';
    document.body.appendChild(dock);

    $('palMusicClose').addEventListener('click', close);
    $('palMusicPrev').addEventListener('click', function () { step(-1); });
    $('palMusicNext').addEventListener('click', function () { step(1); });
    $('palMusicPlay').addEventListener('click', toggle);
    $('palMusicVol').addEventListener('input', function () {
      volume = parseInt(this.value, 10) || 0;
      writeState({ volume: volume });
      if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(volume);
    });
    $('palMusicChips').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-cat]');
      if (!chip) return;
      filter = chip.getAttribute('data-cat');
      writeState({ category: filter });
      renderChips(); renderList();
    });
    $('palMusicList').addEventListener('click', function (e) {
      var pin = e.target.closest('[data-pin]');
      if (pin) {
        e.stopPropagation();
        pinTrack(pin.getAttribute('data-pin'));
        return;
      }
      var row = e.target.closest('[data-play]');
      if (!row) return;
      queue = visible();
      index = queue.findIndex(function (x) { return x.id === row.getAttribute('data-play'); });
      play(queue[index]);
    });

    // Escape closes, but only when the dock has focus or is open and
    // nothing is being typed into.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !dock.classList.contains('is-open')) return;
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      close();
    });
    return dock;
  }

  function renderChips() {
    var cats = ['All'].concat(items.some(function (i) { return i.favorite; }) ? ['★'] : []).concat(categories());
    $('palMusicChips').innerHTML = cats.map(function (c) {
      return '<button class="pal-chip" data-cat="' + esc(c) + '" aria-pressed="' +
             (filter === c ? 'true' : 'false') + '">' + esc(c) + '</button>';
    }).join('');
  }

  function renderList() {
    var list = $('palMusicList');
    var rows = visible();
    if (!items.length) {
      list.innerHTML =
        '<div class="pal-music__empty">Nothing on The Vault\'s Music &amp; Playlists shelf has synced to this device yet.' +
        '<br><a class="pal-btn pal-btn--sm" style="margin-top:12px" href="vault.html#playlists">Open The Vault →</a></div>';
      return;
    }
    if (!rows.length) {
      list.innerHTML = '<div class="pal-music__empty">No tracks in ' + esc(filter) + '.</div>';
      return;
    }
    var current = index >= 0 && queue[index] ? queue[index].id : '';
    list.innerHTML = rows.map(function (it) {
      var pinned = pinnedInScope && pinnedInScope === it.id;
      return '' +
        '<button class="pal-track" data-play="' + esc(it.id) + '" aria-current="' + (current === it.id ? 'true' : 'false') + '">' +
          '<span class="pal-track__cover">' + (it.cover ? '<img src="' + esc(it.cover) + '" alt="">' : '♪') + '</span>' +
          '<span class="pal-track__main">' +
            '<span class="pal-track__title">' + esc(it.title || 'Untitled') + '</span>' +
            '<span class="pal-track__sub">' + esc(it.creator || it.category || '') + '</span>' +
          '</span>' +
          (scope
            ? '<span class="pal-track__pin" role="button" tabindex="-1" data-pin="' + esc(it.id) + '" data-pinned="' +
              (pinned ? 'true' : 'false') + '" title="' + (pinned ? 'Unpin from this exercise' : 'Pin to this exercise') + '">' +
              (pinned ? '★' : '☆') + '</span>'
            : '') +
        '</button>';
    }).join('');
  }

  // ------------------------------------------------------------
  // PLAYBACK
  // ------------------------------------------------------------
  function play(item) {
    if (!item) return;
    var stage = $('palMusicStage');
    var out = $('palMusicOut');
    $('palMusicTitle').textContent = item.title || 'Untitled';
    $('palMusicSub').textContent = item.creator || item.category || '';
    $('palMusicCover').innerHTML = item.cover ? '<img src="' + esc(item.cover) + '" alt="">' : '♪';
    out.hidden = true;
    ytPlayer = null;
    stage.innerHTML = '';

    var src = sourceOf(item.url);
    if (src === 'youtube') {
      var vid = youTubeId(item.url);
      if (!vid) { fallback(item); return; }
      if (IS_FILE) {
        stage.innerHTML = '<iframe src="https://www.youtube.com/embed/' + esc(vid) +
          '?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen title="' +
          esc(item.title || 'Track') + '"></iframe>';
        $('palMusicPlay').textContent = '▶';
      } else {
        var host = document.createElement('div');
        stage.appendChild(host);
        ensureYtApi(function () {
          try {
            ytPlayer = new global.YT.Player(host, {
              height: '180', width: '100%', videoId: vid,
              playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
              events: {
                onReady: function (e) { e.target.setVolume(volume); e.target.playVideo(); },
                onStateChange: function (e) {
                  $('palMusicPlay').textContent = e.data === 1 ? '⏸' : '▶';
                  if (e.data === 0) step(1);          // ended → next
                }
              }
            });
          } catch (err) { fallback(item); }
        });
      }
    } else if (src === 'spotify') {
      var emb = spotifyEmbed(item.url);
      if (!emb) { fallback(item); return; }
      stage.innerHTML = '<iframe src="' + esc(emb) + '" allow="encrypted-media" title="' +
        esc(item.title || 'Track') + '"></iframe>';
      $('palMusicPlay').textContent = '▶';
    } else {
      fallback(item);
    }
    renderList();
  }
  function fallback(item) {
    var out = $('palMusicOut');
    out.href = item.url || '#';
    out.hidden = false;
    $('palMusicPlay').textContent = '▶';
  }
  function step(dir) {
    if (!queue.length) { queue = visible(); index = -1; }
    if (!queue.length) return;
    index = (index + dir + queue.length) % queue.length;
    play(queue[index]);
  }
  function toggle() {
    if (!ytPlayer) {
      if (index < 0) { queue = visible(); index = 0; play(queue[0]); }
      return;
    }
    try {
      var st = ytPlayer.getPlayerState ? ytPlayer.getPlayerState() : -1;
      if (st === 1) { ytPlayer.pauseVideo(); $('palMusicPlay').textContent = '▶'; }
      else { ytPlayer.playVideo(); $('palMusicPlay').textContent = '⏸'; }
    } catch (e) {}
  }

  // ------------------------------------------------------------
  // PINNING — this file does not know what an exercise is. It reports
  // the scope string it was handed back to the page, which owns the
  // record and does the writing.
  // ------------------------------------------------------------
  function pinTrack(trackId) {
    if (!scope) return;
    var next = pinnedInScope === trackId ? '' : trackId;
    pinnedInScope = next;
    try {
      document.dispatchEvent(new CustomEvent('pal:music:pin', {
        detail: { scope: scope, trackId: next }
      }));
    } catch (e) {}
    renderList();
  }

  // ------------------------------------------------------------
  // OPEN / CLOSE
  // ------------------------------------------------------------
  function open(opts) {
    opts = opts || {};
    build();
    load();
    var st = readState();
    volume = typeof st.volume === 'number' ? st.volume : 70;
    $('palMusicVol').value = volume;

    scope = opts.scope || '';
    pinnedInScope = opts.trackId || '';
    $('palMusicScope').textContent = opts.label || 'Music';

    // A category was asked for, or the last one used, or everything.
    if (opts.category && (opts.category === 'All' || categories().indexOf(opts.category) !== -1)) {
      filter = opts.category;
    } else if (st.category && (st.category === 'All' || st.category === '★' || categories().indexOf(st.category) !== -1)) {
      filter = st.category;
    } else {
      filter = 'All';
    }

    renderChips();
    renderList();
    dock.classList.add('is-open');
    dock.setAttribute('aria-hidden', 'false');
    syncToggles();

    // A pinned track starts straight away — the whole point of pinning
    // it to a lift is not having to go looking for it mid-set.
    if (opts.trackId && opts.play !== false) {
      var it = byId(opts.trackId);
      if (it) {
        queue = visible();
        index = queue.findIndex(function (x) { return x.id === it.id; });
        if (index < 0) { queue = items; index = queue.findIndex(function (x) { return x.id === it.id; }); }
        play(it);
      }
    }
  }
  function close() {
    if (!dock) return;
    dock.classList.remove('is-open');
    dock.setAttribute('aria-hidden', 'true');
    syncToggles();
    // Playback deliberately continues. Closing the dock during a set is
    // how you get the screen back, not how you stop the music.
  }
  function isOpen() { return !!(dock && dock.classList.contains('is-open')); }

  // The global openers are the only buttons that claim to be expandable,
  // so they are the only ones whose state has to be kept honest.
  function syncToggles() {
    var open = isOpen() ? 'true' : 'false';
    var all = document.querySelectorAll('[data-pal-music-toggle]');
    for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-expanded', open);
  }

  // ------------------------------------------------------------
  // BUTTONS — one delegated listener, so re-rendered rows never need
  // re-binding.
  // ------------------------------------------------------------
  function button(opts) {
    opts = opts || {};
    var pinned = opts.trackId ? 'true' : 'false';
    return '<button type="button" class="pal-musicbtn" ' +
      'data-pal-music="' + esc(opts.scope || '') + '" ' +
      'data-pal-track="' + esc(opts.trackId || '') + '" ' +
      'data-pal-label="' + esc(opts.label || '') + '" ' +
      'data-pinned="' + pinned + '" ' +
      'title="' + (opts.trackId ? 'Play the pinned track' : 'Pick music for this') + '" ' +
      'aria-label="Music for ' + esc(opts.label || 'this') + '">♪</button>';
  }

  function init() {
    build();
    load();
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-pal-music]');
      if (!btn) return;
      e.preventDefault();
      if (btn.hasAttribute('data-pal-music-toggle') && isOpen()) { close(); return; }
      open({
        scope: btn.getAttribute('data-pal-music'),
        trackId: btn.getAttribute('data-pal-track') || '',
        label: btn.getAttribute('data-pal-label') || '',
        category: btn.getAttribute('data-pal-category') || ''
      });
    });
    // The Vault edited in another tab, or a cloud pull landing.
    global.addEventListener('storage', function (e) {
      if (e.key && e.key !== VAULT_KEY) return;
      load();
      if (isOpen()) { renderChips(); renderList(); }
    });
  }

  global.PalMusic = {
    init: init, open: open, close: close, isOpen: isOpen,
    button: button, reload: load, sourceOf: sourceOf,
    trackById: byId, count: function () { return items.length; }
  };
})(window);
