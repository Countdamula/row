// =============================================================
// vault-game.js — the game page.
//
//   window.HDGame
//
// One record, in full: a split hero, a rail of videos, and a
// panel of columns where the notes, guides, tips and quotes live.
//
// IT IS ITS OWN FILE ON PURPOSE. This is the one template Damian
// asked to be able to change, and a template you edit should not
// be buried in the middle of a router. Everything about how a
// game LOOKS is here; everything about how the archive looks is
// in vault-views.js; nothing about how either is stored is in
// either.
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
//   columns     [ { id, title, entries: [ { id, text, source, at } ] } ]
//   entries     [ { id, title, date, body, at } ]     the journal
//
// COLUMNS ARE NOT FIXED. The reference draws Personal Notes,
// Favourite Quote and Memories; those are only the DEFAULTS, and
// they are computed on read rather than written, so a game that
// has never been edited stores nothing at all. Rename them, add
// Guides or Builds or Boss Order, delete what you do not use.
// The fourth column is the journal and is the one that stays.
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
  // Defaults are computed, never written. A game you have not
  // touched stores no columns; the three the reference shows are
  // simply what an empty panel looks like. `notes` already exists
  // on every record in this app, so where one is set it becomes
  // the first note rather than being stranded.
  function defaultColumns(r) {
    return [
      { id: 'c_notes', title: 'Personal notes',
        entries: r.notes ? [{ id: 'e_notes', text: r.notes, at: r.updatedAt || r.createdAt || 0 }] : [] },
      { id: 'c_quote', title: 'Favourite quote', entries: [] },
      { id: 'c_mem', title: 'Memories', entries: [] }
    ];
  }

  function gameOf(r) {
    return {
      status: r.status || 'In the collection',
      playtime: r.playtime || '',
      hero: r.hero || '',
      railTitle: r.railTitle || 'Moments',
      videos: Array.isArray(r.videos) ? r.videos : [],
      columns: Array.isArray(r.columns) && r.columns.length ? r.columns : defaultColumns(r),
      entries: Array.isArray(r.entries) ? r.entries : []
    };
  }

  // Writing a column or a video for the first time MATERIALISES
  // the computed defaults — otherwise adding one memory would
  // silently drop the note that was showing beside it.
  function save(id, patch) {
    global.Vault.update('games', id, patch);
  }
  function saveColumns(r, cols) { save(r.id, { columns: cols }); }

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

  // ── §A COLUMN ──────────────────────────────────────────────
  // A quote wants an attribution and a note does not, so an entry
  // carries an optional `source` and shows it only when it is
  // there. One shape, two readings — rather than two shapes that
  // drift.
  function columnHtml(c, ci) {
    return '<section class="hd-cell">' +
      '<div class="hd-cell__head">' +
        '<h3 class="hd-eyebrow">' + esc(c.title) + '</h3>' +
        '<button type="button" class="hd-cell__ren" data-act="rename-col" data-col="' + attr(c.id) + '"' +
          ' aria-label="Rename or remove ' + attr(c.title) + '">Edit</button>' +
      '</div>' +
      '<div class="hd-cell__body">' +
        (c.entries.length
          ? c.entries.map(function (e) {
              return '<button type="button" class="hd-note-item" data-act="edit-entry"' +
                ' data-col="' + attr(c.id) + '" data-eid="' + attr(e.id) + '">' +
                '<span class="hd-note-item__t">' + U().escLines(e.text || '') + '</span>' +
                (e.source ? '<span class="hd-note-item__s">— ' + esc(e.source) + '</span>' : '') +
                '</button>';
            }).join('')
          : '<p class="hd-cell__none">Nothing here yet.</p>') +
      '</div>' +
      '<button type="button" class="hd-cell__add" data-act="add-entry" data-col="' + attr(c.id) + '"' +
        ' aria-label="Add to ' + attr(c.title) + '">+</button>' +
    '</section>';
  }

  function journalCell(g) {
    var list = g.entries.slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || '')) || (b.at || 0) - (a.at || 0);
    });
    return '<section class="hd-cell hd-cell--journal">' +
      '<div class="hd-cell__head"><h3 class="hd-eyebrow">Journal entries</h3></div>' +
      '<div class="hd-cell__body">' +
        (list.length
          ? '<ul class="hd-jlist">' + list.slice(0, 5).map(function (e) {
              return '<li><button type="button" data-act="edit-journal" data-eid="' + attr(e.id) + '">' +
                '<b>' + esc(e.title || 'Untitled') + '</b>' +
                '<i>' + esc(H().prettyDate(e.date)) + '</i></button></li>';
            }).join('') + '</ul>'
          : '<p class="hd-cell__none">No entries yet. A long guide belongs here — an entry has a body.</p>') +
      '</div>' +
      // It linked to #/journal until that page was removed. The
      // entries did not go anywhere, so neither did the link — it
      // opens the full set in a sheet instead of navigating.
      (list.length > 5
        ? '<div class="hd-cell__foot">' +
            '<button type="button" class="hd-link hd-link--quiet" data-act="all-entries">' +
            H().arrow('All ' + list.length + ' entries') + '</button>' +
          '</div>'
        : '') +
      '<button type="button" class="hd-cell__add" data-act="add-journal" aria-label="Add a journal entry">+</button>' +
    '</section>';
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
            (g.entries.length
              ? '<button type="button" class="hd-link hd-link--quiet" data-act="all-entries">' +
                H().arrow('Read the entries') + '</button>'
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

      '<section class="hd-cells">' +
        g.columns.map(columnHtml).join('') +
        journalCell(g) +
      '</section>' +

      '<div class="hd-game__foot">' +
        '<button type="button" class="hd-link hd-link--quiet" data-act="add-col">' +
          H().arrow('Add a column — guides, tips, builds, anything') + '</button>' +
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
            save(r.id, { videos: list, columns: g.columns });
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

    'add-col': function () {
      edited(function (r, g) {
        App().form({
          title: 'A new column',
          fields: [{ key: 'title', label: 'Heading', value: '',
            placeholder: 'Guides · Tips · Builds · Boss order' }],
          onSave: function (v) {
            if (!v.title.trim()) return U().toast('Give the column a heading');
            saveColumns(r, g.columns.concat([{ id: uid('c'), title: v.title.trim(), entries: [] }]));
          }
        });
      });
    },
    'rename-col': function (el) {
      var cid = el.dataset.col;
      edited(function (r, g) {
        var c = g.columns.filter(function (x) { return x.id === cid; })[0];
        if (!c) return;
        App().form({
          title: 'This column',
          fields: [{ key: 'title', label: 'Heading', value: c.title }],
          onSave: function (v) {
            saveColumns(r, g.columns.map(function (x) {
              return x.id === cid ? Object.assign({}, x, { title: v.title.trim() || x.title }) : x;
            }));
          },
          onDelete: function () {
            saveColumns(r, g.columns.filter(function (x) { return x.id !== cid; }));
          },
          deleteLabel: 'Remove this column' +
            (c.entries.length ? ' and its ' + c.entries.length + ' notes' : '')
        });
      });
    },
    'add-entry': function (el) {
      var cid = el.dataset.col;
      edited(function (r, g) {
        App().form({
          title: 'Add a note',
          fields: [
            { key: 'text', label: 'Note', type: 'textarea', value: '' },
            { key: 'source', label: 'Attribution', value: '', placeholder: 'Optional — who said it' }
          ],
          onSave: function (v) {
            if (!v.text.trim()) return U().toast('Nothing to save');
            saveColumns(r, g.columns.map(function (x) {
              return x.id === cid
                ? Object.assign({}, x, { entries: x.entries.concat([
                    { id: uid('e'), text: v.text.trim(), source: v.source.trim(), at: Date.now() }]) })
                : x;
            }));
          }
        });
      });
    },
    'edit-entry': function (el) {
      var cid = el.dataset.col, eid = el.dataset.eid;
      edited(function (r, g) {
        var c = g.columns.filter(function (x) { return x.id === cid; })[0];
        var e = c && c.entries.filter(function (x) { return x.id === eid; })[0];
        if (!e) return;
        App().form({
          title: 'This note',
          fields: [
            { key: 'text', label: 'Note', type: 'textarea', value: e.text || '' },
            { key: 'source', label: 'Attribution', value: e.source || '' }
          ],
          onSave: function (v) {
            saveColumns(r, g.columns.map(function (x) {
              return x.id !== cid ? x : Object.assign({}, x, {
                entries: x.entries.map(function (y) {
                  return y.id === eid
                    ? Object.assign({}, y, { text: v.text.trim(), source: v.source.trim() })
                    : y;
                })
              });
            }));
          },
          onDelete: function () {
            saveColumns(r, g.columns.map(function (x) {
              return x.id !== cid ? x : Object.assign({}, x, {
                entries: x.entries.filter(function (y) { return y.id !== eid; })
              });
            }));
          },
          deleteLabel: 'Delete this note'
        });
      });
    },

    'add-journal': function () {
      edited(function (r, g) {
        App().form({
          title: 'A journal entry',
          fields: [
            { key: 'title', label: 'Title', value: '' },
            { key: 'date', label: 'Date', type: 'date', value: today() },
            { key: 'body', label: 'Entry', type: 'textarea', value: '', tall: true,
              hint: 'A long guide belongs here. It opens in full from the journal.' }
          ],
          onSave: function (v) {
            if (!v.title.trim() && !v.body.trim()) return U().toast('Nothing to save');
            save(r.id, {
              entries: g.entries.concat([{
                id: uid('j'), title: v.title.trim() || 'Untitled',
                date: v.date || today(), body: v.body.trim(), at: Date.now()
              }]),
              columns: g.columns
            });
          }
        });
      });
    },
    'edit-journal': function (el) {
      var eid = el.dataset.eid;
      edited(function (r, g) {
        var e = g.entries.filter(function (x) { return x.id === eid; })[0];
        if (!e) return;
        App().form({
          title: 'This entry',
          fields: [
            { key: 'title', label: 'Title', value: e.title || '' },
            { key: 'date', label: 'Date', type: 'date', value: e.date || today() },
            { key: 'body', label: 'Entry', type: 'textarea', value: e.body || '', tall: true }
          ],
          onSave: function (v) {
            save(r.id, { entries: g.entries.map(function (x) {
              return x.id === eid
                ? Object.assign({}, x, { title: v.title.trim() || 'Untitled', date: v.date, body: v.body.trim() })
                : x;
            }) });
          },
          onDelete: function () {
            save(r.id, { entries: g.entries.filter(function (x) { return x.id !== eid; }) });
          },
          deleteLabel: 'Delete this entry'
        });
      });
    },

    // What replaced the Journal page. Every entry on THIS game, in
    // date order, read in a sheet — the cross-game feed is gone,
    // the writing is not.
    'all-entries': function () {
      edited(function (r, g) {
        var list = g.entries.slice().sort(function (a, b) {
          return String(b.date || '').localeCompare(String(a.date || '')) || (b.at || 0) - (a.at || 0);
        });
        U().openSheet(
          '<button type="button" class="asc-back" data-act="sheet-close">' +
            '<span aria-hidden="true">←</span> Back</button>' +
          '<h2 class="hd-plate">' + esc(r.title) + '</h2>' +
          '<p class="asc-label">' + list.length +
            (list.length === 1 ? ' entry' : ' entries') + '</p>' +
          (list.length
            ? '<div class="hd-entries">' + list.map(function (e) {
                return '<article class="hd-entry">' +
                  '<h3>' + esc(e.title || 'Untitled') + '</h3>' +
                  '<p class="asc-label">' + esc(H().prettyDate(e.date)) + '</p>' +
                  (e.body ? '<p class="asc-body">' + U().escLines(e.body) + '</p>' : '') +
                  '<button type="button" class="hd-link hd-link--quiet" data-act="edit-journal" ' +
                    'data-eid="' + attr(e.id) + '">Edit this entry</button>' +
                '</article>';
              }).join('') + '</div>'
            : '<p class="asc-body hd-dim">Nothing written yet.</p>') +
          '<div class="asc-sheet__acts">' +
            '<button type="button" class="asc-btn asc-btn--sm" data-act="add-journal">' +
              'Add an entry</button>' +
          '</div>', {});
      });
    },

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
          // for videos, notes or a journal — those want the room the
          // page gives them, not six more rows in a sheet.
          location.hash = '#/game/' + encodeURIComponent(r.id);
        }
      });
    },

    noop: function () {}
  };

  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function railBy(dir) {
    var el = document.getElementById('hdRail');
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(260, el.clientWidth * 0.8), behavior: 'smooth' });
  }

  global.HDGame = {
    view: view, ACTS: ACTS, gameOf: gameOf, defaultColumns: defaultColumns,
    videoThumb: videoThumb, embedUrl: embedUrl, today: today
  };
})(window);
