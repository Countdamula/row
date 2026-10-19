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
// EVERY VIEW OPENS ON pageHero(). Full-bleed, edge to edge, with
// the floating pill nav over it. See
// Downloads/cb92e312e4b74cf8d1acc513866185e1.mp4.
//
// There is no home page any more: #/ IS THE ARCHIVE. The credo
// band and the four shelf tiles that used to stand in front of
// the library now open the About page — see §THE HOUSE PAGE WAS
// REMOVED.
// =============================================================

(function (global) {
  'use strict';

  var U = function () { return global.AscUI; };
  var esc = function (s) { return U().esc(s); };
  var attr = function (s) { return U().attr(s); };

  // ── §GROUPS ────────────────────────────────────────────────
  // ONE TAXONOMY. Until 2026-10-18 this page had two: ten storage
  // shelves grouped into six tabs, and nineteen free-text
  // categories, describing the same four hundred records along
  // different axes. "True Crime" was a category on the podcasts
  // shelf; "Compilations" was a category on the trueHorror shelf.
  // Browsing meant knowing which axis a thing had been filed on.
  //
  // Now the CATEGORY is the taxonomy and the shelf is plumbing.
  // `reads` is the list of categories a tab shows — usually one,
  // but Music shows all five of the music categories, because
  // Damian asked for one Music tab and five would be a wall.
  //
  // Nothing is `hidden` any more. A tab is derived from what the
  // data actually holds, so a record cannot sit in the store with
  // no way to reach it, which is what happened to the reading and
  // anime shelves under the old table.
  //
  // `noun` is what a hero calls this group when it is the
  // featured thing — "FEATURED FILM" in the reference.
  var GROUPS = [
    { key: 'stories', label: 'Stories', noun: 'Featured tale', sigil: 'sg-eye',
      tint: '#a9764c', verb: 'Watch', reads: ['Stories'] },
    { key: 'podcasts', label: 'Podcasts', noun: 'Featured series', sigil: 'sg-wave',
      tint: '#c3c6c6', verb: 'Listen', reads: ['Podcasts'] },
    { key: 'asmr', label: 'ASMR & Immersive', noun: 'Featured', sigil: 'sg-flame',
      tint: '#b8796a', verb: 'Listen', reads: ['ASMR & Immersive Experience'] },
    { key: 'music', label: 'Music', noun: 'Featured record', sigil: 'sg-moon',
      tint: '#c99a63', verb: 'Play',
      reads: ['Chill', 'Binaural Beats', 'Dark / Gothic / Horror / Romance',
              'EDM / Electronic', 'Fantasy'] },
    { key: 'gaming', label: 'Gaming', noun: 'Current obsession', sigil: 'sg-pad',
      tint: '#8fa39b', verb: 'Play', reads: ['Gaming'] },
    { key: 'scary', label: 'Scary Videos', noun: 'Featured', sigil: 'sg-orn',
      tint: '#b0705f', verb: 'Watch', reads: ['Scary Videos'] },
    { key: 'vlogs', label: 'Vlog-Like', noun: 'Featured', sigil: 'sg-play',
      tint: '#e0a765', verb: 'Watch', reads: ['Vlog-Like'] },
    { key: 'episodes', label: 'Favorite Videos & Episodes', noun: 'Featured',
      sigil: 'sg-spark', tint: '#d6d2cb', verb: 'Watch',
      reads: ['Favorite Videos & Episodes'] }
  ];

  // Which group owns a category. Built once, because it is asked
  // on every one of four hundred cards.
  var GROUP_OF_CAT = {};
  GROUPS.forEach(function (g) {
    g.reads.forEach(function (c) { GROUP_OF_CAT[c] = g.key; });
  });

  // Every category actually present that no group claims. Nothing
  // declares these; they are whatever turns up in the data — a
  // category typed by hand, or a record on a shelf that used to be
  // hidden. They get their own tab rather than being folded into
  // someone else's, because a record no tab can reach is the only
  // way this page could lose something.
  function strayCats() {
    var seen = {};
    global.Vault.SHELVES.forEach(function (sh) {
      global.Vault.list(sh).forEach(function (v) {
        var c = catName(v.category || 'Uncategorised');
        if (!GROUP_OF_CAT[c]) seen[c] = 1;
      });
    });
    return Object.keys(seen).sort();
  }

  // The tab strip: the eight declared groups, plus Unfiled only
  // when there is something in it.
  var UNFILED = { key: 'unfiled', label: 'Unfiled', noun: 'Featured', sigil: 'sg-all',
    tint: '#a8a29b', verb: 'Open', reads: [], stray: true };

  var LIVE = function () {
    var stray = strayCats();
    if (!stray.length) return GROUPS;
    return GROUPS.concat([Object.assign({}, UNFILED, { reads: stray })]);
  };

  // WHICH STORAGE SHELF A NEW RECORD GOES ON.
  //
  // The category is the taxonomy; the shelf is still the localStorage
  // key, so something has to choose one. Existing records keep
  // whatever shelf they are already on — this only answers for new
  // ones, from the composer and from the Capture page.
  //
  // Games is deliberately absent: a game is not a link and never
  // arrives through either of those paths.
  var HOME_SHELF = {
    'Stories': 'creepypasta',
    'Podcasts': 'podcasts',
    'ASMR & Immersive Experience': 'immersive',
    'Chill': 'playlists',
    'Binaural Beats': 'playlists',
    'Dark / Gothic / Horror / Romance': 'playlists',
    'EDM / Electronic': 'playlists',
    'Fantasy': 'playlists',
    'Gaming': 'watch',
    'Scary Videos': 'watch',
    'Vlog-Like': 'watch',
    'Favorite Videos & Episodes': 'watch'
  };
  var homeShelf = function (c) { return HOME_SHELF[catName(c)] || 'watch'; };

  // Every category the composer and the Capture page offer: the
  // twelve declared, plus anything already in the data that is not
  // one of them, so an existing name is never silently unofferable.
  function allCats() {
    var seen = {}, out = CAT_ORDER.slice();
    CAT_ORDER.forEach(function (c) { seen[c] = 1; });
    strayCats().forEach(function (c) { if (!seen[c]) { seen[c] = 1; out.push(c); } });
    return out;
  }

  // Counts are per CATEGORY now, not per storage shelf: a group is
  // a set of categories and the two no longer line up.
  function catCounts() {
    var n = {};
    global.Vault.SHELVES.forEach(function (sh) {
      global.Vault.list(sh).forEach(function (v) {
        var c = catName(v.category || 'Uncategorised');
        n[c] = (n[c] || 0) + 1;
      });
    });
    return n;
  }
  function countOfGroup(g, n) {
    return g.reads.reduce(function (a, c) { return a + (n[c] || 0); }, 0);
  }

  // Every hash this page has ever answered to. The three on the
  // left are storage shelves that stopped being tabs when Horror
  // and Spicy merged; the rest are view routes two rebuilds have
  // now removed. A bookmark to any of them lands somewhere real.
  //
  // `favorites` is NOT in here any more. It is a real view again
  // as of this build, and parseHash answers both spellings of it
  // before tabKey is ever consulted.
  var TAB_ALIAS = {
    // The tabs the shelf era had.
    horror: 'stories', spicy: 'asmr', playlists: 'music', games: 'gaming',
    // Storage shelves, which were briefly hashes of their own.
    creepypasta: 'stories', trueHorror: 'stories', immersive: 'asmr',
    // 'watch' held four categories that are now four separate tabs,
    // so it has no single successor and answers with the whole archive.
    watch: 'all', reading: 'all', anime: 'all',
    // View routes two rebuilds have removed.
    home: 'all', discover: 'all', stats: 'all'
  };

  // Bookmarks to a collection that was merged away on 2026-10-18.
  // poolFor matches the category string exactly, so without this an
  // old link lands on a real page showing nothing at all. It also
  // covers a record the migration has not reached yet — a second
  // device still on the old names reads correctly here.
  var CAT_ALIAS = {
    'Creepypasta': 'Stories', 'Compilations': 'Stories', 'True Crime': 'Stories',
    'Learning': 'Podcasts', 'Photography / Videography': 'Podcasts',
    'Business': 'Podcasts', 'Writing': 'Podcasts',
    'ASMR': 'ASMR & Immersive Experience',
    'Immersive Experience': 'ASMR & Immersive Experience',
    'Favorite Videos': 'Favorite Videos & Episodes',
    'Other': 'Favorite Videos & Episodes'
  };
  var catName = function (c) { return CAT_ALIAS[c] || c; };

  var SHELF_NAME = {
    podcasts: 'Podcasts', creepypasta: 'Creepypasta', trueHorror: 'True stories',
    spicy: 'Spicy', immersive: 'Immersive', watch: 'Watching',
    playlists: 'Music', reading: 'Reading', anime: 'Anime', games: 'Games'
  };

  // Category order, so collections land in the sequence Damian
  // chose rather than alphabetically. Anything not named here
  // ranks last and sorts alphabetically among its own kind.
  var CAT_ORDER = [
    'Stories', 'Podcasts', 'ASMR & Immersive Experience',
    'Chill', 'Binaural Beats', 'Dark / Gothic / Horror / Romance',
    'EDM / Electronic', 'Fantasy',
    'Gaming', 'Scary Videos', 'Vlog-Like', 'Favorite Videos & Episodes'
  ];
  function catRank(k) { var i = CAT_ORDER.indexOf(k); return i < 0 ? 99 : i; }

  var tabKey = function (k) { return TAB_ALIAS[k] || k; };
  // Still called shelfOf at every call site: it answers the same
  // question ("which tab does this card belong to") and renaming it
  // across four files would be churn, not clarity.
  var shelfOf = function (k) {
    var want = tabKey(k);
    return LIVE().filter(function (g) { return g.key === want; })[0] || GROUPS[0];
  };
  var readsOf = function (t) { return (typeof t === 'string' ? shelfOf(t) : t).reads || []; };
  // Which group a record belongs to, from its category alone.
  var groupKeyOfCat = function (c) { return GROUP_OF_CAT[catName(c)] || 'unfiled'; };

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
      cat: catName(v.category || 'Uncategorised'), desc: v.description || '',
      opened: v.lastOpenedAt || 0, opens: v.openCount || 0, made: v.createdAt || 0,
      hero: v.hero || '',
      // 'auto' — and ABSENT, which is all four hundred and eight
      // records that came in with the seed — means classifyKind()
      // reads it off the shelf and the link instead.
      kind: v.kind || 'auto'
    };
  }

  // Everything, as cards. Reads at CALL time, never at parse time:
  // the IndexedDB shim hydrates asynchronously, so an array
  // captured when this file first runs is the pre-hydration
  // snapshot. Hidden shelves are skipped so every count on screen
  // matches what is on screen.
  function allCards() {
    var out = [];
    // EVERY storage shelf, including the two that used to be hidden.
    // A shelf is plumbing now — the CATEGORY decides which tab a
    // record shows under — so nothing can sit in the store
    // unreachable the way reading and anime did.
    global.Vault.SHELVES.forEach(function (sh) {
      global.Vault.list(sh).forEach(function (v) {
        out.push(toCard(v, sh, groupKeyOfCat(v.category)));
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

  // ── §SINGLE OR COLLECTION ──────────────────────────────────
  // What the Favourites page cuts on. Derived from the LINK,
  // because that is where the truth already is and nobody is
  // going to label four hundred items by hand.
  //
  // But a link is not always honest: `watch?v=X&list=Y` is ONE
  // VIDEO that happens to have been opened out of a playlist, and
  // tapping it plays that video. So the video wins over the
  // playlist it came from, and the record carries a manual
  // override for the handful this still reads wrong.
  //
  // Returns 'single' or 'collection'. Never 'auto' — that is a
  // STORED value, not an answer.
  function classifyKind(d) {
    var own = d.kind || 'auto';
    if (own === 'single' || own === 'collection') return own;

    // A shelf can settle it before the link is read. Music and
    // Podcasts are shelves of records and series rather than of
    // single things, and a game is a world. `shelf` is the storage
    // key and `tab` the merged name; both are asked, so this
    // answers for a card built either way.
    // The storage shelf still settles games — a game is a world, and
    // 'games' is a shelf rather than a category. Music and Podcasts
    // are settled by the GROUP now, because that is where those
    // records live since the categories replaced the shelves.
    var sh = d.shelf || '', tab = d.tab || '';
    if (sh === 'games' || /^(music|podcasts)$/.test(tab)) return 'collection';

    var u = String(d.url || '');
    if (!u) return 'single';
    var host, path, qs;
    try {
      var url = new URL(u);
      host = url.hostname.replace(/^www\./, '').toLowerCase();
      path = url.pathname.toLowerCase();
      qs = url.searchParams;
    } catch (e) { return 'single'; }

    if (/^(youtube\.com|m\.youtube\.com|music\.youtube\.com|youtu\.be)$/.test(host)) {
      if (host === 'youtu.be') return 'single';
      // The same three single-video paths ytId() already reads, so
      // a link that HAS a derivable video id is never called a set.
      if (/^\/(shorts|embed|live)\//.test(path)) return 'single';
      if (qs.get('v')) return 'single';
      if (/^\/playlist/.test(path) || qs.get('list')) return 'collection';
      // A channel, an @handle, /c/, /user/ — a body of work.
      return 'collection';
    }
    if (/^(open\.spotify\.com|spotify\.com)$/.test(host)) {
      if (/^\/(album|playlist|show|artist|collection)\//.test(path)) return 'collection';
      if (/^\/(track|episode)\//.test(path)) return 'single';
      return 'collection';
    }
    if (/^(m\.)?soundcloud\.com$/.test(host)) {
      return /\/sets\//.test(path) ? 'collection' : 'single';
    }

    // Everything else is one thing until it says otherwise.
    return 'single';
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
    var counts = catCounts();
    return '<nav class="hd-chips" aria-label="Categories">' +
      LIVE().map(function (t) {
        return '<a class="hd-chip2" href="#/archive/' + t.key + '">' +
          sig(t.sigil, 11) + esc(t.label) + '<i>' + countOfGroup(t, counts) + '</i></a>';
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
    // THE COVER, NOT THE BIG ART. This asked for maxresdefault for
    // one build and it was wrong twice over. A uniform tile is
    // ~290px wide, so the 480x360 hqdefault every record already
    // carries is not being upscaled at all — maxres was only ever
    // needed by the old five-column feature tile. And when a video
    // has no maxres, YouTube does not always 404: it sometimes
    // serves a grey "no thumbnail" placeholder with a 200, which
    // the error-handler fallback cannot see, so the card showed a
    // grey rectangle in place of artwork it already had.
    var art = d.cover
      ? '<img class="hd-card__img" src="' + attr(d.cover) + '" alt="" loading="lazy" decoding="async">'
      : '';
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
        '<span class="hd-card__art">' + art +
          (d.len ? '<span class="hd-card__len">' + esc(d.len) + '</span>' : '') +
        '</span>' +
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
  // Still used, but only by the Collections index, to pick the two
  // covers that stand for a category. It stopped choosing tile
  // SIZES when the mosaic was retired.
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

  // THE HOUSE PAGE WAS REMOVED — #/ IS THE ARCHIVE NOW.
  //
  // It was a credo paragraph, an editable set of keywords and four
  // tiles into four shelves, and it sat in front of the library
  // every single time the page was opened. The library is what
  // this page is FOR, and it was one tap behind a cover.
  //
  // What was worth keeping is the HOUSE'S OWN WORDS, and they are
  // not gone: the credo band below, markup unchanged, now opens
  // the About page — which is the page that edits them, and which
  // was already the house talking about itself. `vault:house` is
  // untouched, still read, still written by the same form.
  //
  // wayTile() survives with it. Only viewHome() is gone.

  function credoBand() {
    var counts = catCounts();
    var house = HOUSE();
    var ways = ['stories', 'podcasts', 'music', 'gaming'].map(shelfOf);

    return '<section class="hd-band hd-night hd-credo">' +
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
        // The inline "Edit this page's words" link that used to
        // close this block is GONE. It belonged to a standalone
        // home page; here the band sits a screen above About's
        // own "This page's words" panel, which offers the same
        // action and explains it. Two identical buttons four
        // hundred pixels apart is one too many.
        '</div>' +
        '<div class="hd-ways">' + ways.map(function (t) { return wayTile(t, counts); }).join('') + '</div>' +
      '</section>';
  }


  // ── §A GROUP, AS A HEADING ─────────────────────────────────
  // The archive's own caption voice, one step under the utility
  // line: .hd-eyebrow for the name, .hd-util__n for the count.
  //
  // .hd-util__n sets a COLOUR and nothing else — it takes its
  // 10.5px and its tracking from .hd-util, which is not its
  // parent here — so .hd-ghead carries the caption type itself.
  //
  // Not .hd-plate (the display face, and the sheet's voice), and
  // not .hd-orn, which marks the end of a page's title block and
  // exactly one thing. Spending it on four list heads a page is
  // how an ornament stops meaning anything.
  function groupHead(label, n) {
    return '<div class="hd-ghead">' +
      '<h2 class="hd-eyebrow">' + esc(label) + '</h2>' +
      '<span class="hd-util__n">' + n + (n === 1 ? ' entry' : ' entries') + '</span>' +
    '</div>';
  }

  // ── §A GROUP OF CARDS ──────────────────────────────────────
  // One list, one grid, one card. This was viewArchive's whole
  // tail until the starred split; it is lifted out so the archive
  // can show TWO of them — starred above, the rest below —
  // without a second card component or a second sort.
  //
  // 2026-10-18: THE MOSAIC IS GONE. It cut the first seven items
  // into feature/tall/wide/row tiles with the titles laid over the
  // artwork, and it had two problems that were really one. The
  // small one: it only tiled cleanly at exactly seven or more, so
  // every short list had a hole in it. The real one: Damian's
  // reference is a uniform grid of 16:9 thumbnails with the title
  // underneath, which is how every video library he actually uses
  // draws one, and a page that varies tile size is a page making a
  // claim about importance that it has no way to know.
  //
  // What that deletes: MOSAIC, the four extra shapes, and
  // byProminence's role here. The reader's sort is now the only
  // thing deciding order, which is also the first time the Sort
  // control has been the only answer.
  function cardGroup(items, o) {
    o = o || {};
    // ONE SHAPE. The mosaic cut the first seven items into four
    // different tiles with their titles laid over the artwork; the
    // reference Damian asked for is a uniform grid of 16:9
    // thumbnails with the title underneath, the way every video
    // library he actually uses draws one. So prominence no longer
    // decides anything about size, the reader's sort is the only
    // order, and the add-a-game tile just takes the first cell.
    return '<section class="hd-group' + (o.cls ? ' ' + o.cls : '') + '">' +
      (o.label ? groupHead(o.label, items.length) : '') +
      (items.length || o.lead
        ? '<div class="hd-grid">' + (o.lead || '') +
            items.map(function (d, i) { return card(d, i, 'grid'); }).join('') +
          '</div>'
        : '') +
    '</section>';
  }

  // ── §THE TWO LISTS ─────────────────────────────────────────
  // Starred always on top, in its own mosaic, with its own grid
  // under it; everything else beneath, the same way. A star was
  // write-only before this: you could set one and the page looked
  // identical, on every shelf and in every collection.
  //
  // The heads appear only when BOTH lists exist. "Everything
  // else" over the only list on the page is a heading that
  // describes nothing, and the utility line already prints the
  // count.
  function archiveLists(state) {
    var items = poolFor(state);
    if (!items.length) return emptyArchive(state);

    var star = items.filter(function (d) { return d.fav; });
    var rest = items.filter(function (d) { return !d.fav; });
    var split = star.length > 0 && rest.length > 0;
    // A GAME IS NOT A LINK, so the Games shelf keeps its own way
    // in — and it sits in the list a new game would join, which
    // is the unstarred one unless there is nothing else there.
    var lead = state.group === 'gaming' ? addGameTile() : '';

    return (star.length
        // "Starred" earns its head even alone: it is a true
        // statement about the list. "Everything else" alone is not.
        ? cardGroup(star, { cls: 'hd-group--star', label: 'Starred',
            lead: rest.length ? '' : lead })
        : '') +
      (rest.length
        ? cardGroup(rest, { label: split ? 'Everything else' : null, lead: lead })
        : '');
  }

  // The ONLY region a star is allowed to repaint. vault-app.js
  // re-renders exactly this into #hdLists and keeps the reader's
  // place; the hero, the tabs and the utility line — which is
  // where the focused sort <select> lives — are never touched.
  function lists(state) {
    return state.route === 'favourites' ? favLists(state) : archiveLists(state);
  }

  // =============================================================
  // §FAVOURITES — #/favourites
  // =============================================================
  // Every starred thing in the house, on one page, cut the way a
  // starred thing is actually used: one video to watch tonight,
  // or a playlist to put on. NOT by shelf — the shelf tabs are
  // one tap away and this page exists precisely to ignore them.
  //
  // The cut is classifyKind(), derived from the link, with the
  // record's own `kind` overriding it for the handful it reads
  // wrong. See §SINGLE OR COLLECTION.
  //
  // TWO SPELLINGS OF ONE WORD, on purpose and consistently: the
  // stored field is `favorite`, the chrome says Favourites, and a
  // list head says Starred. Both hashes resolve.
  function favCount() {
    return allCards().filter(function (d) { return d.fav; }).length;
  }

  // THE CHIPS ARE THE TABS. Damian asked for two things here — a
  // tab strip by media type, and the favourites of each category
  // on top for quick access — and drawn as two controls they would
  // filter the same list from two different rows. So it is one
  // strip, carrying the counts, sitting above everything else.
  //
  // A group with nothing starred in it is left out: a chip reading
  // 0 is not quick access, it is furniture. The one being filtered
  // by stays even when it empties, or the control the reader just
  // used would vanish under them.
  function favChips(state) {
    var on = state.favGroup || 'all';
    var starred = allCards().filter(function (d) { return d.fav; });
    var n = {};
    starred.forEach(function (d) { n[d.cat] = (n[d.cat] || 0) + 1; });

    var chip = function (key, label, count) {
      return '<button type="button" class="hd-tab' + (on === key ? ' is-on' : '') + '"' +
        ' data-act="favgroup" data-group="' + attr(key) + '"' +
        (on === key ? ' aria-current="true"' : '') + '>' +
        esc(label) + '<i>' + count + '</i></button>';
    };

    var groups = LIVE().filter(function (g) {
      return countOfGroup(g, n) > 0 || on === g.key;
    });

    // The second level, for Music only, and only while Music is
    // what is being looked at.
    var music = shelfOf('music');
    var inMusic = on === 'music' ||
      (on.indexOf('cat:') === 0 && music.reads.indexOf(catName(on.slice(4))) >= 0);
    var sub = '';
    if (inMusic) {
      var kinds = music.reads.filter(function (c) {
        return (n[c] || 0) > 0 || on === 'cat:' + c;
      });
      if (kinds.length > 1) {
        sub = '<nav class="hd-tabs hd-tabs--sub" aria-label="Kinds of music">' +
          chip('music', 'All music', countOfGroup(music, n)) +
          kinds.map(function (c) { return chip('cat:' + c, c, n[c] || 0); }).join('') +
        '</nav>';
      }
    }

    return '<nav class="hd-tabs" aria-label="Favourites by category">' +
      chip('all', 'All Favourites', starred.length) +
      groups.map(function (g) { return chip(g.key, g.label, countOfGroup(g, n)); }).join('') +
    '</nav>' + sub;
  }

  function favLists(state) {
    // favOnly is what poolFor does for this page. It is the
    // reason that filter still exists after the utility line's
    // "Starred" toggle became a link — see poolFor().
    var items = poolFor({
      group: state.favGroup || 'all', collection: '', favOnly: true,
      q: state.q, sort: state.sort
    });
    if (!items.length) {
      if (state.q) {
        return '<p class="hd-empty"><strong>Nothing starred matches.</strong>' +
          'Clear the search to see everything you have starred.</p>';
      }
      // Three different reasons for an empty page, and advice you
      // cannot take from the page you are on is a dead end.
      if ((state.favGroup || 'all') !== 'all') {
        return '<p class="hd-empty"><strong>Nothing starred here yet.</strong>' +
          'Pick All Favourites above to see the rest.</p>';
      }
      return '<p class="hd-empty"><strong>Nothing starred yet.</strong>' +
        'The ☆ on any card puts it here, and keeps it at the top of its own list.</p>';
    }
    var one = [], many = [];
    items.forEach(function (d) {
      (classifyKind(d) === 'collection' ? many : one).push(d);
    });
    // Same rule as the archive: a head only when there are two
    // lists to tell apart.
    var split = one.length > 0 && many.length > 0;
    return (one.length
        ? cardGroup(one, { cls: 'hd-group--one', label: split ? 'Single videos' : null })
        : '') +
      (many.length
        ? cardGroup(many, { cls: 'hd-group--sets',
            label: split ? 'Playlists & collections' : null })
        : '');
  }

  function viewFavourites(state) {
    // The TOTAL, not the filtered count, in both places — so the
    // hero cannot contradict itself while a search is running.
    // The search token in the utility line is what explains why
    // the lists are shorter than the number.
    var n = favCount();
    return pageHero({
        eyebrow: 'Starred',
        title: 'Favourites',
        caption: n
          ? n + (n === 1 ? ' entry' : ' entries') + ' you marked to come back to.'
          : 'Nothing starred yet. The ☆ on any card puts it here.'
      }) +
      // hd-archive is REQUIRED: it is what scopes the phone's
      // one-card-per-row rules. See §ONE BIG CARD PER ROW.
      '<section class="hd-band hd-night hd-archive">' +
        favChips(state) +
        utility(state, n) +
        '<div class="hd-lists" id="hdLists">' + favLists(state) + '</div>' +
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
          state.group === 'all'
            ? { eyebrow: 'A private entertainment collection', title: 'The Archive',
                caption: 'What we preserve shapes what remains.' }
            : { eyebrow: 'In the archive', title: shelfOf(state.group).label,
                caption: SHELF_CAPTION[state.group] || 'What we preserve shapes what remains.' }
        );
    // Tabs are links, not chips: a tab is a place, and the
    // reference draws it as text with a rule under it.
    var counts = catCounts();
    var live = LIVE();
    var countOf = function (t) { return countOfGroup(t, counts); };
    // Counting the GROUPS rather than the records, so a stray
    // category is in the All total exactly once.
    var total = live.reduce(function (a, t) { return a + countOf(t); }, 0);
    var tab = function (key, label, n) {
      return '<a class="hd-tab' + (state.group === key ? ' is-on' : '') + '" href="#/archive' +
        (key === 'all' ? '' : '/' + key) + '"' + (state.group === key ? ' aria-current="page"' : '') +
        '>' + esc(label) + '<i>' + n + '</i></a>';
    };

    var tabs = state.collection ? '' :
      '<nav class="hd-tabs" aria-label="Categories">' +
        tab('all', 'All', total) +
        live.map(function (t) { return tab(t.key, t.label, countOf(t)); }).join('') +
      '</nav>';

    return hero +
      '<section class="hd-band hd-night hd-archive">' +
      tabs +
      utility(state, items.length) +
      // One wrapper with one id, because a star has to be able to
      // re-cut both lists without the hero, the tabs or the sort
      // control being thrown away under the reader.
      '<div class="hd-lists" id="hdLists">' + archiveLists(state) + '</div>' +
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

  // One line per category, so a filtered archive reads as a room
  // rather than as the same page with fewer things on it.
  var SHELF_CAPTION = {
    stories: 'The ones that are better after dark.',
    podcasts: 'Voices to keep the room company.',
    asmr: 'Kept quietly, and on purpose.',
    music: 'Rooms made of sound.',
    gaming: 'Worlds with a door you can close behind you.',
    scary: 'Watched once, remembered longer.',
    vlogs: 'Somebody else\'s ordinary day.',
    episodes: 'The ones worth going back to.',
    unfiled: 'Filed under a name no tab claims yet.'
  };

  function emptyArchive(state) {
    if (state.q) {
      return '<p class="hd-empty"><strong>Nothing matches.</strong>' +
        'Clear the search to see this shelf again.</p>';
    }
    // An empty state that gives advice you cannot take from the
    // page you are on is not an empty state, it is a dead end. On
    // Games the advice IS the button.
    if (state.group === 'gaming') {
      return '<p class="hd-empty"><strong>No games yet.</strong>' +
        'A game is not a link — it gets a page of its own, with videos, guides and ' +
        'a journal. Start one.</p>' +
        '<div class="hd-grid">' + addGameTile() + '</div>';
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
      // A LINK NOW, NOT A FILTER. "☆ Starred" used to hide the
      // unstarred items; with the split it would produce a page
      // headed "Starred", with no second list, and a count that
      // disagrees with the tab above it — a contradiction rather
      // than a filter. What it was for is a better page now.
      //
      // .hd-util__b is styled on the class, so an <a> takes it
      // unchanged, and fire() already lets anchors navigate.
      (state.route === 'favourites'
        ? '<span class="hd-util__b is-on">★ Favourites</span>'
        : '<a class="hd-util__b" href="#/favourites">★ Favourites</a>') +
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

    // The hero carries the editable HEADLINE now, and the blurb
    // under it, so all four of `vault:house`'s fields are visible
    // on the one page that edits them. It was the home hero's
    // title until #/ became the Archive.
    return pageHero({
        eyebrow: 'House Damula', title: house.headline, caption: house.blurb
      }) +
      // Moved here from the house page. Words first, then figures:
      // .hd-credo's own padding is tighter than a standard band,
      // so the two stacked do not double a 110px gutter.
      credoBand() +
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
        '<p class="hd-note">The headline, the credo and the keywords on this page are yours. ' +
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
      if (r) return toCard(r, pin.shelf, groupKeyOfCat(r.category));
    }
    var withArt = allCards().filter(function (d) { return d.cover; });
    return byProminence(withArt)[0] || null;
  }

  // =============================================================
  // §THE POOL
  // =============================================================
  function poolFor(state) {
    // ONE pool, filtered — not a pool assembled per tab. A group is
    // a set of CATEGORIES now, and a single category can hold records
    // sitting on several different storage shelves, so walking a tab's
    // shelves would both miss records and show them twice.
    var out = allCards();
    if (state.collection) {
      var want = catName(state.collection);
      out = out.filter(function (d) { return d.cat === want; });
    } else if (state.group && state.group !== 'all') {
      // 'cat:<name>' narrows to ONE category rather than a whole
      // group. Only Music needs it — its five categories are a
      // genuine second level, and the other seven groups are one
      // category each, so a sub-row there would be the same list
      // twice.
      if (state.group.indexOf('cat:') === 0) {
        var one = catName(state.group.slice(4));
        out = out.filter(function (d) { return d.cat === one; });
      } else {
        var set = {};
        shelfOf(state.group).reads.forEach(function (c) { set[c] = 1; });
        out = out.filter(function (d) { return set[d.cat]; });
      }
    }
    // NOT DEAD CODE. Nothing in the interface sets favOnly since
    // the utility line's "Starred" toggle became a link to the
    // Favourites page — favLists() is the caller, and it passes a
    // derived state object rather than growing a second pool.
    // Deleting this turns the Favourites page into the Archive.
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
    GROUPS: GROUPS, LIVE: LIVE, TAB_ALIAS: TAB_ALIAS, SHELF_NAME: SHELF_NAME,
    CAT_ALIAS: CAT_ALIAS, catName: catName, GROUP_OF_CAT: GROUP_OF_CAT,
    HOME_SHELF: HOME_SHELF, homeShelf: homeShelf, allCats: allCats,
    groupKeyOfCat: groupKeyOfCat, catCounts: catCounts, countOfGroup: countOfGroup,
    strayCats: strayCats,
    CAT_ORDER: CAT_ORDER, catRank: catRank,
    tabKey: tabKey, shelfOf: shelfOf, readsOf: readsOf,
    toCard: toCard, allCards: allCards, recordOf: recordOf, poolFor: poolFor,
    byProminence: byProminence, sortItems: sortItems,
    sig: sig, orn: orn, eyebrow: eyebrow, arrow: arrow, card: card,
    groupHead: groupHead, cardGroup: cardGroup, archiveLists: archiveLists, lists: lists,
    heroCard: heroCard, heroChips: heroChips, addGameTile: addGameTile,
    ytId: ytId, bigArt: bigArt, artImg: artImg, shownUrl: shownUrl, yearOf: yearOf,
    classifyKind: classifyKind,
    prettyDate: prettyDate, pageHero: pageHero,
    store: store, HOUSE: HOUSE, HOUSE_DEFAULT: HOUSE_DEFAULT, featuredCard: featuredCard,
    favLists: favLists, favCount: favCount, favChips: favChips,
    credoBand: credoBand, viewArchive: viewArchive, viewCollections: viewCollections,
    viewFavourites: viewFavourites, viewAbout: viewAbout
  };
})(window);
