// =============================================================
// vault-views.js — HOUSE DAMULA's renderers.
//
//   window.HD
//
// Every function here BUILDS A STRING. Nothing in this file
// listens to anything, writes anything, or knows the router
// exists; vault-app.js owns behaviour and vault-data.js owns
// truth. That split is why a view can be rebuilt four hundred
// cards at a time on a keystroke without leaking a listener.
//
// ONE GROUND, ONE CARD.
// Every band is .hd-night now — the neutral warm black #0b0907,
// the colour the About page was already on. It ran ivory, then
// Sepia Black, then this; the ground-flip machinery survived both
// changes untouched because no component ever names a colour, it
// names --hd-bg. .hd-sepia is still DEFINED in the stylesheet and
// no band uses it: re-grounding one is still a single word.
//
// So card() takes a SHAPE, not a palette. There is no second card
// component and there must never be one.
//
// EVERY VIEW OPENS ON pageHero(), including the home page, which
// had a second hero of its own until 2026-09-03. Full-bleed,
// edge to edge, with the floating pill nav over it. See
// Downloads/cb92e312e4b74cf8d1acc513866185e1.mp4.
// =============================================================

(function (global) {
  'use strict';

  var U = function () { return global.AscUI; };
  var esc = function (s) { return U().esc(s); };
  var attr = function (s) { return U().attr(s); };

  // ── §SHELVES ───────────────────────────────────────────────
  // A TAB is not the same thing as a shelf. `reads` is the list of
  // real storage shelves a name shows, and it is usually one — but
  // Horror shows creepypasta + trueHorror and Spicy shows spicy +
  // immersive, because each pair is one subject and was never
  // worth two names.
  //
  // `hidden` takes a shelf out of the INTERFACE and nothing else.
  // Its storage key still exists, still holds what it held, and
  // the composer can still file to it by name. Reading and Anime
  // are hidden because Damian asked for them later; putting them
  // back is deleting two words.
  //
  // `noun` is what the home hero calls this shelf when it is the
  // featured thing — "FEATURED FILM" in the reference.
  var SHELVES = [
    { key: 'watch', label: 'Watching', noun: 'Featured film', sigil: 'sg-play',
      tint: '#e0a765', verb: 'Watch', reads: ['watch'] },
    { key: 'podcasts', label: 'Podcasts', noun: 'Featured series', sigil: 'sg-wave',
      tint: '#c3c6c6', verb: 'Listen', reads: ['podcasts'] },
    { key: 'horror', label: 'Horror', noun: 'Featured tale', sigil: 'sg-eye',
      tint: '#a9764c', verb: 'Watch', reads: ['creepypasta', 'trueHorror'] },
    { key: 'spicy', label: 'Spicy', noun: 'Featured', sigil: 'sg-flame',
      tint: '#b8796a', verb: 'Listen', reads: ['spicy', 'immersive'] },
    { key: 'playlists', label: 'Music', noun: 'Featured record', sigil: 'sg-moon',
      tint: '#c99a63', verb: 'Play', reads: ['playlists'] },
    { key: 'games', label: 'Games', noun: 'Current obsession', sigil: 'sg-pad',
      tint: '#8fa39b', verb: 'Play', reads: ['games'] },
    { key: 'reading', label: 'Reading', noun: 'Featured book', sigil: 'sg-book',
      tint: '#d6d2cb', verb: 'Read', reads: ['reading'], hidden: true },
    { key: 'anime', label: 'Anime', noun: 'Featured series', sigil: 'sg-spark',
      tint: '#a98b9a', verb: 'Watch', reads: ['anime'], hidden: true }
  ];

  var LIVE = function () { return SHELVES.filter(function (s) { return !s.hidden; }); };

  // Every hash this page has ever answered to. The three on the
  // left are storage shelves that stopped being tabs when Horror
  // and Spicy merged; the rest are view routes two rebuilds have
  // now removed. A bookmark to any of them lands somewhere real.
  var TAB_ALIAS = {
    creepypasta: 'horror', trueHorror: 'horror', immersive: 'spicy',
    home: 'all', discover: 'all', stats: 'all', favorites: 'all',
    reading: 'all', anime: 'all'
  };

  var SHELF_NAME = {
    podcasts: 'Podcasts', creepypasta: 'Creepypasta', trueHorror: 'True stories',
    spicy: 'Spicy', immersive: 'Immersive', watch: 'Watching',
    playlists: 'Music', reading: 'Reading', anime: 'Anime', games: 'Games'
  };

  // Category order, so collections land in the sequence Damian
  // chose rather than alphabetically. Anything not named here
  // ranks last and sorts alphabetically among its own kind.
  var CAT_ORDER = [
    'Learning', 'Photography / Videography', 'True Crime', 'Business', 'Writing',
    'Creepypasta', 'Compilations',
    'Chill', 'Binaural Beats', 'Dark / Gothic / Horror / Romance', 'EDM / Electronic', 'Fantasy',
    'Gaming', 'Scary Videos', 'Vlog-Like', 'Favorite Videos', 'Other',
    'Immersive Experience', 'ASMR'
  ];
  function catRank(k) { var i = CAT_ORDER.indexOf(k); return i < 0 ? 99 : i; }

  var tabKey = function (k) { return TAB_ALIAS[k] || k; };
  var shelfOf = function (k) {
    return SHELVES.filter(function (s) { return s.key === tabKey(k); })[0] || SHELVES[0];
  };
  var readsOf = function (t) { return (typeof t === 'string' ? shelfOf(t) : t).reads || []; };

  // Which tab owns a storage shelf. Built once, because it is
  // asked on every one of four hundred cards.
  var TAB_OF_SHELF = {};
  SHELVES.forEach(function (t) {
    t.reads.forEach(function (sh) { TAB_OF_SHELF[sh] = t.key; });
  });

  function sig(id, sz) {
    return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 16 16" fill="none" ' +
      'stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }

  // ── §THE RECORD, AS A CARD ─────────────────────────────────
  // Adapting here rather than reaching into the record everywhere
  // keeps the views readable and the storage shape free to move.
  function toCard(v, shelf, tabk) {
    return {
      id: v.id, shelf: shelf, tab: tabk,
      url: v.url || '', title: v.title || 'Untitled', creator: v.creator || '',
      cover: v.cover || '', len: v.lengthText || '',
      rating: Number(v.rating) || 0,
      fav: v.favorite === true, queued: v.queued === true,
      cat: v.category || 'Uncategorised', desc: v.description || '',
      opened: v.lastOpenedAt || 0, opens: v.openCount || 0, made: v.createdAt || 0,
      hero: v.hero || ''
    };
  }

  // Everything, as cards. Reads at CALL time, never at parse time:
  // the IndexedDB shim hydrates asynchronously, so an array
  // captured when this file first runs is the pre-hydration
  // snapshot. Hidden shelves are skipped so every count on screen
  // matches what is on screen.
  function allCards() {
    var out = [];
    LIVE().forEach(function (t) {
      t.reads.forEach(function (sh) {
        global.Vault.list(sh).forEach(function (v) { out.push(toCard(v, sh, t.key)); });
      });
    });
    return out;
  }

  var recordOf = function (shelf, id) {
    return (global.Vault.list(shelf) || []).filter(function (x) { return x.id === id; })[0] || null;
  };

  // ── §ART ───────────────────────────────────────────────────
  // The references are full of 1920px cinematic stills. Damian's
  // covers are mostly 480x360 YouTube thumbnails, and a 480px
  // image stretched across a 900px hero looks like a mistake
  // rather than a photograph.
  //
  // YouTube keeps a 1280x720 maxresdefault for most videos at a
  // derivable URL, so a big surface asks for that and falls back
  // to the hqdefault it already has when the big one 404s. The
  // fallback is an attribute, not a closure: `error` does not
  // bubble, so vault-app.js catches it in the CAPTURE phase for
  // the whole page at once. Nothing here calls out to a metadata
  // service — the same rule the composer has always followed.
  function ytId(u) {
    try {
      var url = new URL(u), h = url.hostname.replace(/^www\./, '');
      if (h === 'youtu.be') return url.pathname.slice(1).split('/')[0] || '';
      if (!/youtube\.com$/.test(h)) return '';
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      var m = url.pathname.match(/\/(shorts|embed|live)\/([^/?#]+)/);
      return m ? m[2] : '';
    } catch (e) { return ''; }
  }

  // The best art this item can offer at a large size, and what to
  // fall back to when it does not exist.
  function bigArt(d) {
    if (d.hero) return { src: d.hero, alt: d.cover || '' };
    var id = ytId(d.url);
    if (id) return { src: 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg', alt: d.cover || '' };
    return { src: d.cover, alt: '' };
  }

  function artImg(d, cls, eager) {
    var a = bigArt(d);
    if (!a.src) return '';
    return '<img class="' + cls + '" src="' + attr(a.src) + '" alt=""' +
      (a.alt ? ' data-fallback="' + attr(a.alt) + '"' : '') +
      (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async">';
  }

  // The link, as something you can read. A card that hides where
  // it goes is a card you have to click to find out.
  function shownUrl(u) {
    if (!u) return '';
    try {
      var url = new URL(u);
      var seg = url.pathname.split('/').filter(Boolean)[0] || '';
      var s = url.hostname.replace(/^www\./, '') + (seg ? '/' + seg : '');
      return s.length > 34 ? s.slice(0, 33) + '…' : s;
    } catch (e) {
      return String(u).replace(/^https?:\/\/(www\.)?/, '').slice(0, 34);
    }
  }

  var yearOf = function (d) { return d.made ? new Date(d.made).getFullYear() : ''; };

  // ── §ORNAMENT ──────────────────────────────────────────────
  // A hairline with a four-point star on it. The one drawn
  // flourish in this design, and it earns its place by marking
  // exactly one thing: the end of a page's title block.
  function orn(cls) {
    return '<div class="hd-orn ' + (cls || '') + '" aria-hidden="true">' +
      '<i></i><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
      'stroke-width="1" stroke-linejoin="round"><use href="#sg-orn"></use></svg><i></i></div>';
  }

  function eyebrow(text) { return '<p class="hd-eyebrow">' + esc(text) + '</p>'; }

  // ── §THE HERO ──────────────────────────────────────────────
  // ONE component, on EVERY view including the home page. The
  // home page had a second, asymmetric hero of its own until
  // 2026-09-03; two heroes on one site is one too many, and the
  // thing that made the home one worth keeping — the featured
  // item — survives here as the card.
  //
  // Its anatomy is read frame by frame off
  // Downloads/cb92e312e4b74cf8d1acc513866185e1.mp4:
  //
  //     ┌───────────────────────────────────────────────┐
  //     │              ( floating pill nav )            │  ← chrome, in vault.html
  //     │  HEADLINE                        ┌──────────┐ │
  //     │  three ragged lines              │ the card │ │
  //     │                                  └──────────┘ │
  //     │                                               │
  //     │  the copy                        ( chips )    │
  //     └───────────────────────────────────────────────┘
  //
  // FULL-BLEED, AND STILL NO BOUNDARIES — more so than before.
  // The plate now runs to all four edges of the viewport instead
  // of being vignetted into the ground, which is the strongest
  // possible answer to "no boundaries": there is no edge to see
  // because the picture never stops before the screen does. Only
  // the bottom keeps a fade, and only so the band beneath joins
  // without a line.
  //
  // The artwork is one file for every page. It is the same room
  // the studio has always opened on, and using it everywhere is
  // what makes six views read as one house.
  function pageHero(o) {
    var feat = o.card === null ? null : (o.card || featuredCard());
    return '<header class="hd-phero" data-parallax>' +
      '<div class="hd-phero__art" aria-hidden="true">' +
        '<img class="hd-phero__img" src="images_by_admin/vault/hero-house.jpg" alt="" ' +
          'width="736" height="1308" fetchpriority="high" decoding="async">' +
        '<span class="hd-phero__glow"></span>' +
        '<span class="hd-phero__veil"></span>' +
      '</div>' +

      '<div class="hd-phero__in">' +
        '<div class="hd-phero__say">' +
          (o.back ? '<a class="hd-phero__back" href="' + attr(o.back.href) + '">' +
            esc(o.back.label) + '</a>' : '') +
          (o.eyebrow ? '<p class="hd-phero__e">' + esc(o.eyebrow) + '</p>' : '') +
          '<h1 class="hd-phero__t">' + esc(o.title) + '</h1>' +
        '</div>' +

        (feat ? heroCard(feat) : '') +

        (o.caption ? '<p class="hd-phero__c">' + U().escLines(o.caption) + '</p>' : '') +
        // A full-viewport hero hides the whole page, so it has to say
        // there is one. The chips are the real way in; this is just
        // the acknowledgement that the picture is not the end.
        '<span class="hd-phero__scroll" aria-hidden="true"><i></i>Scroll</span>' +
        heroChips() +
      '</div>' +
      '<span class="hd-phero__rule" aria-hidden="true"></span>' +
    '</header>';
  }

  // The floating card at the hero's top right. It is the FEATURED
  // item — the one piece of the old home hero worth carrying over
  // — so every page opens on something real out of the collection
  // rather than on decoration. "Feature this" in any detail sheet
  // is still the whole editing surface for it.
  function heroCard(d) {
    var t = shelfOf(d.tab);
    return '<button type="button" class="hd-hcard" data-act="open" ' +
        'data-shelf="' + attr(d.shelf) + '" data-id="' + attr(d.id) + '" ' +
        'data-url="' + attr(d.url) + '">' +
      '<span class="hd-hcard__art">' +
        (d.cover
          ? '<img src="' + attr(d.cover) + '" alt="" loading="lazy" decoding="async">'
          : '<span class="hd-hcard__none" style="color:' + t.tint + '">' + sig(t.sigil, 22) + '</span>') +
      '</span>' +
      '<span class="hd-hcard__in">' +
        '<span class="hd-hcard__e">' + esc(t.noun) + '</span>' +
        '<span class="hd-hcard__t">' + esc(d.title) + '</span>' +
        '<span class="hd-hcard__go">' + t.verb + ' it &#8594;</span>' +
      '</span>' +
    '</button>';
  }

  // The chips at the hero's bottom right. In the reference they
  // are decoration; here they are the shelves, which is the one
  // thing a full-viewport hero owes the reader — a way into the
  // library that does not require scrolling past the picture
  // first.
  function heroChips() {
    var counts = global.Vault.counts();
    return '<nav class="hd-chips" aria-label="Shelves">' +
      LIVE().map(function (t) {
        var n = t.reads.reduce(function (a, sh) { return a + (counts[sh] || 0); }, 0);
        return '<a class="hd-chip2" href="#/archive/' + t.key + '">' +
          sig(t.sigil, 11) + esc(t.label) + '<i>' + n + '</i></a>';
      }).join('') +
    '</nav>';
  }

  function arrow(label) {
    return '<span class="hd-arrow">' + (label ? esc(label) + ' ' : '') +
      '<svg width="26" height="8" viewBox="0 0 26 8" fill="none" stroke="currentColor" ' +
      'stroke-width="1" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M0 4h24M20.5 1 24 4l-3.5 3"></path></svg></span>';
  }

  // ── §THE CARD ──────────────────────────────────────────────
  // ONE component, five shapes, two grounds.
  //
  //   feature / tall / wide   art fills the tile, text sits ON it
  //   row                     art left, text right, on the ground
  //   grid                    art on top, text under, on the ground
  //
  // The overlaid three are always light-on-photo whatever band
  // they sit in — that is a property of being on a photograph,
  // not of the section. `row` and `grid` inherit --hd-fg from the
  // band, which is the whole ground-flip.
  //
  // Built as a STRING and wired by delegation. Four hundred cards
  // at once is four hundred nodes' worth of listeners otherwise,
  // and that is the difference between a page that paints and a
  // page that stutters.
  function card(d, i, shape) {
    var t = shelfOf(d.tab);
    var big = shape === 'feature' || shape === 'tall' || shape === 'wide';
    var art = (big ? artImg(d, 'hd-card__img', false) : '') ||
      (!big && d.cover
        ? '<img class="hd-card__img" src="' + attr(d.cover) + '" alt="" loading="lazy" decoding="async">'
        : '');
    if (!art) {
      art = '<span class="hd-card__none" style="color:' + t.tint + '">' + sig(t.sigil, 42) + '</span>';
    }

    var meta = [t.label, yearOf(d)].filter(Boolean).join(' · ');
    var sub = [d.creator, d.len].filter(Boolean).map(esc).join(' · ');
    var tick = 'M3.6 8.4 6.5 11.3 12.4 5.2', plus = 'M8 3.6v8.8M3.6 8h8.8';

    // The stagger is capped. A group here can be a hundred and
    // sixty cards, and 160 x 26ms is a four-second wait for the
    // last one. Twelve steps reads as an arrival either way.
    return '<article class="hd-card hd-card--' + shape + ' ' + U().rvlClass() + '"' +
        U().rvlStyle(Math.min(i, 11)) + '>' +
      '<button type="button" class="hd-card__hit" data-act="open" data-shelf="' + attr(d.shelf) +
        '" data-id="' + attr(d.id) + '" data-url="' + attr(d.url) + '">' +
        '<span class="hd-card__art">' + art + '</span>' +
        '<span class="hd-card__body">' +
          '<span class="hd-card__title">' + esc(d.title) + '</span>' +
          '<span class="hd-card__meta">' + esc(meta) + '</span>' +
          (sub ? '<span class="hd-card__sub">' + sub + '</span>' : '') +
          (d.url ? '<span class="hd-card__url">' + esc(shownUrl(d.url)) + '</span>' : '') +
          (d.rating
            ? '<span class="hd-card__rate" role="img" aria-label="Rated ' + d.rating + ' of 5">' +
              '<i style="--w:' + (d.rating / 5 * 100) + '%"></i><b>' +
              Math.round(d.rating / 5 * 100) + '%</b></span>'
            : '') +
          arrow('') +
        '</span>' +
      '</button>' +
      '<span class="hd-card__acts">' +
        '<button type="button" class="hd-chip' + (d.fav ? ' is-on' : '') + '" data-act="star"' +
          ' data-shelf="' + attr(d.shelf) + '" data-id="' + attr(d.id) + '"' +
          ' aria-pressed="' + (d.fav ? 'true' : 'false') + '"' +
          ' aria-label="' + (d.fav ? 'Remove from favourites' : 'Add to favourites') + '">' +
          (d.fav ? '★' : '☆') + '</button>' +
        '<button type="button" class="hd-chip' + (d.queued ? ' is-on' : '') + '" data-act="queue"' +
          ' data-shelf="' + attr(d.shelf) + '" data-id="' + attr(d.id) + '"' +
          ' aria-pressed="' + (d.queued ? 'true' : 'false') + '"' +
          ' aria-label="' + (d.queued ? 'Take out of Tonight' : 'Add to Tonight') + '">' +
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
          'stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="' +
          (d.queued ? tick : plus) + '"></path></svg></button>' +
        '<button type="button" class="hd-chip" data-act="info" data-shelf="' + attr(d.shelf) +
          '" data-id="' + attr(d.id) + '" aria-label="Details about ' + attr(d.title) + '">' +
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
          'stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.2">' +
          '</circle><path d="M8 7.3v4"></path><circle cx="8" cy="4.9" r=".75" fill="currentColor" ' +
          'stroke="none"></circle></svg></button>' +
      '</span>' +
    '</article>';
  }

  // ── §PROMINENCE ────────────────────────────────────────────
  // What earns the big tile. Rated first, then things with a
  // cover (a mosaic slot filled by a sigil is a hole), then
  // recently opened. Deterministic, so the Archive does not
  // reshuffle itself under you between two repaints.
  function byProminence(list) {
    return list.slice().sort(function (a, b) {
      return (b.rating - a.rating) ||
        ((b.cover ? 1 : 0) - (a.cover ? 1 : 0)) ||
        (b.opened - a.opened) ||
        a.title.localeCompare(b.title);
    });
  }

  // =============================================================
  // §THE HOUSE — #/
  // =============================================================
  // The home page had a hero of its own — asymmetric, with the
  // featured item's own artwork behind it — until 2026-09-03. It
  // is gone: every view now opens on the same pageHero(), which
  // is what "all of the pages look like this" has to mean if it
  // means anything. The featured item was the part worth keeping
  // and it is now the hero's card, on every page rather than one.

  // The four ways in. Each tile's art is the best-rated cover on
  // that shelf, so the home page illustrates itself out of the
  // collection instead of out of an assets folder.
  function wayTile(t, counts) {
    var pool = [];
    t.reads.forEach(function (sh) {
      global.Vault.list(sh).forEach(function (v) { pool.push(toCard(v, sh, t.key)); });
    });
    var pick = byProminence(pool.filter(function (d) { return d.cover; }))[0];
    var n = t.reads.reduce(function (a, sh) { return a + (counts[sh] || 0); }, 0);
    return '<a class="hd-way" href="#/archive/' + t.key + '">' +
      '<span class="hd-way__art" aria-hidden="true">' +
        (pick ? artImg(pick, 'hd-way__img', false)
              : '<span class="hd-card__none" style="color:' + t.tint + '">' + sig(t.sigil, 34) + '</span>') +
      '</span>' +
      '<span class="hd-way__in">' +
        '<span class="hd-way__name">' + esc(t.label) + '</span>' +
        '<span class="hd-way__n">' + n + (n === 1 ? ' entry' : ' entries') + '</span>' +
        arrow('') +
      '</span></a>';
  }

  function viewHome() {
    var counts = global.Vault.counts();
    var house = HOUSE();
    var ways = ['watch', 'podcasts', 'playlists', 'games'].map(shelfOf);

    return pageHero({
        eyebrow: 'Currently in the archive',
        title: house.headline,
        caption: house.blurb
      }) +

      '<section class="hd-band hd-night hd-credo">' +
        '<div class="hd-credo__say">' +
          eyebrow('A private entertainment collection') +
          '<h2 class="hd-display hd-display--mid">' + esc(house.credo) + '</h2>' +
          '<p class="hd-prose">' + esc(house.blurb) + '</p>' +
          '<div class="hd-credo__seal">' +
            '<span class="hd-mono hd-mono--big" aria-hidden="true">' +
              '<svg viewBox="0 0 40 34" fill="none" stroke="currentColor" stroke-width="1.15" ' +
              'stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M4 3.5v27M17.5 3.5v27M4 17h13.5"></path>' +
              '<path d="M17.5 3.5h5.6a12 13.5 0 0 1 0 27h-5.6"></path></svg></span>' +
            '<span class="hd-credo__bar" aria-hidden="true"></span>' +
            '<span class="hd-credo__words">' +
              house.words.map(function (row) {
                return '<span>' + row.map(function (w) {
                  return '<b>' + esc(w) + '</b>';
                }).join('<i aria-hidden="true">•</i>') + '</span>';
              }).join('') +
            '</span>' +
          '</div>' +
          '<button type="button" class="hd-link hd-link--quiet" data-act="edit-house">' +
            'Edit this page’s words</button>' +
        '</div>' +
        '<div class="hd-ways">' + ways.map(function (t) { return wayTile(t, counts); }).join('') + '</div>' +
      '</section>';
  }

  // =============================================================
  // §THE ARCHIVE — #/archive, #/archive/<shelf>, #/collection/<x>
  // =============================================================
  // Ivory. This is where all the media sits, and it is one page:
  // the mosaic is the TOP of the archive, not a replacement for
  // it, and every remaining item continues underneath in a plain
  // grid. Four hundred things still all fit on one page.
  function viewArchive(state) {
    var items = poolFor(state);
    var hero = state.collection
      ? pageHero({
          eyebrow: 'A collection', title: state.collection,
          caption: items.length + (items.length === 1 ? ' entry' : ' entries') + ' kept together.',
          back: { href: '#/collections', label: 'All collections' }
        })
      : pageHero(
          // A shelf is a destination, so it says its own name.
          // "The Archive" over a page of nothing but games is a
          // heading that describes the building rather than the room.
          state.shelf === 'all'
            ? { eyebrow: 'A private entertainment collection', title: 'The Archive',
                caption: 'What we preserve shapes what remains.' }
            : { eyebrow: 'In the archive', title: shelfOf(state.shelf).label,
                caption: SHELF_CAPTION[state.shelf] || 'What we preserve shapes what remains.' }
        );
    var ranked = byProminence(items);
    // Seven, not six: the seventh slot was the Journal tile until
    // the Journal was removed on 2026-09-03, and a mosaic with a
    // hole in the corner is worse than one more thing to look at.
    var mos = ranked.slice(0, 7);
    var rest = ranked.slice(7);

    // Tabs are links, not chips: a tab is a place, and the
    // reference draws it as text with a rule under it.
    var counts = global.Vault.counts();
    var countOf = function (t) {
      return t.reads.reduce(function (a, sh) { return a + (counts[sh] || 0); }, 0);
    };
    var total = LIVE().reduce(function (a, t) { return a + countOf(t); }, 0);
    var tab = function (key, label, n) {
      return '<a class="hd-tab' + (state.shelf === key ? ' is-on' : '') + '" href="#/archive' +
        (key === 'all' ? '' : '/' + key) + '"' + (state.shelf === key ? ' aria-current="page"' : '') +
        '>' + esc(label) + '<i>' + n + '</i></a>';
    };

    var tabs = state.collection ? '' :
      '<nav class="hd-tabs" aria-label="Shelves">' +
        tab('all', 'All', total) +
        LIVE().map(function (t) { return tab(t.key, t.label, countOf(t)); }).join('') +
      '</nav>';

    return hero +
      '<section class="hd-band hd-night hd-archive">' +
      tabs +
      utility(state, items.length) +

      (items.length
        ? '<div class="hd-mosaic">' +
            // A GAME IS NOT A LINK, so the Games shelf gets its own
            // way in and it sits where a game would sit. Everywhere
            // else, adding is the composer in the corner; here it is
            // a form that asks for a status and a playtime and then
            // hands you the page.
            (state.shelf === 'games' ? addGameTile() : '') +
            mos.map(function (d, i) { return card(d, i, MOSAIC[i]); }).join('') +
          '</div>' +
          (rest.length
            ? '<div class="hd-grid">' +
                rest.map(function (d, i) { return card(d, i, 'grid'); }).join('') +
              '</div>'
            : '')
        : emptyArchive(state)) +
    '</section>';
  }

  // Borrows .hd-vid--add's dashed outline from the game page's own
  // video rail rather than inventing a second "add" vocabulary.
  function addGameTile() {
    return '<button type="button" class="hd-addgame" data-act="add-game">' +
      '<span class="hd-addgame__mark" aria-hidden="true">' + sig('sg-pad', 26) + '</span>' +
      '<span class="hd-addgame__t">Add a game</span>' +
      '<span class="hd-addgame__d">Title, studio, status, playtime — then its own page.</span>' +
    '</button>';
  }

  // The mosaic's shapes, in the order image 2 draws them. The
  // spans themselves live in the stylesheet, keyed off these
  // classes, so re-cutting the grid is a CSS change and not a
  // rewrite of this file.
  // One line per shelf, so a filtered archive reads as a room
  // rather than as the same page with fewer things on it.
  var SHELF_CAPTION = {
    watch: 'Everything worth sitting down for.',
    podcasts: 'Voices to keep the room company.',
    horror: 'The stories that are better after dark.',
    spicy: 'Kept quietly, and on purpose.',
    playlists: 'Rooms made of sound.',
    games: 'Worlds with a door you can close behind you.'
  };

  var MOSAIC = ['feature', 'tall', 'wide', 'row', 'row', 'row', 'row'];

  function emptyArchive(state) {
    if (state.q || state.favOnly) {
      return '<p class="hd-empty"><strong>Nothing matches.</strong>' +
        'Clear the search, or turn Starred off.</p>';
    }
    // An empty state that gives advice you cannot take from the
    // page you are on is not an empty state, it is a dead end. On
    // Games the advice IS the button.
    if (state.shelf === 'games') {
      return '<p class="hd-empty"><strong>No games yet.</strong>' +
        'A game is not a link — it gets a page of its own, with videos, guides and ' +
        'a journal. Start one.</p>' +
        '<div class="hd-mosaic">' + addGameTile() + '</div>';
    }
    return '<p class="hd-empty"><strong>This shelf is empty.</strong>' +
      'Paste a link, or fill the form in by hand — a title is enough to start with.</p>';
  }

  // The utility line. Everything the old toolbar did, at the
  // weight of a caption: a filtered library must never be able to
  // look like an empty one, so the query is a token you can see.
  function utility(state, n) {
    var opt = function (v, l, cur) {
      return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + l + '</option>';
    };
    return '<div class="hd-util">' +
      '<span class="hd-util__n">' + n + (n === 1 ? ' entry' : ' entries') + '</span>' +
      (state.q
        ? '<button type="button" class="hd-token" data-act="clear-q">“' + esc(state.q) +
          '” <i aria-hidden="true">×</i></button>'
        : '') +
      '<span class="hd-util__sp"></span>' +
      '<button type="button" class="hd-util__b' + (state.favOnly ? ' is-on' : '') + '" ' +
        'data-act="favonly" aria-pressed="' + state.favOnly + '">' +
        (state.favOnly ? '★' : '☆') + ' Starred</button>' +
      '<label class="hd-util__sel"><span class="hd-sr">Sort</span>' +
        '<select data-act="sort" id="hdSort">' +
          opt('shelf', 'As filed', state.sort) + opt('new', 'Newest', state.sort) +
          opt('az', 'A–Z', state.sort) + opt('rating', 'Rating', state.sort) +
          opt('opened', 'Last opened', state.sort) +
        '</select></label>' +
      '<button type="button" class="hd-util__b" data-act="surprise">Surprise me</button>' +
    '</div>';
  }

  // =============================================================
  // §COLLECTIONS — #/collections
  // =============================================================
  function viewCollections() {
    var map = {};
    allCards().forEach(function (d) {
      if (!map[d.cat]) map[d.cat] = [];
      map[d.cat].push(d);
    });
    var cats = Object.keys(map).sort(function (a, b) {
      return catRank(a) - catRank(b) || a.localeCompare(b);
    });

    return pageHero({
        eyebrow: 'The archive, cut',
        title: 'Collections',
        caption: cats.length + ' ways of returning to the same room.'
      }) +
      '<section class="hd-band hd-night hd-archive">' +
      (cats.length
        ? '<div class="hd-cols">' + cats.map(function (c, i) {
            var top = byProminence(map[c].filter(function (d) { return d.cover; })).slice(0, 2);
            return '<a class="hd-col ' + U().rvlClass() + '"' + U().rvlStyle(Math.min(i, 11)) +
              ' href="#/collection/' + encodeURIComponent(c) + '">' +
              '<span class="hd-col__art" aria-hidden="true">' +
                (top.length
                  ? top.map(function (d) {
                      return '<img src="' + attr(d.cover) + '" alt="" loading="lazy" decoding="async">';
                    }).join('')
                  : '<span class="hd-col__none"></span>') +
              '</span>' +
              '<span class="hd-col__in"><b>' + esc(c) + '</b>' +
                '<i>' + map[c].length + (map[c].length === 1 ? ' entry' : ' entries') + '</i></span>' +
              arrow('') + '</a>';
          }).join('') + '</div>'
        : '<p class="hd-empty"><strong>No collections yet.</strong>' +
          'Give something a collection name in the composer and it starts one.</p>') +
    '</section>';
  }

  // =============================================================
  // §THE JOURNAL WAS REMOVED — 2026-09-03
  // =============================================================
  // `#/journal` was a dated feed of every game's entries, merged
  // across the shelf. It is gone: the route, the nav item, the
  // mosaic tile that advertised it and every link into it.
  //
  // THE ENTRIES THEMSELVES ARE NOT GONE. `record.entries` is
  // untouched on every game, and the game page's fourth column
  // still lists them, still writes them, and now reads the full
  // set in a sheet instead of sending you to a page. Removing a
  // view is not the same as removing what it was a view OF.
  //
  // prettyDate stays because that column still dates its rows.
  function prettyDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return String(iso || '');
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
      .toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // =============================================================
  // §THE HOUSE'S NUMBERS — #/about
  // =============================================================
  // What the old ledger band carried, given a home rather than
  // deleted: the counts, the rating histogram, the queue.
  function viewAbout() {
    var all = allCards();
    var counts = global.Vault.counts();
    var shelves = Object.keys(counts).filter(function (k) { return counts[k] > 0; }).length;
    var starred = all.filter(function (d) { return d.fav; }).length;
    var queued = all.filter(function (d) { return d.queued; });
    var scored = all.filter(function (d) { return d.rating > 0; });
    var buckets = [5, 4, 3, 2, 1].map(function (n) {
      return { n: n, c: scored.filter(function (d) { return Math.round(d.rating) === n; }).length };
    });
    var top = Math.max.apply(null, [1].concat(buckets.map(function (b) { return b.c; })));
    var house = HOUSE();
    var read = function (v, l) { return '<div class="hd-read"><b>' + v + '</b><span>' + l + '</span></div>'; };

    return pageHero({
        eyebrow: 'House Damula', title: 'The House', caption: house.credo
      }) +
      '<section class="hd-band hd-night hd-archive hd-about">' +
      '<div class="hd-reads">' +
        read(all.length, 'Entries') + read(shelves, 'Shelves') +
        read(starred, 'Starred') + read(queued.length, 'Tonight') +
      '</div>' +
      '<div class="hd-about__two">' +
        '<div class="hd-panel">' +
          '<h2 class="hd-eyebrow">How you have been scoring things</h2>' +
          '<div class="hd-scale">' + buckets.map(function (b) {
            return '<div class="hd-scale__row"><span>' + '★'.repeat(b.n) + '</span>' +
              '<span class="hd-scale__t"><i style="--w:' + Math.round(b.c / top * 100) + '%"></i></span>' +
              '<b>' + b.c + '</b></div>';
          }).join('') + '</div>' +
          '<p class="hd-note">' + (scored.length ? scored.length + ' of ' + all.length + ' rated'
            : 'Nothing rated yet') + '.</p>' +
        '</div>' +
        '<div class="hd-panel">' +
          '<h2 class="hd-eyebrow">Tonight</h2>' +
          (queued.length
            ? '<ul class="hd-queue">' + queued.slice(0, 8).map(function (d) {
                return '<li><button type="button" data-act="open" data-shelf="' + attr(d.shelf) +
                  '" data-id="' + attr(d.id) + '" data-url="' + attr(d.url) + '">' +
                  esc(d.title) + '</button></li>';
              }).join('') + '</ul>' +
              (queued.length > 8 ? '<p class="hd-note">and ' + (queued.length - 8) + ' more.</p>' : '') +
              '<button type="button" class="hd-link hd-link--quiet" data-act="clearqueue">' +
              'Clear the queue</button>'
            : '<p class="hd-note">Nothing queued. The ＋ on any card puts it here.</p>') +
        '</div>' +
      '</div>' +
      '<div class="hd-panel">' +
        '<h2 class="hd-eyebrow">This page’s words</h2>' +
        '<p class="hd-note">The headline, the credo and the keywords on the home page are yours. ' +
        'Nothing here is hard-coded.</p>' +
        '<button type="button" class="hd-link" data-act="edit-house">' + arrow('Edit them') + '</button>' +
      '</div>' +
    '</section>';
  }

  // =============================================================
  // §HOUSE TEXT + FEATURED
  // =============================================================
  // Two small keys under the SAME `vault:` prefix, so the
  // snapshot, export, trash and shrink-guard layers all cover
  // them with no registration change.
  function store(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  var HOUSE_DEFAULT = {
    headline: 'Stories worth disappearing into.',
    credo: 'Curated with intention. Kept for a lifetime.',
    blurb: 'A personal archive for the stories, worlds, and ideas that move you. ' +
      'Organize, rediscover, and return to what matters.',
    words: [['Memory', 'Discovery', 'Inspiration'], ['Beauty', 'Depth', 'Meaning']]
  };

  function HOUSE() {
    var h = store('vault:house', null) || {};
    return {
      headline: h.headline || HOUSE_DEFAULT.headline,
      credo: h.credo || HOUSE_DEFAULT.credo,
      blurb: h.blurb || HOUSE_DEFAULT.blurb,
      words: Array.isArray(h.words) && h.words.length ? h.words : HOUSE_DEFAULT.words
    };
  }

  // Nothing featured means the archive picks: highest rated, with
  // a cover, deterministically. A house with an empty frame over
  // the fireplace is worse than one that chose for you.
  function featuredCard() {
    var pin = store('vault:featured', null);
    if (pin && pin.shelf && pin.id) {
      var r = recordOf(pin.shelf, pin.id);
      if (r) return toCard(r, pin.shelf, TAB_OF_SHELF[pin.shelf] || SHELVES[0].key);
    }
    var withArt = allCards().filter(function (d) { return d.cover; });
    return byProminence(withArt)[0] || null;
  }

  // =============================================================
  // §THE POOL
  // =============================================================
  function poolFor(state) {
    var out = [];
    if (state.collection) {
      out = allCards().filter(function (d) { return d.cat === state.collection; });
    } else {
      var tabs = state.shelf === 'all' ? LIVE() : [shelfOf(state.shelf)];
      tabs.forEach(function (t) {
        t.reads.forEach(function (sh) {
          global.Vault.list(sh).forEach(function (v) { out.push(toCard(v, sh, t.key)); });
        });
      });
    }
    if (state.favOnly) out = out.filter(function (d) { return d.fav; });
    var q = String(state.q || '').trim().toLowerCase();
    if (q) {
      out = out.filter(function (d) {
        return (d.title + ' ' + d.creator + ' ' + d.cat + ' ' + d.desc).toLowerCase().indexOf(q) >= 0;
      });
    }
    return sortItems(out, state.sort);
  }

  function sortItems(list, s) {
    if (s === 'new') return list.slice().sort(function (a, b) { return b.made - a.made; });
    if (s === 'az') return list.slice().sort(function (a, b) { return a.title.localeCompare(b.title); });
    if (s === 'rating') return list.slice().sort(function (a, b) {
      return b.rating - a.rating || a.title.localeCompare(b.title);
    });
    if (s === 'opened') return list.slice().sort(function (a, b) { return b.opened - a.opened; });
    return list;
  }

  global.HD = {
    SHELVES: SHELVES, LIVE: LIVE, TAB_ALIAS: TAB_ALIAS, SHELF_NAME: SHELF_NAME,
    CAT_ORDER: CAT_ORDER, catRank: catRank, MOSAIC: MOSAIC,
    tabKey: tabKey, shelfOf: shelfOf, readsOf: readsOf, TAB_OF_SHELF: TAB_OF_SHELF,
    toCard: toCard, allCards: allCards, recordOf: recordOf, poolFor: poolFor,
    byProminence: byProminence, sortItems: sortItems,
    sig: sig, orn: orn, eyebrow: eyebrow, arrow: arrow, card: card,
    heroCard: heroCard, heroChips: heroChips, addGameTile: addGameTile,
    ytId: ytId, bigArt: bigArt, artImg: artImg, shownUrl: shownUrl, yearOf: yearOf,
    prettyDate: prettyDate, pageHero: pageHero,
    store: store, HOUSE: HOUSE, HOUSE_DEFAULT: HOUSE_DEFAULT, featuredCard: featuredCard,
    viewHome: viewHome, viewArchive: viewArchive, viewCollections: viewCollections,
    viewAbout: viewAbout
  };
})(window);
