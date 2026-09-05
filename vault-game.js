// =============================================================
// vault-game.js — the game page.
//
//   window.HDGame
//
// One record, in full: a split hero, a rail of videos, and the
// articles written about it.
//
// IT IS ITS OWN FILE ON PURPOSE. This is the one template Damian
// asked to be able to change, and a template you edit should not
// be buried in the middle of a router. Everything about how a
// game LOOKS is here; everything about how the archive looks is
// in vault-views.js; the articles are vault-article.js's, because
// they are a template of their own; nothing about how any of it
// is stored is in any of them.
//
// EVERY FIELD BELOW IS OPTIONAL AND ADDITIVE.
// `Vault.update` merges, so the 408 records that predate this
// file are untouched and simply have none of it:
//
//   status      "Currently playing"
//   playtime    "184 hours"
//   hero        a big image URL, when a cover is too small
//   railTitle   the rail's own heading
//   videos      [ { id, url, title } ]
//
// WHAT USED TO BE HERE. Below the rail sat four columns —
// Personal notes, Favourite quote, Memories, and a journal cell.
// They were small-note surfaces, and there was nowhere in this
// studio to write anything long. On 2026-09-04 they were replaced
// by the ARTICLE FEED, and `columns` / `entries` / `notes` are
// read exactly once more: HDArticle.migrateGame turns every note
// and entry into an article the first time a game page is opened.
// The fields themselves are left in storage, untouched.
// =============================================================

