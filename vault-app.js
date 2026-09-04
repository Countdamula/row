// =============================================================
// vault-app.js — HOUSE DAMULA's router and behaviour.
//
//   window.HDApp
//
// vault-views.js builds strings. vault-game.js builds the game
// page. vault-data.js decides what is true. This file is the only
// one that listens, writes, or knows what a hash means.
//
// ONE DELEGATED HANDLER, FIVE HOSTS. Every clickable thing in
// every painted region carries data-act, so nothing has to be
// re-bound when a region is repainted — which is the only reason
// four hundred cards can be rebuilt on a keystroke at all.
//
// The hosts are named, never `document`: topbar.js, trash.js,
// save-state.js and shrink-banner.js all inject chrome of their
// own into this page, and a document-wide handler that calls
// preventDefault on anything carrying a data-act is a trap laid
// for whichever of them adopts the attribute next.
// =============================================================

(function (global) {
  'use strict';

  var U = function () { return global.AscUI; };
  var H = function () { return global.HD; };
  var G = function () { return global.HDGame; };
  var esc = function (s) { return U().esc(s); };
  var attr = function (s) { return U().attr(s); };
  var $ = function (id) { return document.getElementById(id); };

  // ── §VIEW STATE ────────────────────────────────────────────
  // Session-only but for the route, which lives in the hash where
  // it also makes a link. Everything under `vault:` is pushed to
  // Supabase, and which shelf a laptop was last left on is not
  // something a phone should be told about.
  var state = {
    route: 'home', shelf: 'all', collection: '', gameId: '',
    q: '', favOnly: false, sort: 'shelf'
  };

  // Journal was removed on 2026-09-03 — the route, this nav item,
  // the mosaic tile that advertised it and every link into it. The
  // ENTRIES are untouched; the game page's fourth column still
  // holds them. `#/journal` now falls through parseHash's default
  // to the house, so an old bookmark still lands somewhere real.
  var NAV = [
    { href: '#/archive', label: 'Archive', match: ['archive', 'collection'] },
    { href: '#/collections', label: 'Collections', match: ['collections'] },
    { href: '#/archive/games', label: 'Games', match: ['game'] },
    { href: '#/about', label: 'About', match: ['about'] }
  ];

  // ONE GROUND, as of 2026-09-03: every route is on the neutral
  // warm black the About page was already using. The map is kept
  // rather than deleted because it is the switch — re-grounding a
  // route is a word here plus a class in the view, and the
  // .hd-sepia token block is still defined and waiting.
  //
  // The bar's own colour is driven by SCROLL, not by this: every
  // view begins on a full-bleed photograph.
  var GROUND = {
    home: 'night', archive: 'night', collections: 'night',
    collection: 'night', about: 'night', game: 'night'
  };

  // ── §ROUTING ───────────────────────────────────────────────
  // Legacy hashes have no slash and are answered first, so every
  // bookmark this page has ever handed out still lands somewhere
  // real rather than on an empty view.
  function parseHash() {
    var raw = String(location.hash || '').replace(/^#/, '');
    if (!raw || raw === '/') return { route: 'home' };

    if (raw.charAt(0) !== '/') {
      var k = H().tabKey(raw);
      if (k === 'all') return { route: 'archive', shelf: 'all' };
      if (H().LIVE().some(function (s) { return s.key === k; })) {
        return { route: 'archive', shelf: k };
      }
      return { route: 'archive', shelf: 'all' };
    }

    var p = raw.split('/').filter(Boolean);
    switch (p[0]) {
      case 'archive':
        var sk = p[1] ? H().tabKey(p[1]) : 'all';
        if (sk !== 'all' && !H().LIVE().some(function (s) { return s.key === sk; })) sk = 'all';
        return { route: 'archive', shelf: sk };
      case 'games': return { route: 'archive', shelf: 'games' };
      case 'game': return { route: 'game', gameId: decodeURIComponent(p[1] || '') };
      case 'collections': return { route: 'collections' };
      case 'collection': return { route: 'collection', collection: decodeURIComponent(p[1] || '') };
      case 'about': return { route: 'about' };
      default: return { route: 'home' };
    }
  }

  function applyHash() {
    var r = parseHash();
    state.route = r.route;
    state.shelf = r.shelf || 'all';
    state.collection = r.collection || '';
    state.gameId = r.gameId || '';
  }

  // ── §PAINT ─────────────────────────────────────────────────
  // repaint() is what the data changing calls: it does not scroll
  // and it does not re-arm the entrance. navigate() is what a
  // route change calls, and it does both. Conflating the two is
  // how a phone in another room saving something throws away the
  // place you had scrolled to.
  function html() {
    switch (state.route) {
      case 'archive': return H().viewArchive(state);
      case 'collection': return H().viewArchive(state);
      case 'collections': return H().viewCollections();
      case 'about': return H().viewAbout();
      case 'game': return G().view(state.gameId);
      default: return H().viewHome();
    }
  }

  function repaint() {
    $('vtRoot').innerHTML = html();
    paintChrome();
    // The hero node was just replaced, so the scroll handler is
    // holding a reference to a element that is no longer in the
    // document. Re-find and re-measure it.
    if (HDApp.__readScroll) HDApp.__readScroll();
  }

  function navigate() {
    U().introArrive();
    repaint();
    // Scroll-to-top belongs to NAVIGATION and to nothing else.
    global.scrollTo({ top: 0, behavior: 'auto' });
    if (HDApp.__readScroll) HDApp.__readScroll();
    $('vtRoot').focus({ preventScroll: true });
  }

  function paintChrome() {
    var ground = GROUND[state.route] || 'night';
    document.documentElement.setAttribute('data-ground', ground);

    // The pill puts the wordmark in the MIDDLE of the links, so
    // the nav is painted as two halves either side of it. The
    // brand itself is static markup and is never re-created.
    var link = function (n) {
      var on = n.match.indexOf(state.route) >= 0 ||
        (n.href === '#/archive/games' && state.route === 'archive' && state.shelf === 'games');
      // Archive is the parent of every shelf but Games, which has
      // its own name in the bar. Without this the two light up
      // together and neither means anything.
      if (n.href === '#/archive' && state.route === 'archive' && state.shelf === 'games') on = false;
      return '<a href="' + n.href + '"' + (on ? ' class="is-on" aria-current="page"' : '') + '>' +
        esc(n.label) + '</a>';
    };
    var half = Math.ceil(NAV.length / 2);
    $('hdNavL').innerHTML = NAV.slice(0, half).map(link).join('');
    $('hdNavR').innerHTML = NAV.slice(half).map(link).join('');

    var q = H().allCards().filter(function (d) { return d.queued; }).length;
    var t = $('hdTonight');
    t.hidden = !q;
    t.querySelector('i').textContent = q;
  }

  // ── §THE FORM ──────────────────────────────────────────────
  // One builder behind every small edit on the game page. Ten
  // slightly-different one-field dialogs is ten places for the
  // save path to drift; this is one, and it is why adding a new
  // editable thing costs four lines in vault-game.js.
  var formState = null;

  function form(spec) {
    formState = spec;
    var field = function (f) {
      var id = 'hf_' + f.key;
      var input;
      if (f.type === 'textarea') {
        input = '<textarea class="asc-textarea' + (f.tall ? ' asc-textarea--tall' : '') +
          '" id="' + id + '" data-k="' + attr(f.key) + '" placeholder="' +
          attr(f.placeholder || '') + '">' + esc(f.value || '') + '</textarea>';
      } else {
        input = '<input class="asc-input" id="' + id + '" data-k="' + attr(f.key) + '" type="' +
          (f.type || 'text') + '" value="' + attr(f.value || '') + '" placeholder="' +
          attr(f.placeholder || '') + '" autocomplete="off">';
      }
      return '<div class="vt-f vt-f--wide">' +
        '<label class="asc-label" for="' + id + '">' + esc(f.label) + '</label>' + input +
        (f.hint ? '<p class="vt-hint">' + esc(f.hint) + '</p>' : '') + '</div>';
    };

    U().openSheet(
      '<button type="button" class="asc-back" data-act="sheet-close">' +
        '<span aria-hidden="true">←</span> Back</button>' +
      '<h2 class="hd-plate">' + esc(spec.title) + '</h2>' +
      '<div class="hd-form" id="hdForm">' + spec.fields.map(field).join('') + '</div>' +
      '<div class="asc-sheet__acts">' +
        '<button type="button" class="asc-btn asc-btn--primary" data-act="form-save" data-autofocus>Save</button>' +
        '<button type="button" class="asc-btn asc-btn--quiet" data-act="sheet-close">Cancel</button>' +
        (spec.onDelete
          ? '<button type="button" class="asc-btn asc-btn--danger asc-btn--sm" data-act="form-del">' +
            esc(spec.deleteLabel || 'Delete') + '</button>'
          : '') +
      '</div>', {});

    // Focus the first field, not the Save button: every one of
    // these opens because you intend to type.
    var first = $('hdForm').querySelector('input, textarea');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  }

  function readForm() {
    var out = {};
    var host = $('hdForm');
    if (!host) return out;
    host.querySelectorAll('[data-k]').forEach(function (n) { out[n.dataset.k] = n.value; });
    return out;
  }

  // ── §THE DETAIL SHEET ──────────────────────────────────────
  function openDetail(shelf, id) {
    var r = H().recordOf(shelf, id);
    if (!r) return U().toast('That item is no longer on the shelf');
    var d = H().toCard(r, shelf, H().TAB_OF_SHELF[shelf] || 'watch');
    var t = H().shelfOf(d.tab);
    var pin = H().store('vault:featured', null) || {};
    var isFeat = pin.shelf === shelf && pin.id === id;

    var line = function (l, v) {
      return v ? '<div class="asc-line"><span class="asc-label">' + l + '</span><p>' + v + '</p></div>' : '';
    };
    var when = function (ts) {
      return ts ? new Date(ts).toLocaleDateString(undefined,
        { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    };

    U().openSheet(
      '<button type="button" class="asc-back" data-act="sheet-close">' +
        '<span aria-hidden="true">←</span> Back</button>' +
      '<h2 class="hd-plate">' + esc(d.title) + '</h2>' +
      '<p class="asc-label">' + esc(t.label) + ' · ' + esc(d.cat) + '</p>' +
      (d.cover ? '<img class="hd-sheet__fig" src="' + attr(d.cover) + '" alt="" loading="lazy">' : '') +
      '<div class="asc-sheet__acts">' +
        (d.url ? '<button type="button" class="asc-btn asc-btn--primary" data-act="open" ' +
          'data-shelf="' + attr(shelf) + '" data-id="' + attr(id) + '" data-url="' + attr(d.url) +
          '" data-autofocus>' + t.verb + ' →</button>' : '') +
        (shelf === 'games' ? '<a class="asc-btn" href="#/game/' + attr(id) + '" data-act="sheet-close">' +
          'Open its page</a>' : '') +
        '<button type="button" class="asc-btn" data-act="star" data-shelf="' + attr(shelf) +
          '" data-id="' + attr(id) + '">' + (d.fav ? '★ Starred' : '☆ Star it') + '</button>' +
        '<button type="button" class="asc-btn" data-act="queue" data-shelf="' + attr(shelf) +
          '" data-id="' + attr(id) + '">' + (d.queued ? '✓ In Tonight' : '＋ Tonight') + '</button>' +
        '<button type="button" class="asc-btn" data-act="feature" data-shelf="' + attr(shelf) +
          '" data-id="' + attr(id) + '">' + (isFeat ? '◆ Featured' : '◇ Feature this') + '</button>' +
        '<button type="button" class="asc-btn" data-act="edit" data-shelf="' + attr(shelf) +
          '" data-id="' + attr(id) + '">Edit</button>' +
      '</div>' +
      (d.desc ? '<div class="asc-sheet__block"><h3 class="asc-label">About</h3>' +
        '<p class="asc-body">' + U().escLines(d.desc) + '</p></div>' : '') +
      '<div class="asc-sheet__block"><h3 class="asc-label">Details</h3><div class="asc-lines">' +
        line('Shelf', esc(H().SHELF_NAME[shelf] || shelf)) +
        line('Collection', esc(d.cat)) +
        line('Creator', esc(d.creator)) +
        line('Length', esc(d.len)) +
        line('Rating', d.rating ? '★'.repeat(Math.round(d.rating)) +
          ' <span class="asc-small">' + d.rating.toFixed(1) + '</span>' : '') +
        line('Opened', d.opens ? d.opens + (d.opens === 1 ? ' time' : ' times') +
          (d.opened ? ', last on ' + when(d.opened) : '') : '') +
        line('Added', when(d.made)) +
        line('Link', d.url ? '<a class="asc-linkout" href="' + attr(d.url) +
          '" target="_blank" rel="noopener">' + esc(H().shownUrl(d.url)) + '</a>' : '') +
      '</div></div>' +
      '<div class="asc-sheet__acts">' +
        '<button type="button" class="asc-btn asc-btn--danger asc-btn--sm" data-act="del" ' +
          'data-shelf="' + attr(shelf) + '" data-id="' + attr(id) + '">Delete this item</button>' +
      '</div>', {});
  }

  // ── §ACTIONS ───────────────────────────────────────────────
  // Which record a clicked thing means. Every control carries its
  // own pair, so nothing depends on where in the tree it sits.
  function ref(el) {
    var n = el.dataset.shelf ? el : el.closest('[data-shelf][data-id]');
    return n ? { shelf: n.dataset.shelf, id: n.dataset.id } : null;
  }
  function cssq(s) { return global.CSS && CSS.escape ? CSS.escape(s) : String(s); }

  // WHAT "ADD" MEANS DEPENDS ON WHERE YOU ARE STANDING.
  // On the Games shelf a game is not a link, so the + , the n key
  // and the tile all open the game form rather than the nine-field
  // composer. Everywhere else nothing has changed.
  function addHere() {
    if (state.shelf === 'games' || state.route === 'game') return G().ACTS['add-game']();
    openComposer({});
  }

  var ACTS = {
    add: function () { addHere(); },

    open: function (el) {
      var k = ref(el);
      if (!k) return;
      var r = H().recordOf(k.shelf, k.id);
      if (!r) return U().toast('That item is no longer on the shelf');

      // A game is a PLACE in this app, so opening one is
      // navigation. Everything else is a link out, and opening it
      // is exactly what it has always been.
      if (k.shelf === 'games' && state.route !== 'game') {
        U().closeSheet();
        location.hash = '#/game/' + encodeURIComponent(k.id);
        return;
      }
      if (!r.url) return U().toast('No link on this item');
      // Stamped before navigating — this is what "last opened"
      // reads, and what Sort: last opened is built on.
      global.Vault.touch(k.shelf, k.id);
      global.open(r.url, '_blank', 'noopener');
    },

    info: function (el) { var k = ref(el); if (k) openDetail(k.shelf, k.id); },

    star: function (el) {
      var k = ref(el);
      if (!k) return;
      var r = H().recordOf(k.shelf, k.id);
      if (!r) return U().toast('That item is no longer on the shelf');
      var on = !r.favorite;
      global.Vault.update(k.shelf, k.id, { favorite: on });
      // Patched in place rather than repainted: a full repaint
      // here throws away the reader's scroll position for one
      // character of glyph.
      document.querySelectorAll('[data-act="star"][data-shelf="' + cssq(k.shelf) +
        '"][data-id="' + cssq(k.id) + '"]').forEach(function (s) {
        s.classList.toggle('is-on', on);
        s.setAttribute('aria-pressed', String(on));
        if (s.classList.contains('asc-btn')) s.textContent = on ? '★ Starred' : '☆ Star it';
        else s.textContent = on ? '★' : '☆';
      });
      if (state.favOnly) repaint();
    },

    queue: function (el) {
      var k = ref(el);
      if (!k) return;
      var r = H().recordOf(k.shelf, k.id);
      if (!r) return U().toast('That item is no longer on the shelf');
      var on = !r.queued;
      global.Vault.update(k.shelf, k.id, { queued: on });
      var tick = 'M3.6 8.4 6.5 11.3 12.4 5.2', plus = 'M8 3.6v8.8M3.6 8h8.8';
      document.querySelectorAll('[data-act="queue"][data-shelf="' + cssq(k.shelf) +
        '"][data-id="' + cssq(k.id) + '"]').forEach(function (m) {
        m.classList.toggle('is-on', on);
        m.setAttribute('aria-pressed', String(on));
        if (m.classList.contains('asc-btn')) m.textContent = on ? '✓ In Tonight' : '＋ Tonight';
        var p = m.querySelector('path');
        if (p) p.setAttribute('d', on ? tick : plus);
      });
      paintChrome();
      if (state.route === 'about') repaint();
    },

    feature: function (el) {
      var k = ref(el);
      if (!k) return;
      var pin = H().store('vault:featured', null) || {};
      var isOn = pin.shelf === k.shelf && pin.id === k.id;
      try {
        if (isOn) localStorage.removeItem('vault:featured');
        else localStorage.setItem('vault:featured', JSON.stringify({ shelf: k.shelf, id: k.id }));
      } catch (e) { return U().toast('Could not save that'); }
      el.textContent = isOn ? '◇ Feature this' : '◆ Featured';
      U().toast(isOn ? 'No longer featured' : 'Featured on the home page');
    },

    edit: function (el) {
      var k = ref(el);
      if (!k) return;
      var r = H().recordOf(k.shelf, k.id);
      if (!r) return U().toast('That item is no longer on the shelf');
      U().closeSheet();
      openComposer({ shelf: k.shelf, item: r });
    },
    'edit-record': function () {
      var r = H().recordOf('games', state.gameId);
      if (r) openComposer({ shelf: 'games', item: r });
    },

    del: function (el) {
      var k = ref(el);
      if (!k) return;
      var r = H().recordOf(k.shelf, k.id);
      if (!r) return U().toast('That item is no longer on the shelf');
      if (!confirm('Delete “' + (r.title || 'this item') + '” from ' +
        (H().SHELF_NAME[k.shelf] || k.shelf) + '?\n\nThis cannot be undone.')) return;
      global.Vault.remove(k.shelf, r.id);
      U().closeSheet();
      U().toast('Deleted');
      if (state.route === 'game' && state.gameId === k.id) location.hash = '#/archive/games';
      else repaint();
    },

    favonly: function () { state.favOnly = !state.favOnly; repaint(); },
    'clear-q': function () { state.q = ''; repaint(); },
    sort: function (el) { state.sort = el.value; repaint(); },

    surprise: function () {
      var all = H().allCards();
      if (!all.length) return U().toast('Nothing on the shelves yet');
      var d = all[Math.floor(Math.random() * all.length)];
      openDetail(d.shelf, d.id);
    },

    tonight: function () {
      var q = H().allCards().filter(function (d) { return d.queued; });
      U().openSheet(
        '<button type="button" class="asc-back" data-act="sheet-close">' +
          '<span aria-hidden="true">←</span> Back</button>' +
        '<h2 class="hd-plate">Tonight</h2>' +
        (q.length
          ? '<ul class="hd-queue">' + q.map(function (d) {
              return '<li><button type="button" data-act="open" data-shelf="' + attr(d.shelf) +
                '" data-id="' + attr(d.id) + '" data-url="' + attr(d.url) + '">' +
                esc(d.title) + '</button></li>';
            }).join('') + '</ul>' +
            '<div class="asc-sheet__acts"><button type="button" class="asc-btn asc-btn--sm" ' +
            'data-act="clearqueue">Clear the queue</button></div>'
          : '<p class="asc-body">Nothing queued. The ＋ on any card puts it here.</p>'), {});
    },

    clearqueue: function () {
      var q = H().allCards().filter(function (d) { return d.queued; });
      if (!q.length) return;
      if (!confirm('Take all ' + q.length + ' out of Tonight?')) return;
      q.forEach(function (d) { global.Vault.update(d.shelf, d.id, { queued: false }); });
      U().closeSheet();
      repaint();
    },

    'edit-house': function () {
      var h = H().HOUSE();
      form({
        title: 'This house’s words',
        fields: [
          { key: 'headline', label: 'Hero headline', value: h.headline },
          { key: 'credo', label: 'Credo', value: h.credo,
            hint: 'The two lines on the ivory band. A line break splits it.' },
          { key: 'blurb', label: 'Paragraph', type: 'textarea', value: h.blurb },
          { key: 'words', label: 'Keywords', value: h.words.map(function (r) { return r.join(', '); }).join(' / '),
            hint: 'Commas separate the words, a slash starts a new line.' }
        ],
        onSave: function (v) {
          var words = String(v.words || '').split('/').map(function (row) {
            return row.split(',').map(function (w) { return w.trim(); }).filter(Boolean);
          }).filter(function (row) { return row.length; });
          try {
            localStorage.setItem('vault:house', JSON.stringify({
              headline: v.headline.trim() || H().HOUSE_DEFAULT.headline,
              credo: v.credo.trim() || H().HOUSE_DEFAULT.credo,
              blurb: v.blurb.trim() || H().HOUSE_DEFAULT.blurb,
              words: words.length ? words : H().HOUSE_DEFAULT.words
            }));
          } catch (e) { return U().toast('Could not save that'); }
        }
      });
    },

    'form-save': function () {
      if (!formState) return;
      var spec = formState, v = readForm();
      var bad = spec.onSave(v);
      if (bad === false) return;
      formState = null;
      U().closeSheet();
      U().toast('Saved');
      repaint();
    },
    'form-del': function () {
      if (!formState || !formState.onDelete) return;
      if (!confirm((formState.deleteLabel || 'Delete') + '?\n\nThis cannot be undone.')) return;
      formState.onDelete();
      formState = null;
      U().closeSheet();
      U().toast('Deleted');
      repaint();
    },

    'sheet-close': function () { U().closeSheet(); },

    privacy: function () {
      U().openSheet(
        '<button type="button" class="asc-back" data-act="sheet-close">' +
          '<span aria-hidden="true">←</span> Back</button>' +
        '<h2 class="hd-plate">Where this lives</h2>' +
        '<p class="asc-body">Everything in this archive is stored on your own devices and ' +
        'synced between them through your own database row. Pasting a link asks the site you ' +
        'linked to for its own title and cover, and nothing else — there is no third-party ' +
        'metadata service, and no analytics.\n\nA video loads its player only when you press ' +
        'play, so opening a page costs YouTube nothing and tells it nothing.</p>' +
        '<div class="asc-sheet__acts">' +
          '<button type="button" class="asc-btn asc-btn--sm" data-act="export">Export your data</button>' +
        '</div>', {});
    },
    export: function () {
      U().closeSheet();
      if (global.DataExport && typeof global.DataExport.open === 'function') return global.DataExport.open();
      U().toast('The export panel lives in the corner of the page');
    },

    menu: function () {
      var on = document.body.classList.toggle('hd-menu-on');
      $('hdBurger').setAttribute('aria-expanded', String(on));
    },

    find: function () { openFind(); },
    'find-close': function () { closeFind(); }
  };

  // ── §SEARCH ────────────────────────────────────────────────
  var findTimer = 0;

  function openFind() {
    var box = $('hdFind');
    box.hidden = false;
    requestAnimationFrame(function () { box.classList.add('is-on'); });
    document.body.classList.add('asc-locked');
    $('hdFindIn').value = state.q;
    $('hdFindIn').focus();
    paintFind(state.q);
  }
  function closeFind() {
    var box = $('hdFind');
    box.classList.remove('is-on');
    document.body.classList.remove('asc-locked');
    setTimeout(function () { box.hidden = true; }, 220);
  }
  function paintFind(q) {
    q = String(q || '').trim().toLowerCase();
    var out = $('hdFindOut');
    if (!q) {
      out.innerHTML = '<p class="hd-find__hint">Titles, creators, collections and notes. ' +
        'Press Enter to open the whole result in the archive.</p>';
      return;
    }
    var hits = H().allCards().filter(function (d) {
      return (d.title + ' ' + d.creator + ' ' + d.cat + ' ' + d.desc).toLowerCase().indexOf(q) >= 0;
    });
    out.innerHTML = hits.length
      ? '<p class="hd-find__n">' + hits.length + (hits.length === 1 ? ' entry' : ' entries') + '</p>' +
        hits.slice(0, 8).map(function (d) {
          return '<button type="button" class="hd-find__row" data-act="info" data-shelf="' +
            attr(d.shelf) + '" data-id="' + attr(d.id) + '">' +
            (d.cover ? '<img src="' + attr(d.cover) + '" alt="" loading="lazy">' : '<span></span>') +
            '<span><b>' + esc(d.title) + '</b><i>' + esc(H().shelfOf(d.tab).label) +
            (d.creator ? ' · ' + esc(d.creator) : '') + '</i></span></button>';
        }).join('') +
        (hits.length > 8 ? '<p class="hd-find__hint">Press Enter for all ' + hits.length + '.</p>' : '')
      : '<p class="hd-find__hint">Nothing matches “' + esc(q) + '”.</p>';
  }

  // ── §DELEGATION ────────────────────────────────────────────
  function fire(e) {
    var hit = e.target.closest('[data-act]');
    if (!hit) return;
    var fn = ACTS[hit.dataset.act] || G().ACTS[hit.dataset.act];
    if (!fn) return;
    // A link that also carries data-act ("Open its page", the
    // journal's "Open the game") must still navigate, so an
    // anchor is allowed to do its own job first.
    if (hit.tagName !== 'A') e.preventDefault();
    e.stopPropagation();
    fn(hit, e);
  }

  function bind() {
    ['hdTop', 'vtRoot', 'hdFoot', 'ascSheet', 'hdFind'].forEach(function (id) {
      var n = $(id);
      if (n) n.addEventListener('click', fire);
    });

    // `change` for the one <select> on the page — a select does
    // not report a keyboard choice as a click.
    $('vtRoot').addEventListener('change', function (e) {
      var hit = e.target.closest('[data-act="sort"]');
      if (hit) ACTS.sort(hit);
    });

    $('hdFindIn').addEventListener('input', function (e) {
      var v = e.target.value;
      clearTimeout(findTimer);
      findTimer = setTimeout(function () { paintFind(v); }, 130);
    });
    $('hdFindIn').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      state.q = e.target.value;
      closeFind();
      if (state.route !== 'archive' && state.route !== 'collection') location.hash = '#/archive';
      else repaint();
    });

    // COVER FALLBACK. `error` does not bubble, so it is caught in
    // the capture phase for the whole page at once. maxresdefault
    // does not exist for every video; hqdefault always does, and
    // swapping once is the difference between a mosaic of broken
    // frames and one that simply looks a little softer.
    document.addEventListener('error', function (e) {
      var img = e.target;
      if (!img || img.tagName !== 'IMG') return;
      var fb = img.getAttribute('data-fallback');
      if (!fb) return;
      img.removeAttribute('data-fallback');
      img.src = fb;
    }, true);

    addEventListener('hashchange', function () {
      var was = state.route + '|' + state.shelf + '|' + state.collection + '|' + state.gameId;
      applyHash();
      if (was === state.route + '|' + state.shelf + '|' + state.collection + '|' + state.gameId) return;
      document.body.classList.remove('hd-menu-on');
      $('hdBurger').setAttribute('aria-expanded', 'false');
      navigate();
    });

    addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('hdFind').hidden) return closeFind();
        if (cmp.open) return closeComposer(true);
      }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (cmp.open || U().sheetOpen()) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); return addHere(); }
      if (e.key === '/') { e.preventDefault(); return openFind(); }
    });

    $('addFab').onclick = function () { addHere(); };

    // ══ SCROLL: THE BAR, AND THE PARALLAX ═══════════════════
    // ONE handler for both, in one rAF. Two listeners reading the
    // same scroll position on the same frame is two layout reads
    // where one would do.
    //
    // NOT `animation-timeline: scroll()`. Scroll-driven CSS
    // animations only reached iOS in Safari 26 and this has to
    // work on Damian's phone today.
    //
    // The hero is the first element of #vtRoot and #vtRoot starts
    // at y=0, so the hero's top is the document's top and its
    // height is all the geometry this needs. Measured once per
    // paint, not per frame.
    var stuck = null, ticking = false, heroEl = null, heroH = 0;
    var reduced = function () { return U().reducedMotion(); };

    var measureHero = function () {
      heroEl = $('vtRoot').querySelector('[data-parallax]');
      heroH = heroEl ? heroEl.offsetHeight : 0;
    };

    var readScroll = function () {
      ticking = false;
      var y = global.scrollY || document.documentElement.scrollTop || 0;

      var want = y > 24;
      if (want !== stuck) {
        stuck = want;
        $('hdTop').classList.toggle('is-stuck', want);
      }

      if (!heroEl || !heroH) return;
      // Past the hero there is nothing to move, so the handler
      // costs one comparison per frame for the rest of the page.
      // The `> heroH` case still runs ONCE, to park the properties
      // at their end values rather than leaving them mid-travel.
      if (y > heroH + 40) {
        if (heroEl.dataset.parked !== '1') {
          heroEl.dataset.parked = '1';
          heroEl.style.setProperty('--hd-par', '0px');
          heroEl.style.setProperty('--hd-lift', '0px');
          heroEl.style.setProperty('--hd-fade', '0');
        }
        return;
      }
      heroEl.dataset.parked = '0';
      if (reduced()) return;   // a still photograph, and nothing writes

      var p = y / heroH;
      // The picture lags the page; the words leave before it does,
      // which is what reads as depth rather than as a stuck image.
      heroEl.style.setProperty('--hd-par', (y * 0.34).toFixed(1) + 'px');
      heroEl.style.setProperty('--hd-lift', (y * -0.06).toFixed(1) + 'px');
      heroEl.style.setProperty('--hd-fade', Math.max(0, 1 - p / 0.62).toFixed(3));
    };

    addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(readScroll);
    }, { passive: true });
    addEventListener('resize', function () { measureHero(); readScroll(); }, { passive: true });

    measureHero();
    readScroll();
    // navigate() scrolls to the top and repaint() replaces the
    // hero node, so both have to re-find and re-measure it; the
    // scroll event that would otherwise do it is not guaranteed.
    HDApp.__readScroll = function () { measureHero(); readScroll(); };
  }

  // =============================================================
  // §THE COMPOSER
  // =============================================================
  // Carried over unchanged in behaviour, ids included. One form
  // covers add and edit, because correcting an item and creating
  // one want the same nine fields.
  //
  // THE IDS ARE LOAD-BEARING: AthDraft scopes a draft by them, so
  // an entry half-typed before this rebuild is still recoverable
  // after it.
  var cmp = {
    el: null, scrim: null, form: null, msg: null, url: null, title: null, shelf: null,
    cat: null, catList: null, creator: null, len: null, cover: null, desc: null,
    stars: null, fav: null, queue: null, del: null, prev: null, prevImg: null,
    prevTitle: null, prevSub: null, heading: null,
    editing: null, rating: 0, touched: null, lastFocus: null, open: false, dupeWarned: false
  };

  function grabComposer() {
    cmp.el = $('cmp'); cmp.scrim = $('cmpScrim'); cmp.form = $('cmpForm'); cmp.msg = $('cmpMsg');
    cmp.url = $('cmpUrl'); cmp.title = $('cmpTitleIn'); cmp.shelf = $('cmpShelf');
    cmp.cat = $('cmpCat'); cmp.catList = $('cmpCatList'); cmp.creator = $('cmpCreator');
    cmp.len = $('cmpLen'); cmp.cover = $('cmpCover'); cmp.desc = $('cmpDesc');
    cmp.stars = $('cmpStars'); cmp.fav = $('cmpFav'); cmp.queue = $('cmpQueue'); cmp.del = $('cmpDel');
    cmp.prev = $('cmpPrev'); cmp.prevImg = $('cmpPrevImg'); cmp.prevTitle = $('cmpPrevTitle');
    cmp.prevSub = $('cmpPrevSub'); cmp.heading = $('cmpTitle');
    cmp.touched = new Set();
  }

  // Only ever fills a field the reader has left alone, and only
  // from the site's OWN oEmbed endpoint — no third-party metadata
  // service, which would mean every link pasted here being
  // reported to a stranger. With no endpoint, the host name and a
  // Title-Cased URL slug still beat an empty form.
  var OEMBED = {
    'youtube.com': function (u) { return 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u); },
    'youtu.be': function (u) { return 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u); },
    'vimeo.com': function (u) { return 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(u); },
    'open.spotify.com': function (u) { return 'https://open.spotify.com/oembed?url=' + encodeURIComponent(u); },
    'soundcloud.com': function (u) { return 'https://soundcloud.com/oembed?format=json&url=' + encodeURIComponent(u); }
  };

  function titleFromSlug(u) {
    try {
      var seg = new URL(u).pathname.split('/').filter(Boolean).pop() || '';
      if (!seg || /^[0-9a-f]{8,}$/i.test(seg)) return '';
      return decodeURIComponent(seg).replace(/\.(html?|php|aspx?)$/i, '')
        .replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim()
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    } catch (e) { return ''; }
  }

  function fillIfUntouched(field, value) {
    if (!value) return;
    var node = cmp[field];
    if (!node || cmp.touched.has(field) || node.value.trim()) return;
    node.value = value;
  }

  var autofillSeq = 0;
  function autofill(raw) {
    var u = String(raw || '').trim();
    if (!/^https?:\/\//i.test(u)) return;
    var seq = ++autofillSeq;

    var host = '';
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) {}
    fillIfUntouched('creator', host);
    fillIfUntouched('title', titleFromSlug(u));
    var vid = H().ytId(u);
    if (vid) fillIfUntouched('cover', 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg');
    paintPreview();

    var endpoint = OEMBED[host];
    if (!endpoint) return;
    fetch(endpoint(u), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || seq !== autofillSeq) return;
        fillIfUntouched('title', j.title);
        fillIfUntouched('creator', j.author_name);
        if (j.thumbnail_url && !cmp.touched.has('cover')) cmp.cover.value = j.thumbnail_url;
        paintPreview();
      })
      .catch(function () { /* offline, blocked, or the endpoint moved — the form still works */ });
  }

  function paintPreview() {
    var cover = cmp.cover.value.trim(), title = cmp.title.value.trim();
    if (!cover && !title) { cmp.prev.hidden = true; return; }
    cmp.prev.hidden = false;
    cmp.prevTitle.textContent = title || 'Untitled';
    cmp.prevSub.textContent = [cmp.creator.value.trim(), cmp.len.value.trim(), cmp.cat.value.trim()]
      .filter(Boolean).join(' · ');
    if (cover) {
      cmp.prevImg.hidden = false;
      if (cmp.prevImg.getAttribute('src') !== cover) cmp.prevImg.src = cover;
    } else { cmp.prevImg.hidden = true; cmp.prevImg.removeAttribute('src'); }
  }

  function say(text, kind) {
    cmp.msg.textContent = text || '';
    cmp.msg.className = 'vt-msg' + (text ? ' is-on is-' + (kind || 'warn') : '');
  }

  function paintStars() {
    cmp.stars.querySelectorAll('.vt-star').forEach(function (b) {
      b.classList.toggle('is-on', Number(b.dataset.n) <= cmp.rating);
    });
  }
  function paintToggles() {
    cmp.fav.textContent = cmp.fav.classList.contains('is-on') ? '★ Favourite' : '☆ Favourite';
    cmp.queue.textContent = cmp.queue.classList.contains('is-on') ? '✓ Tonight' : '＋ Tonight';
  }

  // All ten shelves, always, including the ones hidden from the
  // interface. A shelf you cannot file to is a shelf that can
  // never stop being empty — and hiding Reading from the tabs is
  // not the same as making it unreachable.
  function fillShelfSelect(selected) {
    cmp.shelf.innerHTML = global.Vault.SHELVES.map(function (s) {
      return '<option value="' + s + '">' + esc(H().SHELF_NAME[s] || s) + '</option>';
    }).join('');
    cmp.shelf.value = global.Vault.SHELVES.indexOf(selected) >= 0 ? selected : global.Vault.SHELVES[0];
  }
  function fillCatList() {
    var own = global.Vault.categories(cmp.shelf.value);
    var rest = global.Vault.allCategories().filter(function (c) { return own.indexOf(c) < 0; });
    cmp.catList.innerHTML = own.concat(rest).map(function (c) {
      return '<option value="' + attr(c) + '">';
    }).join('');
  }

  function openComposer(opts) {
    opts = opts || {};
    var item = opts.item || null;
    cmp.editing = item ? { shelf: opts.shelf, id: item.id } : null;
    cmp.touched.clear();
    cmp.dupeWarned = false;
    say('');

    cmp.heading.textContent = item ? 'Edit this entry' : 'Add to the archive';
    var guess = opts.shelf ||
      (state.route === 'game' ? 'games' : '') ||
      (state.shelf !== 'all' ? H().readsOf(state.shelf)[0] : '');
    fillShelfSelect(item ? opts.shelf : guess);
    fillCatList();

    cmp.url.value = item ? (item.url || '') : (opts.url || '');
    cmp.title.value = item ? (item.title || '') : '';
    cmp.cat.value = item ? (item.category || '') : (opts.category || '');
    cmp.creator.value = item ? (item.creator || '') : '';
    cmp.len.value = item ? (item.lengthText || '') : '';
    cmp.cover.value = item ? (item.cover || '') : '';
    cmp.desc.value = item ? (item.description || '') : '';
    cmp.rating = item ? (Number(item.rating) || 0) : 0;
    cmp.fav.classList.toggle('is-on', !!(item && item.favorite));
    cmp.queue.classList.toggle('is-on', !!(item && item.queued));
    paintStars(); paintToggles(); paintPreview();
    cmp.del.hidden = !item;

    cmp.lastFocus = document.activeElement;
    cmp.el.hidden = false; cmp.scrim.hidden = false;
    requestAnimationFrame(function () {
      cmp.el.classList.add('is-on'); cmp.scrim.classList.add('is-on');
    });
    cmp.open = true;
    setTimeout(function () { (item ? cmp.title : cmp.url).focus(); }, 90);
    if (!item && opts.url) autofill(opts.url);
    bindComposerDraft(item);
  }

  // Everything typed here lives only in the DOM until Save is
  // pressed. AthDraft writes every keystroke to the REAL
  // localStorage through a hidden iframe — local-store-idb.js's
  // writes are not durable at unload — under `athdraft:`, which
  // sync.js cannot see.
  var cmpDraft = null;
  function bindComposerDraft(item) {
    cmpDraft = null;
    if (!global.AthDraft) return;
    var f = $('cmpForm');
    if (!f) return;
    f.querySelectorAll('input,textarea,select').forEach(function (node) {
      if (node.id && node.id.indexOf('cmp') === 0) node.setAttribute('data-f', node.id.slice(3));
    });
    var scope = 'composer:vault:' + (item ? cmp.editing.shelf + ':' + item.id : 'new');
    cmpDraft = AthDraft.bind(scope, f, {
      onRestore: function (when) {
        AthDraft.banner(f, when, function () {
          if (cmpDraft) cmpDraft.clear();
          cmpDraft = null;
        });
        paintPreview();
      }
    });
  }

  // `discard` true means a DECISION to be done with this entry —
  // the close button, Escape, the scrim, a real save, a delete. A
  // refresh is not a decision, and its draft has to survive.
  function closeComposer(discard) {
    if (!cmp.open) return;
    if (cmpDraft) { if (discard) cmpDraft.clear(); else cmpDraft.save(); }
    cmpDraft = null;
    cmp.open = false;
    cmp.el.classList.remove('is-on'); cmp.scrim.classList.remove('is-on');
    setTimeout(function () { cmp.el.hidden = true; cmp.scrim.hidden = true; }, 320);
    if (cmp.lastFocus && cmp.lastFocus.focus) { try { cmp.lastFocus.focus(); } catch (e) {} }
  }

  function readComposer() {
    return {
      url: cmp.url.value.trim(),
      title: cmp.title.value.trim(),
      category: cmp.cat.value.trim(),
      creator: cmp.creator.value.trim(),
      lengthText: cmp.len.value.trim(),
      cover: cmp.cover.value.trim(),
      description: cmp.desc.value.trim(),
      rating: cmp.rating,
      favorite: cmp.fav.classList.contains('is-on'),
      queued: cmp.queue.classList.contains('is-on')
    };
  }

  function saveComposer(keepOpen) {
    var f = readComposer(), shelf = cmp.shelf.value;
    if (!f.title && !f.url) {
      say('Give it a title or a link — everything else is optional.', 'bad');
      cmp.title.focus();
      return false;
    }
    if (!f.title) f.title = titleFromSlug(f.url) || f.url;
    // A cover that can be derived is better than no cover, and
    // the mosaic is built out of covers. Derived only — still no
    // third-party lookup.
    if (!f.cover && f.url) {
      var vid = H().ytId(f.url);
      if (vid) f.cover = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg';
    }

    if (cmp.editing) {
      // A shelf change is a MOVE, not a field edit — the shelf is
      // part of the storage key rather than a property of the
      // record. Vault.move carries the id and createdAt across.
      if (shelf !== cmp.editing.shelf) global.Vault.move(cmp.editing.shelf, cmp.editing.id, shelf);
      global.Vault.update(shelf, cmp.editing.id, f);
      U().toast('Saved');
    } else {
      var dupe = f.url ? global.Vault.findByUrl(f.url) : null;
      if (dupe) {
        say('That link is already on ' + (H().SHELF_NAME[dupe.shelf] || dupe.shelf) +
          ' as “' + dupe.item.title + '”. Saving again will make a second copy.', 'warn');
        if (!cmp.dupeWarned) { cmp.dupeWarned = true; return false; }
      }
      global.Vault.add(shelf, f);
      U().toast('Added to ' + (H().SHELF_NAME[shelf] || shelf));
    }
    cmp.dupeWarned = false;

    if (keepOpen) {
      var keptShelf = shelf, keptCat = f.category;
      cmp.editing = null; cmp.touched.clear(); say('');
      ['url', 'title', 'creator', 'len', 'cover', 'desc'].forEach(function (k) { cmp[k].value = ''; });
      cmp.rating = 0;
      cmp.fav.classList.remove('is-on'); cmp.queue.classList.remove('is-on');
      paintStars(); paintToggles(); paintPreview();
      cmp.heading.textContent = 'Add to the archive';
      cmp.del.hidden = true;
      fillShelfSelect(keptShelf); cmp.cat.value = keptCat; fillCatList();
      cmp.url.focus();
    } else {
      closeComposer(true);   // saved for real: the draft has done its job
    }
    repaint();
    return true;
  }

  function deleteComposer() {
    if (!cmp.editing) return;
    var r = H().recordOf(cmp.editing.shelf, cmp.editing.id);
    if (!confirm('Delete “' + (r ? r.title : 'this item') + '” from ' +
      (H().SHELF_NAME[cmp.editing.shelf] || cmp.editing.shelf) + '?\n\nThis cannot be undone.')) return;
    var wasGame = cmp.editing.shelf === 'games', wasId = cmp.editing.id;
    global.Vault.remove(cmp.editing.shelf, cmp.editing.id);
    closeComposer(true);
    U().toast('Deleted');
    if (state.route === 'game' && wasGame && state.gameId === wasId) location.hash = '#/archive/games';
    else repaint();
  }

  function wireComposer() {
    ['url', 'title', 'cat', 'creator', 'len', 'cover', 'desc'].forEach(function (k) {
      cmp[k].addEventListener('input', function () {
        cmp.touched.add(k);
        if (k !== 'desc') paintPreview();
        if (k === 'url') say('');
      });
    });
    cmp.url.addEventListener('paste', function () {
      setTimeout(function () {
        cmp.touched.delete('title'); cmp.touched.delete('creator'); cmp.touched.delete('cover');
        autofill(cmp.url.value);
      }, 0);
    });
    cmp.url.addEventListener('change', function () { autofill(cmp.url.value); });
    cmp.shelf.addEventListener('change', fillCatList);
    cmp.stars.addEventListener('click', function (e) {
      var b = e.target.closest('.vt-star');
      if (!b) return;
      var n = Number(b.dataset.n);
      cmp.rating = (cmp.rating === n) ? n - 1 : n;   // click the current star to step down
      paintStars();
    });
    cmp.prevImg.addEventListener('error', function () {
      if (!cmp.cover.value.trim()) return;
      say('That cover link did not load. It will still save — the card falls back to the shelf mark.', 'warn');
    });
    $('cmpStarsClear').onclick = function () { cmp.rating = 0; paintStars(); };
    cmp.fav.onclick = function () { cmp.fav.classList.toggle('is-on'); paintToggles(); };
    cmp.queue.onclick = function () { cmp.queue.classList.toggle('is-on'); paintToggles(); };
    $('cmpSave').onclick = function () { saveComposer(false); };
    $('cmpAgain').onclick = function () { saveComposer(true); };
    cmp.del.onclick = deleteComposer;
    $('cmpX').onclick = function () { closeComposer(true); };
    cmp.scrim.onclick = function () { closeComposer(true); };
    cmp.form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        saveComposer(false);
      }
    });
    // Focus must not escape an open sheet — behind it is a page
    // full of links.
    cmp.el.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = [].slice.call(cmp.el.querySelectorAll('input,select,textarea,button'))
        .filter(function (n) { return !n.hidden && !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  // =============================================================
  // §BOOT
  // =============================================================
  // Two gates, both required:
  //   · DOMContentLoaded — sync.js, topbar.js, vault-data.js and
  //     the view files are deferred and only finish executing
  //     right before it fires.
  //   · LocalStoreIDB.ready() — the shim seeds a Map synchronously
  //     but overlays the real IndexedDB contents asynchronously,
  //     and IndexedDB wins. Rendering before it resolves shows
  //     stale data, then flickers.
  function boot() {
    // Snapshot BEFORE anything else this session does, and pinned:
    // this is the copy that answers "what did this device hold
    // when I opened it", which is the only question worth asking
    // after a bad sync.
    if (global.Snapshots) {
      try { global.Snapshots.forApp('vault').boot(); }
      catch (e) { try { console.error('[snapshots]', e); } catch (e2) {} }
    }

    grabComposer();
    wireComposer();
    U().bindSheet();
    bind();

    applyHash();
    U().introArrive();
    repaint();

    // Its own Supabase row, unchanged. Nothing here reads or
    // writes any other prefix, so no other dashboard page is
    // touched by anything that happens here.
    var remoteRef = { applied: false };
    if (typeof global.initCloudSync === 'function') {
      global.initCloudSync({
        appKey: 'vault',
        syncedPrefixes: ['vault:'],
        // handoff: protects a write whose push never confirmed
        // from the next visit's opening pull. See sync.js §HANDOFF.
        handoff: true,
        onApplied: function () {
          remoteRef.applied = true;
          // A REPAINT, not a navigation. It does not scroll, and
          // it does not call introArrive() — rvlStyle() hands the
          // re-created cards a NEGATIVE --t so an entrance that
          // was halfway through resumes rather than replaying.
          // And it does not run at all while a field is focused
          // or a sheet is open: the cloud does not get to rebuild
          // the DOM under someone who is typing.
          if (!U().safeToRepaint()) return;
          if (cmp.open || !$('hdFind').hidden) return;
          repaint();
        }
      });
    }

    // Additive: seeds only shelves that are EMPTY, merging by
    // canonical URL. It never deletes, so anything removed here
    // stays removed.
    global.Vault.maybeSeedAfterSyncAttempt(remoteRef, function () { repaint(); });
  }

  global.HDApp = {
    state: state, form: form, repaint: repaint, navigate: navigate,
    openDetail: openDetail, openComposer: openComposer, ACTS: ACTS
  };

  document.addEventListener('DOMContentLoaded', function () {
    (global.LocalStoreIDB ? global.LocalStoreIDB.ready() : Promise.resolve()).then(boot);
  });
})(window);
