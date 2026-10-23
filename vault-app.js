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
  var A = function () { return global.HDArticle; };
  var C = function () { return global.HDCapture; };
  var esc = function (s) { return U().esc(s); };
  var attr = function (s) { return U().attr(s); };
  var $ = function (id) { return document.getElementById(id); };

  // ── §VIEW STATE ────────────────────────────────────────────
  // Session-only but for the route, which lives in the hash where
  // it also makes a link. Everything under `vault:` is pushed to
  // Supabase, and which shelf a laptop was last left on is not
  // something a phone should be told about.
  var state = {
    // `group` is a CATEGORY GROUP, not a storage shelf. The two were
    // the same thing until 2026-10-18; see vault-views.js §GROUPS.
    // `group` is the MEDIA LIBRARY's tab on the main page. It is
    // set by a button now, not by a hash, so changing tab never
    // scrolls the reader back past Favorites and Live Streams.
    route: 'main', group: 'all', collection: '', gameId: '', articleId: '',
    // Which section of the main page an old bookmark meant —
    // #/favourites lands on Favorites, #/archive/music on the
    // library. Spent by navigate() once and cleared.
    jump: '',
    q: '', sort: 'shelf'
  };

  // Journal was removed on 2026-09-03 — the route, this nav item,
  // the mosaic tile that advertised it and every link into it. The
  // ENTRIES are untouched; the game page's fourth column still
  // holds them. `#/journal` now falls through parseHash's default
  // to MAIN, so an old bookmark still lands somewhere real.
  //
  // 2026-10-23: THREE PAGES. Favourites, Collections and Games
  // were folded into Main; a game's own page (and an article) is
  // reached from Main's dashboard callout, so Main lights up there.
  var NAV = [
    { href: '#/', label: 'Main', match: ['main', 'game', 'article'] },
    { href: '#/capture', label: 'Capture', match: ['capture'] },
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
    main: 'night', capture: 'night', about: 'night', game: 'night', article: 'night'
  };

  // THE ONE ROUTE WITH NO HERO. Every other view opens on the same
  // full-viewport photograph, which is why the pill bar is
  // transparent until you have scrolled off it. An article opens
  // on the ground and on a formatting bar — the reference for it
  // has no hero, and a screen of scrolling before the first word
  // would be the wrong thing on a page you write in. So the bar
  // takes its frosted ground immediately here, and .hd-art puts
  // back the 90px that .hd-main's negative margin takes away.
  var HEROLESS = { article: 1, capture: 1 };

  // ── §ROUTING ───────────────────────────────────────────────
  // Legacy hashes have no slash and are answered first, so every
  // bookmark this page has ever handed out still lands somewhere
  // real rather than on an empty view.
  function parseHash() {
    var raw = String(location.hash || '').replace(/^#/, '');
    // #/ IS THE MAIN PAGE.
    if (!raw || raw === '/') return { route: 'main', group: 'all' };

    // A library tab, by any name it has ever had. 'episodes' is
    // not a library tab any more — all of it lives in Favorites —
    // so a bookmark to it lands there instead.
    var toTab = function (k) {
      k = H().tabKey(k || 'all');
      if (k === 'episodes') return { route: 'main', group: 'all', jump: 'hdFav' };
      if (k !== 'all' && !H().LIB().some(function (s) { return s.key === k; })) k = 'all';
      return { route: 'main', group: k, jump: 'hdLib' };
    };

    if (raw.charAt(0) !== '/') {
      if (raw === 'favorites' || raw === 'favourites') return { route: 'main', group: 'all', jump: 'hdFav' };
      return toTab(raw);
    }

    var p = raw.split('/').filter(Boolean);
    switch (p[0]) {
      case 'main': return { route: 'main', group: 'all' };
      case 'archive': return toTab(p[1]);
      case 'games': return toTab('gaming');
      case 'game': return { route: 'game', gameId: decodeURIComponent(p[1] || '') };
      case 'article': return { route: 'article', articleId: decodeURIComponent(p[1] || '') };
      // Both spellings, and both now mean a SECTION of Main.
      case 'favourites': case 'favorites': case 'live':
        return { route: 'main', group: 'all', jump: p[0] === 'live' ? 'hdLive' : 'hdFav' };
      case 'capture': return { route: 'capture' };
      // Collections were a cut of the library by category; a
      // bookmark to one opens the library on the tab that holds it.
      case 'collections': return toTab('all');
      case 'collection':
        return toTab(H().groupKeyOfCat(decodeURIComponent(p[1] || '')));
      case 'about': return { route: 'about' };
      default: return { route: 'main', group: 'all' };
    }
  }

  function applyHash() {
    var r = parseHash();
    state.route = r.route;
    // Leaving Main and coming back keeps the library on the tab it
    // was on; only a hash that NAMES a tab changes it.
    if (r.jump === 'hdLib') state.group = r.group || 'all';
    state.collection = '';
    state.gameId = r.gameId || '';
    state.articleId = r.articleId || '';
    state.jump = r.jump || '';
  }

  // ── §PAINT ─────────────────────────────────────────────────
  // repaint() is what the data changing calls: it does not scroll
  // and it does not re-arm the entrance. navigate() is what a
  // route change calls, and it does both. Conflating the two is
  // how a phone in another room saving something throws away the
  // place you had scrolled to.
  function html() {
    switch (state.route) {
      case 'main': return H().viewMain(state);
      case 'capture': return C().viewCapture();
      case 'about': return H().viewAbout();
      case 'game': return G().view(state.gameId);
      case 'article': return A().view(state.articleId);
      // The same view as 'main' above, on purpose rather than by
      // accident: parseHash answers an unknown hash with Main, so
      // #/journal and every other retired bookmark arrives here.
      default: return H().viewMain(state);
    }
  }

  function repaint() {
    // Anything half-typed in an article is written down BEFORE the
    // DOM it lives in is thrown away. Nothing else on this page can
    // lose work to a repaint; a contenteditable can.
    A().commitPending();
    $('vtRoot').innerHTML = html();
    paintChrome();
    // The view is a string. This is everything the string cannot
    // do: the editor's caret, its draft, the toolbar's state, and
    // the one-time conversion of a game's old columns.
    A().afterPaint(state);
    revealTabs();
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
    // An old bookmark to Favourites or to a library tab lands ON
    // that section of Main, opened, rather than a hero's height
    // above it. Spent once.
    if (state.jump) {
      var to = $(state.jump);
      state.jump = '';
      if (to) {
        if (to.tagName === 'DETAILS') to.open = true;
        var y = to.getBoundingClientRect().top + global.scrollY - 96;
        global.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
      }
    }
    if (HDApp.__readScroll) HDApp.__readScroll();
    // Moving focus to the region is how a hash route stays usable
    // from a keyboard — except on a page that has already put the
    // cursor somewhere on purpose. A new article opens with the
    // caret in its title, and taking it back out is worse than
    // never having placed it.
    if (document.activeElement && document.activeElement.isContentEditable) return;
    $('vtRoot').focus({ preventScroll: true });
  }

  // ── §REPAINTING JUST THE LISTS ─────────────────────────────
  // Starring something MOVES it between the two lists, which
  // means a star is no longer a glyph change — it is a change to
  // which list an item belongs to, and the page lies about its
  // own organising principle until something redraws.
  //
  // This is the smallest thing that can: the hero (a
  // full-viewport photograph), the tabs and the utility line —
  // which is where the focused sort <select> lives — all stay
  // exactly as they are. It is strictly LESS work than this page
  // already does on a keystroke: ACTS.sort and clear-q both call
  // the full repaint(), which additionally rebuilds the hero,
  // re-runs afterPaint() and re-measures the parallax.
  //
  // 2026-10-23: on Main a star or a Live switch moves a card
  // between SECTIONS, so this re-cuts all three — Favorites, Live
  // Streams and the library — plus the counts and the tab strip.
  // The hero, the callout, the open/closed state of each section
  // and the focused sort <select> are all left alone.
  function paintLists() {
    var host = $('hdLists');
    if (state.route !== 'main' || !host) return repaint();
    var p = H().mainParts(state);
    var put = function (id, html) { var n = $(id); if (n) n.innerHTML = html; };
    var words = function (n) { return n + (n === 1 ? ' entry' : ' entries'); };
    put('hdFavBody', p.fav.html);
    put('hdFavN', words(p.fav.n));
    put('hdLiveBody', p.live.html);
    put('hdLiveN', words(p.live.n));
    put('hdLibTabs', p.tabs);
    put('hdLibN', words(p.lib.n));
    host.innerHTML = p.lib.html;
    revealTabs();
  }

  // On a phone each tab row is one line that scrolls SIDEWAYS, and
  // a fresh row starts at its left edge — so Music, sixth along,
  // was lit and off-screen, and so was a music kind in the row
  // under it. This slides each row (never the page) to its lit tab.
  function revealTabs() {
    var wrap = $('hdLibTabs');
    if (!wrap) return;
    wrap.querySelectorAll('.hd-tabs').forEach(function (row) {
      if (row.scrollWidth <= row.clientWidth) return;
      var on = row.querySelector('.is-on');
      if (!on) return;
      var dx = on.getBoundingClientRect().left - row.getBoundingClientRect().left;
      row.scrollLeft += dx - 24;
    });
  }

  // THE ANCHOR IS A NODE THAT IS NOT MOVING.
  //
  // Re-cutting both lists changes the height of everything above
  // the viewport, so the browser's scroll offset now points
  // somewhere else. Anchoring on the card that was CLICKED would
  // be worse than doing nothing: it has just travelled to the top
  // of the page, and following it would take the reader with it.
  //
  // So the anchor is the first card at or just below the top edge
  // that is NOT the clicked one. Its offset before, its offset
  // after, and the difference scrolled by.
  function topAnchor(skipId) {
    var n = document.querySelectorAll('#vtRoot .hd-card [data-act="star"]');
    for (var i = 0; i < n.length; i++) {
      if (n[i].dataset.id === skipId) continue;
      var c = n[i].closest('.hd-card');
      if (!c) continue;
      var t = c.getBoundingClientRect().top;
      if (t > -4) return { shelf: n[i].dataset.shelf, id: n[i].dataset.id, top: t };
    }
    return null;
  }

  function keepPlace(skipId, paint) {
    var a = topAnchor(skipId);
    paint();
    if (!a) return;
    var n = document.querySelector('#vtRoot .hd-card [data-act="star"][data-shelf="' +
      cssq(a.shelf) + '"][data-id="' + cssq(a.id) + '"]');
    var c = n && n.closest('.hd-card');
    if (!c) return;
    // Measured AFTER the paint, so a card that changed shape —
    // and therefore height — is still corrected for.
    var now = c.getBoundingClientRect().top;
    if (Math.abs(now - a.top) > 1) global.scrollBy(0, now - a.top);
  }

  function paintChrome() {
    var ground = GROUND[state.route] || 'night';
    document.documentElement.setAttribute('data-ground', ground);

    // On a heroless route the bar has body text passing under it
    // from the first pixel, so it is stuck from the first pixel.
    // The scroll handler owns `is-stuck` everywhere else and will
    // not fight this: it only writes when its own idea of the flag
    // changes, and readScroll() runs after every paint.
    document.body.classList.toggle('hd-heroless', !!HEROLESS[state.route]);
    if (HEROLESS[state.route]) $('hdTop').classList.add('is-stuck');

    // The pill puts the wordmark in the MIDDLE of the links, so
    // the nav is painted as two halves either side of it. The
    // brand itself is static markup and is never re-created.
    var link = function (n) {
      var on = n.match.indexOf(state.route) >= 0;
      return '<a href="' + n.href + '"' + (on ? ' class="is-on" aria-current="page"' : '') + '>' +
        esc(n.label) + '</a>';
    };
    // The wordmark sits in the MIDDLE of the links, so an odd
    // count has to put the extra one on the RIGHT or the brand
    // drifts left of centre. floor() is the same 2/2 it has
    // always been for four, and 2/3 for five.
    var half = Math.floor(NAV.length / 2);
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
    var d = H().toCard(r, shelf, H().groupKeyOfCat(r.category));
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
        '<button type="button" class="asc-btn" data-act="live" data-shelf="' + attr(shelf) +
          '" data-id="' + attr(id) + '" aria-pressed="' + d.live + '">' +
          (d.live ? '● Live stream' : '○ Live stream') + '</button>' +
        '<button type="button" class="asc-btn" data-act="feature" data-shelf="' + attr(shelf) +
          '" data-id="' + attr(id) + '">' + (isFeat ? '◆ Featured' : '◇ Feature this') + '</button>' +
        '<button type="button" class="asc-btn" data-act="edit" data-shelf="' + attr(shelf) +
          '" data-id="' + attr(id) + '">Edit</button>' +
      '</div>' +
      (d.desc ? '<div class="asc-sheet__block"><h3 class="asc-label">About</h3>' +
        '<p class="asc-body">' + U().escLines(d.desc) + '</p></div>' : '') +
      '<div class="asc-sheet__block"><h3 class="asc-label">Details</h3><div class="asc-lines">' +
        line('Shelf', esc(H().SHELF_NAME[shelf] || shelf)) +
        // Always the ANSWER, never the stored 'auto' — what the
        // Favourites page will actually do with this item is the
        // only useful thing to print here. The composer is where
        // you argue with it.
        line('Kind', H().classifyKind(d) === 'collection'
          ? 'Playlist or collection' : 'Single video') +
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
  // composer. Standing INSIDE an article, the thing you want
  // another of is an article. Everywhere else nothing has changed.
  function addHere() {
    if (state.route === 'article') return A().ACTS['new-article']();
    if (state.group === 'gaming' || state.route === 'game') return G().ACTS['add-game']();
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

      // The glyph, patched in place, FIRST and always. It is
      // still the whole of the job on every surface that is not a
      // split list — the detail sheet, the hero card, the game
      // page — and it is what makes the press feel instant.
      document.querySelectorAll('[data-act="star"][data-shelf="' + cssq(k.shelf) +
        '"][data-id="' + cssq(k.id) + '"]').forEach(function (s) {
        s.classList.toggle('is-on', on);
        s.setAttribute('aria-pressed', String(on));
        if (s.classList.contains('asc-btn')) s.textContent = on ? '★ Starred' : '☆ Star it';
        else s.textContent = on ? '★' : '☆';
      });

      // And then, where a star is also a MOVE, the move. The old
      // comment here said a repaint "throws away the reader's
      // scroll position for one character of glyph", and it was
      // right about that — but it is not one character of glyph
      // any more, so the answer is to keep the place rather than
      // to skip the paint. keepPlace() is how.
      //
      // Not gated on safeToRepaint(): that guard exists so the
      // CLOUD cannot rebuild the DOM under someone who is typing.
      // This is the reader's own press, and the sort <select>
      // lives outside #hdLists anyway. ACTS.del and clearqueue
      // both repaint unconditionally for the same reason.
      // On Main a star MOVES the card into Favorites or back out of
      // it, so all three sections are re-cut in place.
      if (state.route === 'main') return keepPlace(k.id, paintLists);
      // The Starred reading in .hd-reads is the only thing on the
      // About page that a star changes.
      if (state.route === 'about') repaint();
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

    // LIVE STREAM, on or off. The same shape as star: patch every
    // control for this record in place, then move the card. An
    // explicit false is stored rather than the key deleted, so the
    // one-time pre-tick (Vault.markLiveV1) never switches it back.
    live: function (el) {
      var k = ref(el);
      if (!k) return;
      var r = H().recordOf(k.shelf, k.id);
      if (!r) return U().toast('That item is no longer on the shelf');
      var on = r.live !== true;
      global.Vault.update(k.shelf, k.id, { live: on });
      document.querySelectorAll('[data-act="live"][data-shelf="' + cssq(k.shelf) +
        '"][data-id="' + cssq(k.id) + '"]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(on));
        b.textContent = on ? '● Live stream' : '○ Live stream';
      });
      U().toast(on ? 'Moved to Live Streams' : 'Moved back out of Live Streams');
      if (state.route === 'main') keepPlace(k.id, paintLists);
    },

    // The library's tab strip. A button rather than a hash link, so
    // a tab change re-cuts the library where it stands instead of
    // scrolling the reader back to the hero.
    libtab: function (el) {
      state.group = el.dataset.group || 'all';
      paintLists();
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
      U().toast(isOn ? 'No longer featured' : 'Featured in the hero');
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
      // An article is two keys of its own, kept outside the record.
      // Deleting the game has to take them, or the bodies stay
      // invisible and sync for ever.
      if (k.shelf === 'games') A().removeForGame(r.id);
      U().closeSheet();
      U().toast('Deleted');
      if (state.route === 'game' && state.gameId === k.id) location.hash = '#/';
      else repaint();
    },

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
            hint: 'The two lines on the About page. A line break splits it.' },
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
        'play, so opening a page costs YouTube nothing and tells it nothing.\n\nAn image ' +
        'pasted into an article is shrunk on your own device and then put in your own ' +
        'storage bucket, so what travels between your devices is a link rather than the ' +
        'picture itself. Nothing else is uploaded anywhere.</p>' +
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
    var fn = ACTS[hit.dataset.act] || G().ACTS[hit.dataset.act] ||
      A().ACTS[hit.dataset.act] || C().ACTS[hit.dataset.act];
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
      var pick = e.target.closest('[data-act="recat"], [data-act="bulk-cat"]');
      if (pick) return C().ACTS[pick.dataset.act](pick);
      var hit = e.target.closest('[data-act="sort"]');
      if (hit) ACTS.sort(hit);
    });

    // The two collapsible sections on Main remember whether they
    // were open, per device. `toggle` does not bubble, so it is
    // caught in the capture phase — and it also fires when a
    // repaint builds a section already closed, which is harmless:
    // it writes back the value that was just read.
    $('vtRoot').addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d || !d.dataset || !d.dataset.db) return;
      try { localStorage.setItem('vaultlocal:open:' + d.dataset.db, d.open ? '1' : '0'); } catch (err) {}
    }, true);

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
      if (state.route !== 'main') location.hash = '#/';
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
      var key = function () {
        return state.route + '|' + state.group + '|' + state.collection + '|' +
          state.gameId + '|' + state.articleId + '|' + state.jump;
      };
      var was = key();
      applyHash();
      if (was === key()) return;
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

      // A heroless route has nothing for the bar to float on, so it
      // is stuck at rest. Without this clause the scroll handler
      // would take back what paintChrome just set the moment
      // anything asked it to read.
      var want = y > 24 || document.body.classList.contains('hd-heroless');
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
    kind: null, cat: null, catList: null, creator: null, len: null, cover: null, desc: null,
    stars: null, fav: null, queue: null, live: null, del: null, prev: null, prevImg: null,
    prevTitle: null, prevSub: null, heading: null,
    editing: null, rating: 0, touched: null, lastFocus: null, open: false, dupeWarned: false
  };

  function grabComposer() {
    cmp.el = $('cmp'); cmp.scrim = $('cmpScrim'); cmp.form = $('cmpForm'); cmp.msg = $('cmpMsg');
    cmp.url = $('cmpUrl'); cmp.title = $('cmpTitleIn'); cmp.shelf = $('cmpShelf');
    cmp.kind = $('cmpKind'); cmp.cat = $('cmpCat'); cmp.catList = $('cmpCatList'); cmp.creator = $('cmpCreator');
    cmp.len = $('cmpLen'); cmp.cover = $('cmpCover'); cmp.desc = $('cmpDesc');
    cmp.stars = $('cmpStars'); cmp.fav = $('cmpFav'); cmp.queue = $('cmpQueue'); cmp.live = $('cmpLive'); cmp.del = $('cmpDel');
    cmp.prev = $('cmpPrev'); cmp.prevImg = $('cmpPrevImg'); cmp.prevTitle = $('cmpPrevTitle');
    cmp.prevSub = $('cmpPrevSub'); cmp.heading = $('cmpTitle');
    cmp.touched = new Set();
  }

  // Only ever fills a field the reader has left alone, and only
  // from the site's OWN oEmbed endpoint — no third-party metadata
  // service, which would mean every link pasted here being
  // reported to a stranger. With no endpoint, the host name and a
  // Title-Cased URL slug still beat an empty form.
  // THE PROVIDER TABLE LIVES IN vault-capture.js, and so does the
  // slug fallback. Two copies meant a provider added for the
  // Capture page silently missing from the composer, so there is
  // one of each and both paths call it.
  var titleFromSlug = function (u) { return C().titleFromSlug(u); };

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

    // fetchMeta ALWAYS resolves: a blocked, offline or private link
    // still answers with the hostname and a Title-Cased slug, so
    // there is no failure branch to write here and the form is
    // never left empty.
    C().fetchMeta(u).then(function (meta) {
      if (seq !== autofillSeq) return;
      fillIfUntouched('title', meta.title);
      fillIfUntouched('creator', meta.creator);
      if (!cmp.liveTouched && global.Vault.isLiveSignal(u, cmp.title.value || meta.title)) {
        cmp.live.classList.add('is-on'); paintToggles();
      }
      if (meta.cover && !cmp.touched.has('cover')) cmp.cover.value = meta.cover;
      paintPreview();
    });
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
    var lv = cmp.live.classList.contains('is-on');
    cmp.live.textContent = lv ? '● Live stream' : '○ Live stream';
    cmp.live.setAttribute('aria-pressed', String(lv));
  }

  // THE CATEGORY IS THE CHOICE. #cmpShelf keeps its id — AthDraft
  // scopes every draft by these ids, so renaming one throws away
  // half-typed work — but it holds a category now, and the storage
  // shelf is derived from it by homeShelf().
  //
  // '__new' reveals #cmpCat, which used to be the free-text
  // "Collection" field and is now the only way to make a category
  // that does not exist yet. A fixed set you cannot add to is a set
  // that will be wrong within a month.
  var NEW_CAT = '__new';

  function fillShelfSelect(selected) {
    var cats = H().allCats();
    cmp.shelf.innerHTML = cats.map(function (c) {
      return '<option value="' + attr(c) + '">' + esc(c) + '</option>';
    }).join('') + '<option value="' + NEW_CAT + '">＋ New category…</option>';
    cmp.shelf.value = cats.indexOf(selected) >= 0 ? selected : cats[0];
    paintNewCat(true);
  }

  // The text field only exists while "New category…" is selected.
  // Saying display twice: the UA's [hidden] loses to a display of
  // its own, which this page has been bitten by four times.
  function paintNewCat(quiet) {
    var on = cmp.shelf.value === NEW_CAT;
    var field = cmp.cat.closest('.vt-f') || cmp.cat;
    field.hidden = !on;
    field.style.display = on ? '' : 'none';
    if (on && !quiet) cmp.cat.focus();
  }

  // The datalist still suggests, for the handful of cases where
  // Damian is typing a name close to one that already exists.
  function fillCatList() {
    cmp.catList.innerHTML = H().allCats().map(function (c) {
      return '<option value="' + attr(c) + '">';
    }).join('');
  }

  // What the form says the category is, whichever control answered.
  function composerCategory() {
    return cmp.shelf.value === NEW_CAT ? cmp.cat.value.trim() : cmp.shelf.value;
  }

  function openComposer(opts) {
    opts = opts || {};
    var item = opts.item || null;
    // `cat` rides along so saveComposer can tell a category CHANGE
    // from a save that left it alone, which is what decides whether
    // the record moves shelf.
    cmp.editing = item
      ? { shelf: opts.shelf, id: item.id, cat: H().catName(item.category || '') }
      : null;
    cmp.touched.clear();
    cmp.dupeWarned = false;
    say('');

    cmp.heading.textContent = item ? 'Edit this entry' : 'Add to the archive';
    // Where you are standing is the guess. readsOf() answers with
    // categories now, so the first category of the current tab is
    // the sensible default — and HOME_SHELF turns that into the
    // storage shelf on save.
    var guess = opts.category ||
      // A Music sub-tab is ONE category already, and readsOf() does
      // not know 'cat:' keys — it would answer with Stories.
      (state.group.indexOf('cat:') === 0 ? H().catName(state.group.slice(4))
        : state.group !== 'all' ? H().readsOf(state.group)[0] : '');
    fillCatList();
    fillShelfSelect(item ? H().catName(item.category || '') : guess);

    cmp.url.value = item ? (item.url || '') : (opts.url || '');
    cmp.title.value = item ? (item.title || '') : '';
    cmp.kind.value = (item && item.kind) || 'auto';
    // #cmpCat only ever carries a category that does not exist yet;
    // an existing one is already selected in #cmpShelf above.
    cmp.cat.value = '';
    cmp.creator.value = item ? (item.creator || '') : '';
    cmp.len.value = item ? (item.lengthText || '') : '';
    cmp.cover.value = item ? (item.cover || '') : '';
    cmp.desc.value = item ? (item.description || '') : '';
    cmp.rating = item ? (Number(item.rating) || 0) : 0;
    cmp.fav.classList.toggle('is-on', !!(item && item.favorite));
    cmp.queue.classList.toggle('is-on', !!(item && item.queued));
    // A NEW entry guesses from its link once the URL is in — see
    // autofill(). An existing one shows exactly what is stored.
    cmp.live.classList.toggle('is-on', !!(item && item.live));
    cmp.liveTouched = !!item;
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
      // The regex IS the whitelist. Vault.update() is a bare
      // Object.assign with no field check of its own, so anything
      // this returns is what lands in storage and in Supabase.
      kind: /^(single|collection)$/.test(cmp.kind.value) ? cmp.kind.value : 'auto',
      category: composerCategory(),
      creator: cmp.creator.value.trim(),
      lengthText: cmp.len.value.trim(),
      cover: cmp.cover.value.trim(),
      description: cmp.desc.value.trim(),
      rating: cmp.rating,
      favorite: cmp.fav.classList.contains('is-on'),
      queued: cmp.queue.classList.contains('is-on'),
      live: cmp.live.classList.contains('is-on')
    };
  }

  function saveComposer(keepOpen) {
    var f = readComposer();
    if (!f.title && !f.url) {
      say('Give it a title or a link — everything else is optional.', 'bad');
      cmp.title.focus();
      return false;
    }
    if (!f.category) {
      say('Give the new category a name, or pick one from the list.', 'bad');
      cmp.cat.focus();
      return false;
    }
    // THE SHELF IS DERIVED, and only a category CHANGE moves it.
    // Leaving the category alone keeps the record exactly where it
    // is, so a shelf Damian chose by hand survives an edit to the
    // title. Games never moves: a game record is a different shape
    // and homeShelf() never answers with that shelf.
    var shelf;
    if (!cmp.editing) shelf = H().homeShelf(f.category);
    else if (cmp.editing.shelf === 'games') shelf = 'games';
    else if (f.category !== cmp.editing.cat) shelf = H().homeShelf(f.category);
    else shelf = cmp.editing.shelf;
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
      // Shelf, collection and KIND survive a "save and add
      // another" — a batch of playlists is a batch of playlists,
      // and the three of them together are where the next item is
      // being filed rather than what it is.
      var keptShelf = shelf, keptCat = f.category;
      cmp.editing = null; cmp.touched.clear(); say('');
      ['url', 'title', 'creator', 'len', 'cover', 'desc'].forEach(function (k) { cmp[k].value = ''; });
      cmp.rating = 0;
      cmp.fav.classList.remove('is-on'); cmp.queue.classList.remove('is-on');
      cmp.live.classList.remove('is-on'); cmp.liveTouched = false;
      paintStars(); paintToggles(); paintPreview();
      cmp.heading.textContent = 'Add to the archive';
      cmp.del.hidden = true;
      fillCatList(); fillShelfSelect(keptCat);
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
    if (wasGame) A().removeForGame(wasId);   // see ACTS.del — two keys, kept outside the record
    closeComposer(true);
    U().toast('Deleted');
    if (state.route === 'game' && wasGame && state.gameId === wasId) location.hash = '#/';
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
    cmp.shelf.addEventListener('change', function () { paintNewCat(); paintPreview(); });
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
    cmp.live.onclick = function () {
      cmp.live.classList.toggle('is-on'); cmp.liveTouched = true; paintToggles();
    };
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
    // The editor's own listeners, delegated on #vtRoot once — so a
    // repaint never has to re-bind a contenteditable.
    A().bind();
    C().bind();

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
          // Same courtesy for the Capture page: a pull that
          // re-creates #vtRoot would take a pasted list with it.
          if (C().busyTyping()) return;
          repaint();
        }
      });
    }

    // ONE GATE, TWO JOBS, IN THIS ORDER.
    //
    // The category merge runs BEFORE the seeder, and both run
    // after the pull has had its beat. Migrating ahead of the
    // pull would rewrite a stale local copy and push it over
    // good remote data.
    //
    // The pass is LOCAL-flagged, so every device runs it once —
    // see vault-data.js §THE CATEGORY MERGE for why a synced
    // flag would strand records on the phone.
    var afterPull = function () {
      var r = global.Vault.migrateCategoriesV1();
      if (r && r.moved) {
        repaint();
        U().toast('Re-filed ' + r.moved + (r.moved === 1 ? ' entry' : ' entries') +
          ' into the new categories');
      }
      // The one-time Live Streams pre-tick: adds `live: true` to
      // records that have never had the field and whose link or
      // title says they stream. Local-flagged like the merge above.
      var lv = global.Vault.markLiveV1 && global.Vault.markLiveV1();
      if (lv && lv.marked) repaint();
      // Additive: seeds only shelves that are EMPTY, merging by
      // canonical URL. It never deletes, so anything removed here
      // stays removed.
      global.Vault.maybeSeedAfterSyncAttempt(remoteRef, function () {
        // A fresh device's records arrive HERE, after the pre-tick
        // above found an empty library and left itself unflagged.
        if (global.Vault.markLiveV1) global.Vault.markLiveV1();
        repaint();
      });
    };
    if (remoteRef.applied) afterPull(); else setTimeout(afterPull, 1200);
  }

  global.HDApp = {
    state: state, form: form, repaint: repaint, navigate: navigate,
    openDetail: openDetail, openComposer: openComposer, ACTS: ACTS
  };

  document.addEventListener('DOMContentLoaded', function () {
    (global.LocalStoreIDB ? global.LocalStoreIDB.ready() : Promise.resolve()).then(boot);
  });
})(window);