(function (global) {
  'use strict';

  var U = function () { return global.AscUI; };
  var esc = function (s) { return U().esc(s); };
  var attr = function (s) { return U().attr(s); };
  var H = function () { return global.HD; };
  var App = function () { return global.HDApp; };

  var uid = function (p) {
    return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  // ── §THE RECORD, NORMALISED ────────────────────────────────
  // Defaults are computed, never written, so a game you have not
  // touched stores nothing at all beyond what the composer gave it.
  function gameOf(r) {
    return {
      status: r.status || 'In the collection',
      playtime: r.playtime || '',
      hero: r.hero || '',
      railTitle: r.railTitle || 'Moments',
      videos: Array.isArray(r.videos) ? r.videos : []
    };
  }

  function save(id, patch) {
    global.Vault.update('games', id, patch);
  }

  // ── §VIDEO ─────────────────────────────────────────────────
  // The reference puts a strip of stills here. Damian asked for
  // videos he can add instead.
  //
  // NOTHING IS EMBEDDED UNTIL IT IS CLICKED. The thumbnail is
  // derived from the URL — no player script, no third-party call,
  // nothing reported to YouTube for merely opening this page —
  // and the iframe is created only when you ask to watch. That is
  // the same rule the composer's auto-fill has always followed.
  function videoThumb(v) {
    var id = H().ytId(v.url);
    return id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '';
  }
  function videoBig(v) {
    var id = H().ytId(v.url);
    return id ? 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg' : '';
  }
  function embedUrl(v) {
    var id = H().ytId(v.url);
    // youtube-nocookie, and only ever after a click.
    if (id) return 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
    var m = String(v.url || '').match(/vimeo\.com\/(\d+)/);
    if (m) return 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1';
    return '';
  }

  function videoCard(v, i) {
    var big = videoBig(v), small = videoThumb(v);
    return '<article class="hd-vid ' + U().rvlClass() + '"' + U().rvlStyle(Math.min(i, 8)) + '>' +
      '<button type="button" class="hd-vid__hit" data-act="play-video" data-vid="' + attr(v.id) + '"' +
        ' aria-label="Play ' + attr(v.title || 'this video') + '">' +
        '<span class="hd-vid__art">' +
          (big
            ? '<img src="' + attr(big) + '"' + (small ? ' data-fallback="' + attr(small) + '"' : '') +
              ' alt="" loading="lazy" decoding="async">'
            : '<span class="hd-vid__none" aria-hidden="true"></span>') +
          '<span class="hd-vid__play" aria-hidden="true">' +
            '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">' +
            '<path d="M4.4 2.6 13 8l-8.6 5.4Z"></path></svg></span>' +
        '</span>' +
        '<span class="hd-vid__t">' + esc(v.title || H().shownUrl(v.url) || 'Untitled') + '</span>' +
      '</button>' +
      '<button type="button" class="hd-vid__edit" data-act="edit-video" data-vid="' + attr(v.id) + '"' +
        ' aria-label="Edit this video">Edit</button>' +
    '</article>';
  }

  // ── §THE PAGE ──────────────────────────────────────────────
  function view(id) {
    var r = H().recordOf('games', id);
    if (!r) {
      return '<section class="hd-band hd-night hd-archive">' +
        '<header class="hd-head"><div class="hd-head__l">' +
          '<h1 class="hd-title">Not here</h1>' + H().orn('hd-orn--left') +
          '<p class="hd-sub">That game is no longer on the shelf.</p>' +
          '<a class="hd-link" href="#/archive/games">' + H().arrow('Back to Games') + '</a>' +
        '</div></header></section>';
    }
    var d = H().toCard(r, 'games', 'games');
    var g = gameOf(r);
    var last = d.opened
      ? new Date(d.opened).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Not yet';

    var metric = function (label, value, act) {
      return '<button type="button" class="hd-metric" data-act="' + act + '">' +
        '<span class="hd-eyebrow">' + esc(label) + '</span>' +
        '<span class="hd-metric__v">' + value + '</span></button>';
    };

    return '<article class="hd-game hd-night">' +
      '<section class="hd-gsplit" data-parallax>' +
        '<div class="hd-gsplit__art">' +
          H().artImg(d, 'hd-gsplit__img', true) +
          '<span class="hd-gsplit__join" aria-hidden="true"></span>' +
          '<button type="button" class="hd-gsplit__setart" data-act="edit-art">Change artwork</button>' +
        '</div>' +
        '<div class="hd-gsplit__say">' +
          '<a class="hd-link hd-link--quiet hd-gsplit__back" href="#/archive/games">← Games</a>' +
          '<p class="hd-eyebrow">' + esc(g.status) + '</p>' +
          '<h1 class="hd-title hd-title--game">' + esc(d.title) + '</h1>' +
          '<p class="hd-gsplit__by">' +
            esc([d.creator, H().yearOf(d)].filter(Boolean).join(' · ') || 'Add a creator and a year') + '</p>' +
          (d.desc
            ? '<p class="hd-prose hd-prose--game">' + U().escLines(d.desc) + '</p>'
            : '<p class="hd-prose hd-prose--game hd-dim">No description yet. ' +
              '<button type="button" class="hd-link hd-link--quiet" data-act="edit-record">Add one</button></p>') +
          '<span class="hd-gsplit__rule" aria-hidden="true"></span>' +
          '<div class="hd-metrics">' +
            metric('Status', esc(g.status), 'edit-status') +
            metric('Playtime', esc(g.playtime || '—'), 'edit-playtime') +
            metric('Rating', d.rating
              ? '<span class="hd-stars" role="img" aria-label="Rated ' + d.rating + ' of 5">' +
                '★'.repeat(Math.round(d.rating)) +
                '<b>' + '★'.repeat(5 - Math.round(d.rating)) + '</b></span>'
              : '<span class="hd-dim">Unrated</span>', 'edit-record') +
            metric('Last visited', esc(last), 'noop') +
          '</div>' +
          '<div class="hd-gsplit__acts">' +
            (d.url
              ? '<button type="button" class="hd-link" data-act="open" data-shelf="games" data-id="' +
                attr(d.id) + '" data-url="' + attr(d.url) + '">' + H().arrow('Open the link') + '</button>'
              : '') +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="hd-rail">' +
        '<div class="hd-rail__head">' +
          '<button type="button" class="hd-rail__t" data-act="edit-railtitle">' +
            '<span class="hd-eyebrow">' + esc(g.railTitle) + '</span></button>' +
          '<div class="hd-rail__nav">' +
            '<button type="button" data-act="rail-prev" aria-label="Scroll left">‹</button>' +
            '<button type="button" data-act="rail-next" aria-label="Scroll right">›</button>' +
          '</div>' +
        '</div>' +
        '<div class="hd-rail__strip" id="hdRail">' +
          g.videos.map(videoCard).join('') +
          '<button type="button" class="hd-vid hd-vid--add" data-act="add-video">' +
            '<span aria-hidden="true">+</span> Add a video</button>' +
        '</div>' +
        (g.videos.length ? '' :
          '<p class="hd-note hd-rail__note">Paste a YouTube or Vimeo link and it becomes a card here. ' +
          'Nothing loads a player until you press it.</p>') +
      '</section>' +

      // Everything below the rail. It is vault-article.js's, not
      // this file's — a feed of rows and the page each one opens
      // are a template of their own, and they are the same two
      // things on every game.
      global.HDArticle.feed(r.id) +

      '<div class="hd-game__foot">' +
        '<button type="button" class="hd-link hd-link--quiet" data-act="edit-record">' +
          'Edit the record</button>' +
      '</div>' +
    '</article>';
  }

  // ── §ACTIONS ───────────────────────────────────────────────
  // Merged into vault-app.js's one delegated map. Each one reads
  // the live record, writes through Vault.update, and repaints —
  // there is no state held in this file between clicks.
  function current() {
    var id = App().state.gameId;
    return id ? H().recordOf('games', id) : null;
  }

  function edited(fn) {
    var r = current();
    if (!r) return U().toast('That game is no longer on the shelf');
    fn(r, gameOf(r));
  }

  var ACTS = {
    'edit-status': function () {
      edited(function (r, g) {
        App().form({
          title: 'Status',
          fields: [{ key: 'status', label: 'Status', value: g.status,
            hint: 'Currently playing · Finished · On the shelf · Abandoned — your words, not a fixed list.' }],
          onSave: function (v) { save(r.id, { status: v.status.trim() || 'In the collection' }); }
        });
      });
    },
    'edit-playtime': function () {
      edited(function (r, g) {
        App().form({
          title: 'Playtime',
          fields: [{ key: 'playtime', label: 'Playtime', value: g.playtime, placeholder: '184 hours' }],
          onSave: function (v) { save(r.id, { playtime: v.playtime.trim() }); }
        });
      });
    },
    'edit-railtitle': function () {
      edited(function (r, g) {
        App().form({
          title: 'The rail’s heading',
          fields: [{ key: 'railTitle', label: 'Heading', value: g.railTitle,
            hint: 'What this row of videos is. “Moments in the Lands Between”, “Boss runs”, “Guides”.' }],
          onSave: function (v) { save(r.id, { railTitle: v.railTitle.trim() || 'Moments' }); }
        });
      });
    },
    'edit-art': function () {
      edited(function (r, g) {
        App().form({
          title: 'Artwork',
          fields: [{ key: 'hero', label: 'Image URL', value: g.hero, type: 'url',
            hint: 'Leave it empty and the page uses the record’s cover. Paste a wide image here when the cover is too small for a hero.' }],
          onSave: function (v) { save(r.id, { hero: v.hero.trim() }); }
        });
      });
    },

    'add-video': function () {
      edited(function (r, g) {
        App().form({
          title: 'Add a video',
          fields: [
            { key: 'url', label: 'Link', type: 'url', value: '', placeholder: 'https://youtube.com/watch?v=…' },
            { key: 'title', label: 'Title', value: '', placeholder: 'What is it?' }
          ],
          onSave: function (v) {
            if (!v.url.trim()) return U().toast('A video needs a link');
            var list = g.videos.concat([{ id: uid('v'), url: v.url.trim(), title: v.title.trim() }]);
            save(r.id, { videos: list });
          }
        });
      });
    },
    'edit-video': function (el) {
      var vid = el.dataset.vid;
      edited(function (r, g) {
        var v0 = g.videos.filter(function (x) { return x.id === vid; })[0];
        if (!v0) return;
        App().form({
          title: 'This video',
          fields: [
            { key: 'url', label: 'Link', type: 'url', value: v0.url },
            { key: 'title', label: 'Title', value: v0.title || '' }
          ],
          onSave: function (v) {
            var list = g.videos.map(function (x) {
              return x.id === vid ? { id: x.id, url: v.url.trim(), title: v.title.trim() } : x;
            });
            save(r.id, { videos: list });
          },
          onDelete: function () {
            save(r.id, { videos: g.videos.filter(function (x) { return x.id !== vid; }) });
          },
          deleteLabel: 'Remove this video'
        });
      });
    },
    'play-video': function (el) {
      var vid = el.dataset.vid;
      edited(function (r, g) {
        var v = g.videos.filter(function (x) { return x.id === vid; })[0];
        if (!v) return;
        var src = embedUrl(v);
        if (!src) {
          global.open(v.url, '_blank', 'noopener');
          return;
        }
        // The iframe is created HERE, on the click, and nowhere
        // else. Opening the page costs no request to YouTube.
        U().openSheet(
          '<button type="button" class="asc-back" data-act="sheet-close">' +
            '<span aria-hidden="true">←</span> Back</button>' +
          '<h2 class="hd-plate">' + esc(v.title || 'Video') + '</h2>' +
          '<div class="hd-embed"><iframe src="' + attr(src) + '" title="' +
            attr(v.title || 'Video') + '" allow="autoplay; encrypted-media; picture-in-picture" ' +
            'allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' +
          '<div class="asc-sheet__acts">' +
            '<a class="asc-btn asc-btn--quiet asc-btn--sm" href="' + attr(v.url) +
              '" target="_blank" rel="noopener noreferrer">Open it on the site</a>' +
          '</div>', {});
      });
    },
    'rail-prev': function () { railBy(-1); },
    'rail-next': function () { railBy(1); },

    // ── ADDING A GAME ────────────────────────────────────────
    // The generic composer asks for the nine fields every shelf
    // shares, and they are the wrong nine here. Everything else in
    // the archive is a link to somewhere else; a game is a PLACE
    // IN THIS APP, with a status, a playtime, an artwork and a
    // page. So it gets a form shaped like a game, and saving lands
    // you on the page rather than back in a grid — because the
    // videos, the guides and the notes are the reason it has one.
    //
    // Reachable three ways on the Games shelf: the tile in the
    // mosaic, the empty state, and the + / `n` that would
    // otherwise open the composer.
    'add-game': function () {
      App().form({
        title: 'A new game',
        fields: [
          { key: 'title', label: 'Title', value: '', placeholder: 'What is it called?' },
          { key: 'creator', label: 'Studio', value: '', placeholder: 'Who made it' },
          { key: 'status', label: 'Status', value: 'In the collection',
            hint: 'Currently playing · Finished · On the shelf · Abandoned — your words.' },
          { key: 'playtime', label: 'Playtime', value: '', placeholder: '184 hours' },
          { key: 'url', label: 'Link', type: 'url', value: '',
            placeholder: 'https://… (store page, wiki, anything)' },
          { key: 'cover', label: 'Cover image', type: 'url', value: '',
            hint: 'Optional. A wide image works best — this is what the archive shows and ' +
              'what the page opens on.' }
        ],
        onSave: function (v) {
          if (!v.title.trim()) { U().toast('A game needs a title'); return false; }
          var r = global.Vault.add('games', {
            title: v.title.trim(),
            creator: v.creator.trim(),
            url: v.url.trim(),
            cover: v.cover.trim(),
            category: 'Gaming'
          });
          save(r.id, { status: v.status.trim() || 'In the collection', playtime: v.playtime.trim() });
          // Straight to the page. The form deliberately does not ask
          // for videos or articles — those want the room the page
          // gives them, not six more rows in a sheet.
          location.hash = '#/game/' + encodeURIComponent(r.id);
        }
      });
    },

    noop: function () {}
  };

  function railBy(dir) {
    var el = document.getElementById('hdRail');
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(260, el.clientWidth * 0.8), behavior: 'smooth' });
  }

  global.HDGame = {
    view: view, ACTS: ACTS, gameOf: gameOf,
    videoThumb: videoThumb, embedUrl: embedUrl
  };
})(window);
