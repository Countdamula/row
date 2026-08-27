// =============================================================
// futureself-ui.js — the Future Self Profile.
//
// TWO LAYERS, AND THE SPLIT IS THE WHOLE DESIGN.
//
//   Layer 1 is what the page IS: a hero, a quote, this season's five
//   things, a collage, identity lines, trait chips, seven life cards,
//   a day, a feed of evidence. It should read like a magazine about a
//   life, and it should be readable in thirty seconds.
//
//   Layer 2 opens on click: the long body, the full gallery, every
//   quote, the whole letter. Nothing in layer 2 is on screen until it
//   is asked for.
//
// Get that wrong in the obvious direction — put every field on the
// page because every field is editable — and this becomes the Notion
// database wall the brief explicitly did not want.
//
// Editing is layer 2 as well: the page is not a form. A section's
// pencil opens a sheet; the page itself stays type and pictures.
// =============================================================

(function (global) {
  'use strict';

  var F = null;
  var openGallery = null;   // category id, when the board is expanded
  var quoteFilter = 'All';
  var saveTimers = {};

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function nl2br(v) { return esc(v).replace(/\n/g, '<br>'); }
  function byId(id) { return document.getElementById(id); }
  // Each entry is { t, fn }, not a bare timer id, because flushSaves() has to be
  // able to RUN a pending write rather than only cancel it.
  function debounce(k, fn, ms) {
    if (saveTimers[k]) clearTimeout(saveTimers[k].t);
    saveTimers[k] = {
      fn: fn,
      t: setTimeout(function () { delete saveTimers[k]; fn(); }, ms == null ? 1200 : ms)
    };
  }
  // Run the pending writes. This used to clearTimeout() them and stop there,
  // which SILENTLY DROPPED every edit made in the last 1200ms before the call —
  // and the two callers are go() and pagehide, i.e. exactly the moment you stop
  // typing and click away. Same shape as palaestra-data.js's autosave flush
  // sweep and kdp-nav.js's saver.flush(), both of which always ran the callback.
  function flushSaves() {
    var pending = saveTimers;
    saveTimers = {};
    Object.keys(pending).forEach(function (k) {
      clearTimeout(pending[k].t);
      try { pending[k].fn(); } catch (e) {}
    });
  }

  /** Leaving the page must not lose a write that has not committed. */
  function go(href) {
    flushSaves();
    if (global.LocalStoreIDB && global.LocalStoreIDB.navigate) global.LocalStoreIDB.navigate(href);
    else global.location.href = href;
  }
  function toast(msg, bad) {
    var t = byId('mnToast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'mn-toast is-on' + (bad ? ' mn-toast--bad' : '');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.className = 'mn-toast'; }, bad ? 5000 : 2400);
  }
  function pencil(act, id, label) {
    return '<button type="button" class="bs-icon-btn" data-act="' + act + '"' +
      (id ? ' data-id="' + esc(id) + '"' : '') +
      ' title="' + esc(label || 'Edit') + '" aria-label="' + esc(label || 'Edit') + '">&#9998;</button>';
  }
  function head(title, asideHtml, id) {
    return '<div class="mn-section__head"' + (id ? ' id="' + id + '"' : '') + '>' +
      '<h2 class="mn-plate mn-plate--lg">' + esc(title) + '</h2>' +
      '<div class="mn-section__aside">' + (asideHtml || '') + '</div>' +
      '</div><hr class="mn-rule">';
  }

  // ============================================================
  // 14 · CURRENT FOCUS — first on the page, because it is the only
  // part you are meant to act on today.
  // ============================================================
  function renderFocus() {
    var f = F.getFocus();
    var rows = [
      ['Identity I am practising', f.identity],
      ['Trait I am developing', f.trait],
      ['Standard I am raising', f.standard],
      ['Habit I am reinforcing', f.habit],
      ['What I am leaving behind', f.leavingBehind]
    ];
    var filled = rows.filter(function (r) { return r[1]; }).length;

    byId('fsFocus').innerHTML =
      head('This season', (f.season ? '<span class="mn-label mn-label--gold">' + esc(f.season) + '</span>' : '') + pencil('edit-focus', '', 'Edit this season')) +
      (filled
        ? '<div class="fs-focus">' + rows.map(function (r) {
            return '<div class="fs-focus__row">' +
              '<span class="mn-label">' + esc(r[0]) + '</span>' +
              '<span class="fs-focus__val' + (r[1] ? '' : ' is-empty') + '">' + (r[1] ? esc(r[1]) : 'Not set') + '</span>' +
              '</div>';
          }).join('') + '</div>' +
          '<p class="mn-small" style="margin-top:16px">The whole vision, reduced to five things you can actually embody today.</p>'
        : '<div class="mn-empty"><p>Nothing set for this season yet.</p>' +
          '<button type="button" class="mn-btn" data-act="edit-focus" style="margin-top:14px">Set this season</button></div>');
  }

  // ============================================================
  // 8 · QUOTE OF THE MOMENT — layer 1 is one quote.
  // ============================================================
  function renderQuoteOfMoment() {
    var q = F.quoteOfMoment();
    byId('fsQuoteMoment').innerHTML = q
      ? '<figure class="fs-quote">' +
          '<blockquote class="fs-quote__text">' + esc(q.text) + '</blockquote>' +
          (q.author ? '<figcaption class="mn-label">' + esc(q.author) + '</figcaption>' : '') +
        '</figure>'
      : '<div class="mn-empty" style="max-width:44ch;margin:0 auto">' +
          '<p>No quote of the moment yet.</p>' +
          '<button type="button" class="mn-btn mn-btn--sm" style="margin-top:14px" data-act="add-quote">Add the first one</button>' +
        '</div>';
  }

  // ============================================================
  // 2 · VISUAL IDENTITY BOARD
  // ============================================================
  function renderBoard() {
    var cats = F.BoardCategories.sorted();
    var collage = F.mainCollage(12);

    var body;
    if (openGallery) {
      var cat = F.BoardCategories.get(openGallery);
      var imgs = F.imagesIn(openGallery);
      body =
        '<div class="mn-row mn-row--between" style="margin-bottom:18px">' +
          '<div><h3 class="mn-h3">' + esc(cat ? cat.name : '') + '</h3>' +
            (cat && cat.description ? '<p class="mn-small">' + esc(cat.description) + '</p>' : '') + '</div>' +
          '<div class="mn-row">' +
            '<button type="button" class="mn-btn mn-btn--sm" data-act="add-image" data-id="' + esc(openGallery) + '">Add an image</button>' +
            '<button type="button" class="mn-btn mn-btn--sm mn-btn--ghost" data-act="close-gallery">Back to the board</button>' +
          '</div>' +
        '</div>' +
        (imgs.length
          ? '<div class="fs-gallery">' + imgs.map(imgTile).join('') + '</div>'
          : '<div class="mn-empty">Nothing in ' + esc(cat ? cat.name : 'here') + ' yet.</div>');
    } else {
      body =
        (collage.length
          ? '<div class="fs-collage">' + collage.map(imgTile).join('') + '</div>'
          : '<div class="mn-empty"><p>No images yet. Open a category and start putting the life somewhere you can see it.</p></div>') +
        '<div class="fs-cats">' + cats.map(function (c) {
          var n = F.imagesIn(c.id).length;
          return '<button type="button" class="fs-cat" data-act="open-gallery" data-id="' + esc(c.id) + '">' +
            '<span class="fs-cat__name">' + esc(c.name) + '</span>' +
            '<span class="fs-cat__n">' + n + '</span>' +
            '</button>';
        }).join('') + '</div>';
    }

    byId('fsBoard').innerHTML = head('What it looks like', '') + body;
  }
  function imgTile(im) {
    return '<figure class="fs-img' + (im.isMain ? ' is-main' : '') + '">' +
      (im.url ? '<img src="' + esc(im.url) + '" alt="' + esc(im.caption) + '" loading="lazy">' : '<span class="fs-img__ph">—</span>') +
      '<figcaption>' +
        (im.caption ? '<span>' + esc(im.caption) + '</span>' : '<span></span>') +
        '<span class="fs-img__acts">' +
          '<button type="button" class="bs-icon-btn" data-act="toggle-main" data-id="' + esc(im.id) + '" title="' +
            (im.isMain ? 'Remove from the front collage' : 'Show on the front collage') + '">' + (im.isMain ? '&#9733;' : '&#9734;') + '</button>' +
          '<button type="button" class="bs-icon-btn is-del" data-act="del-image" data-id="' + esc(im.id) + '" title="Remove">&#10005;</button>' +
        '</span>' +
      '</figcaption>' +
    '</figure>';
  }

  // ============================================================
  // 3 · THIS IS ME  +  4 · TRAITS
  // ============================================================
  function renderIdentity() {
    var st = F.getIdentity().statements.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    byId('fsIdentity').innerHTML =
      head('This is me', pencil('edit-identity', '', 'Edit these statements')) +
      (st.length
        ? '<ul class="fs-statements">' + st.map(function (x) {
            return '<li>' + esc(x.text) + '</li>';
          }).join('') + '</ul>'
        : '<div class="mn-empty">No statements yet.</div>');
  }

  function renderTraits() {
    byId('fsTraits').innerHTML =
      head('Traits', '<button type="button" class="mn-btn mn-btn--sm" data-act="add-trait">Add a trait</button>') +
      '<div class="fs-bands">' + F.TRAIT_BANDS.map(function (b) {
        var list = F.traitsIn(b.key);
        return '<div class="fs-band" data-band="' + b.key + '">' +
          '<p class="mn-plate mn-plate--sm">' + esc(b.label) + '</p>' +
          '<p class="mn-small" style="margin:6px 0 14px">' + esc(b.note) + '</p>' +
          (list.length
            ? '<div class="mn-row" style="gap:7px">' + list.map(function (t) {
                return '<button type="button" class="fs-trait" data-act="edit-trait" data-id="' + esc(t.id) + '"' +
                  (t.note ? ' title="' + esc(t.note) + '"' : '') + '>' + esc(t.name) + '</button>';
              }).join('') + '</div>'
            : '<p class="mn-small" style="opacity:.6">Nothing here yet.</p>') +
        '</div>';
      }).join('') + '</div>';
  }

  // ============================================================
  // 5 · FUTURE SELF BY LIFE AREA
  // ============================================================
  function renderAreas() {
    var areas = F.Areas.sorted();
    byId('fsAreas').innerHTML =
      head('My future life', '') +
      (areas.length
        ? '<div class="fs-areas">' + areas.map(function (a) {
            var meta = F.AREAS.find(function (x) { return x.key === a.area; });
            var hasMore = a.body || a.bullets.length > 3 || a.shed.length;
            return '<article class="mn-card fs-area' + (a.area === 'work' ? ' fs-area--lead' : '') + '">' +
              '<div class="mn-card__head">' +
                '<p class="mn-plate mn-plate--sm">' + esc(meta ? meta.label : a.area) + '</p>' +
                pencil('edit-area', a.id, 'Edit ' + (meta ? meta.label : a.area)) +
              '</div>' +
              (a.image ? '<img class="fs-area__img" src="' + esc(a.image) + '" alt="" loading="lazy">' : '') +
              (a.headline ? '<p class="fs-area__head">' + esc(a.headline) + '</p>' : '') +
              (a.bullets.length
                ? '<ul class="fs-list">' + a.bullets.slice(0, 4).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>'
                : '') +
              (hasMore
                ? '<button type="button" class="mn-btn mn-btn--sm mn-btn--ghost" style="margin-top:14px" data-act="open-area" data-id="' + esc(a.id) + '">Read more</button>'
                : '') +
            '</article>';
          }).join('') + '</div>'
        : '<div class="mn-empty">Nothing written yet.</div>');
  }

  // ============================================================
  // 6 · A NORMAL DAY
  // ============================================================
  function renderDay() {
    var rows = F.Day.sorted();
    byId('fsDay').innerHTML =
      head('A normal day', '<button type="button" class="mn-btn mn-btn--sm" data-act="add-day">Add an hour</button>') +
      '<p class="mn-lede" style="margin-bottom:24px">Not the fantasy perfect day. The ordinary Tuesday.</p>' +
      (rows.length
        ? '<ol class="fs-day">' + rows.map(function (r) {
            return '<li class="fs-day__row" data-act="edit-day" data-id="' + esc(r.id) + '" tabindex="0" role="button">' +
              '<span class="fs-day__time">' + esc(r.time || '—') + '</span>' +
              '<span class="fs-day__main">' +
                '<span class="fs-day__title">' + esc(r.title) + '</span>' +
                (r.detail ? '<span class="fs-day__detail">' + esc(r.detail) + '</span>' : '') +
              '</span>' +
            '</li>';
          }).join('') + '</ol>'
        : '<div class="mn-empty">The day is not written yet.</div>');
  }

  // ============================================================
  // 9 · FUTURE MEMORIES
  // ============================================================
  function renderMemories() {
    var list = F.Memories.sorted();
    byId('fsMemories').innerHTML =
      head('Future memories', '<button type="button" class="mn-btn mn-btn--sm" data-act="add-memory">Write one</button>') +
      '<p class="mn-lede" style="margin-bottom:24px">Scenes written as though they have already happened. A scrapbook from the other side.</p>' +
      (list.length
        ? '<div class="fs-memories">' + list.map(function (m) {
            return '<article class="mn-card fs-memory" data-act="open-memory" data-id="' + esc(m.id) + '" tabindex="0" role="button">' +
              (m.imageUrl ? '<img class="fs-memory__img" src="' + esc(m.imageUrl) + '" alt="" loading="lazy">' : '') +
              '<div class="mn-row" style="gap:10px">' +
                (m.dateText ? '<span class="mn-label">' + esc(m.dateText) + '</span>' : '') +
                (m.emotion ? '<span class="bs-tag is-accent">' + esc(m.emotion) + '</span>' : '') +
              '</div>' +
              '<h3 class="mn-h3" style="margin-top:10px">' + esc(m.title) + '</h3>' +
              (m.body ? '<p class="fs-memory__body">' + esc(m.body) + '</p>' : '') +
            '</article>';
          }).join('') + '</div>'
        : '<div class="mn-empty">Nothing remembered from the future yet.</div>');
  }

  // ============================================================
  // 12 · BECOMING → BEING
  // ============================================================
  function renderDimensions() {
    var rows = F.Dimensions.sorted();
    byId('fsBecoming').innerHTML =
      head('Becoming &rarr; being', pencil('edit-dimensions', '', 'Edit both columns')) +
      '<p class="mn-lede" style="margin-bottom:20px">Not a scoreboard. Only a way of seeing where the distance is.</p>' +
      (rows.length
        ? '<div class="fs-becoming">' +
            '<div class="fs-becoming__head"><span class="mn-label">Now</span><span></span><span class="mn-label mn-label--cool">Then</span></div>' +
            rows.map(function (r) {
              return '<div class="fs-becoming__row">' +
                '<span class="fs-becoming__cur">' + (r.current ? esc(r.current) : '<span class="is-empty">—</span>') + '</span>' +
                '<span class="fs-becoming__label">' + esc(r.label) + '</span>' +
                '<span class="fs-becoming__fut">' + (r.future ? esc(r.future) : '<span class="is-empty">—</span>') + '</span>' +
              '</div>';
            }).join('') +
          '</div>'
        : '<div class="mn-empty">Nothing compared yet.</div>');
  }

  // ============================================================
  // 7 · STANDARDS  +  11 · MORE / LESS
  // ============================================================
  function renderStandards() {
    var always = F.standardsOf('always');
    var never = F.standardsOf('never');
    byId('fsStandards').innerHTML =
      head('My standards', pencil('edit-standards', '', 'Edit the standards')) +
      '<p class="mn-lede" style="margin-bottom:20px">Traits are who I am. Standards are what I accept.</p>' +
      '<div class="mn-grid2">' +
        '<div class="mn-card"><p class="mn-plate mn-plate--sm" style="margin-bottom:16px">I always</p>' +
          (always.length ? '<ul class="fs-list fs-list--warm">' + always.map(function (x) { return '<li>' + esc(x.text) + '</li>'; }).join('') + '</ul>' : '<p class="mn-small">Nothing yet.</p>') +
        '</div>' +
        '<div class="mn-card"><p class="mn-plate mn-plate--sm" style="margin-bottom:16px">I don&rsquo;t</p>' +
          (never.length ? '<ul class="fs-list fs-list--cool">' + never.map(function (x) { return '<li>' + esc(x.text) + '</li>'; }).join('') + '</ul>' : '<p class="mn-small">Nothing yet.</p>') +
        '</div>' +
      '</div>';
  }

  function renderMoreLess() {
    var more = F.morelessOf('more');
    var less = F.morelessOf('less');
    var n = Math.max(more.length, less.length);
    var rows = '';
    for (var i = 0; i < n; i++) {
      rows += '<div class="fs-ml__row">' +
        '<span class="fs-ml__more">' + esc(more[i] ? more[i].text : '') + '</span>' +
        '<span class="fs-ml__less">' + esc(less[i] ? less[i].text : '') + '</span>' +
        '</div>';
    }
    byId('fsMoreLess').innerHTML =
      head('More, less', pencil('edit-moreless', '', 'Edit more and less')) +
      (n
        ? '<div class="fs-ml">' +
            '<div class="fs-ml__head"><span class="mn-plate mn-plate--sm">More</span><span class="mn-plate mn-plate--sm">Less</span></div>' +
            rows +
          '</div>'
        : '<div class="mn-empty">Nothing set yet.</div>');
  }

  // ============================================================
  // 13 · EVIDENCE
  // ============================================================
  function renderEvidence() {
    var feed = F.evidenceFeed(14);
    var total = F.Evidence.list().length;
    byId('fsEvidence').innerHTML =
      head('Evidence I am becoming him',
        '<button type="button" class="mn-btn mn-btn--sm" data-act="add-evidence">Add today&rsquo;s</button>' +
        (total > 14 ? '<span class="mn-label">' + total + ' in all</span>' : '')) +
      '<p class="mn-lede" style="margin-bottom:20px">This is what keeps the page from being fantasy.</p>' +
      (feed.length
        ? '<ul class="fs-evidence">' + feed.map(function (e) {
            return '<li>' +
              '<span class="fs-evidence__date">' + esc(prettyShort(e.date)) + '</span>' +
              '<span class="fs-evidence__text">' + esc(e.text) + '</span>' +
              (e.source === 'weeklyreview' ? '<span class="bs-tag">Weekly review</span>' : '') +
              '<button type="button" class="bs-icon-btn is-del" data-act="del-evidence" data-id="' + esc(e.id) + '" aria-label="Remove">&#10005;</button>' +
            '</li>';
          }).join('') + '</ul>' +
          (total > 14 ? '<button type="button" class="mn-btn mn-btn--sm mn-btn--ghost" style="margin-top:16px" data-act="all-evidence">See all ' + total + '</button>' : '')
        : '<div class="mn-empty">No evidence logged yet. The first one can be today.</div>');
  }
  function prettyShort(iso) {
    var p = String(iso).split('-');
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  // ============================================================
  // 8b · QUOTES  ·  10 · NOTES  ·  15 · LETTERS
  // ============================================================
  function renderQuotes() {
    var core = F.coreQuotes();
    byId('fsQuotes').innerHTML =
      head('Quotes and philosophy',
        '<button type="button" class="mn-btn mn-btn--sm" data-act="add-quote">Add</button>' +
        '<button type="button" class="mn-btn mn-btn--sm mn-btn--ghost" data-act="all-quotes">All quotes &rarr;</button>') +
      (core.length
        ? '<div class="fs-quotes">' + core.map(function (q) {
            return '<figure class="fs-quotecard" data-act="edit-quote" data-id="' + esc(q.id) + '" tabindex="0" role="button">' +
              '<blockquote>' + esc(q.text) + '</blockquote>' +
              '<figcaption class="mn-label">' + esc(q.author || '') + (q.category ? ' · ' + esc(q.category) : '') + '</figcaption>' +
            '</figure>';
          }).join('') + '</div>'
        : '<div class="mn-empty">No core quotes yet. Mark five to ten as core and they show here; the rest live behind “All quotes”.</div>');
  }

  function renderNotes() {
    var list = F.Notes.list().sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    byId('fsNotes').innerHTML =
      head('Notes from future me', '<button type="button" class="mn-btn mn-btn--sm" data-act="add-note">Add</button>') +
      '<p class="mn-lede" style="margin-bottom:20px">Deliberately messy. Realisations, things you want, images to find, things that no longer fit. Nothing here has to be categorised.</p>' +
      '<textarea class="mn-textarea" id="fsNoteQuick" rows="2" placeholder="Type it and press Enter…"></textarea>' +
      (list.length
        ? '<div class="fs-notes">' + list.map(function (n) {
            return '<div class="fs-note' + (n.pinned ? ' is-pinned' : '') + '">' +
              '<p>' + nl2br(n.text) + '</p>' +
              '<div class="fs-note__acts">' +
                '<button type="button" class="bs-icon-btn' + (n.pinned ? ' is-star is-active' : '') + '" data-act="pin-note" data-id="' + esc(n.id) + '" aria-label="Pin">' + (n.pinned ? '&#9733;' : '&#9734;') + '</button>' +
                '<button type="button" class="bs-icon-btn" data-act="edit-note" data-id="' + esc(n.id) + '" aria-label="Edit">&#9998;</button>' +
                '<button type="button" class="bs-icon-btn is-del" data-act="del-note" data-id="' + esc(n.id) + '" aria-label="Delete">&#10005;</button>' +
              '</div>' +
            '</div>';
          }).join('') + '</div>'
        : '');
  }

  function renderLetters() {
    var list = F.lettersNewestFirst();
    byId('fsLetters').innerHTML =
      head('Letters to future me', '<button type="button" class="mn-btn mn-btn--sm" data-act="add-letter">Write one</button>') +
      (list.length
        ? '<div class="mn-stack">' + list.map(function (l) {
            var sealed = F.letterIsSealed(l);
            return '<article class="mn-card fs-letter' + (sealed ? ' is-sealed' : '') + '" data-act="open-letter" data-id="' + esc(l.id) + '" tabindex="0" role="button">' +
              '<div class="mn-row mn-row--between">' +
                '<span class="mn-label">' + esc(new Date(l.writtenAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })) + '</span>' +
                (sealed ? '<span class="mn-label mn-label--cool">Sealed until ' + esc(l.openAt) + '</span>' : '') +
              '</div>' +
              '<h3 class="mn-h3" style="margin-top:8px">' + esc(l.title || 'Untitled') + '</h3>' +
              (sealed
                ? '<p class="mn-small" style="margin-top:8px">Not yet.</p>'
                : '<p class="fs-letter__peek">' + esc(String(l.body).slice(0, 180)) + (String(l.body).length > 180 ? '…' : '') + '</p>') +
            '</article>';
          }).join('') + '</div>'
        : '<div class="mn-empty">No letters yet.</div>');
  }

  // ============================================================
  // SHEETS — every editor, and every layer-2 read.
  // ============================================================
  function openSheet(html, wide) {
    var bg = byId('mnSheetBg'), sheet = byId('mnSheet');
    sheet.className = 'mn-sheet' + (wide ? ' mn-sheet--wide' : '');
    sheet.innerHTML = html;
    bg.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var first = sheet.querySelector('input, textarea, select');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }
  function closeSheet() {
    byId('mnSheetBg').classList.remove('is-open');
    document.body.style.overflow = '';
  }
  function sheetHead(title) {
    return '<div class="mn-sheet__head"><h3 class="mn-plate mn-plate--md">' + esc(title) + '</h3>' +
      '<button type="button" class="bs-modal-close" data-act="close-sheet" aria-label="Close">&#10005;</button></div>';
  }
  function actions(saveAct, delAct) {
    return '<div class="mn-sheet__actions">' +
      (delAct ? '<button type="button" class="mn-btn mn-btn--ghost" data-act="' + delAct + '" style="margin-right:auto;color:var(--mn-bad)">Delete</button>' : '') +
      '<button type="button" class="mn-btn" data-act="close-sheet">Cancel</button>' +
      (saveAct ? '<button type="button" class="mn-btn mn-btn--primary" data-act="' + saveAct + '">Save</button>' : '') +
      '</div>';
  }
  function field(id, label, value, type, rows) {
    if (type === 'textarea') {
      return '<div class="mn-field" style="margin-top:14px"><label class="mn-label" for="' + id + '">' + esc(label) + '</label>' +
        '<textarea class="mn-textarea" id="' + id + '" rows="' + (rows || 3) + '">' + esc(value) + '</textarea></div>';
    }
    return '<div class="mn-field" style="margin-top:14px"><label class="mn-label" for="' + id + '">' + esc(label) + '</label>' +
      '<input class="mn-input" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value) + '"></div>';
  }
  /** A repeatable one-line-per-row editor, used by half the sheets. */
  function lineRows(hostId, list, placeholder) {
    return '<div id="' + hostId + '" class="mn-stack--tight" style="display:flex;flex-direction:column;margin-top:10px">' +
      (list.length ? list.map(function (t) { return lineRow(t); }).join('') : lineRow('')) +
      '</div>' +
      '<button type="button" class="mn-btn mn-btn--sm" style="margin-top:10px" data-act="add-line" data-host="' + hostId + '">Add a line</button>' +
      (placeholder ? '<p class="mn-small" style="margin-top:8px">' + esc(placeholder) + '</p>' : '');
  }
  function lineRow(text) {
    return '<div class="mn-row" data-line>' +
      '<input class="mn-input" value="' + esc(text) + '">' +
      '<button type="button" class="bs-icon-btn is-del" data-act="rm-line" aria-label="Remove">&#10005;</button>' +
      '</div>';
  }
  function readLines(hostId) {
    var host = byId(hostId);
    if (!host) return [];
    return Array.prototype.map.call(host.querySelectorAll('[data-line] input'), function (i) { return i.value.trim(); })
      .filter(Boolean);
  }

  var sheetCtx = {};   // what the open sheet is editing

  function openFocusEditor() {
    var f = F.getFocus();
    openSheet(sheetHead('This season') +
      '<p class="mn-small">Five things. Not the vision — the part of it you are practising now.</p>' +
      field('fcSeason', 'Season', f.season) +
      field('fcIdentity', 'Identity I am practising', f.identity) +
      field('fcTrait', 'Trait I am developing', f.trait) +
      field('fcStandard', 'Standard I am raising', f.standard) +
      field('fcHabit', 'Habit I am reinforcing', f.habit) +
      field('fcLeaving', 'What I am leaving behind', f.leavingBehind) +
      actions('save-focus'));
  }

  function openIdentityEditor() {
    var st = F.getIdentity().statements.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    openSheet(sheetHead('This is me') +
      '<p class="mn-small">Identity statements, present tense. Not “I want to become disciplined” — “I am disciplined even when I don’t feel motivated.”</p>' +
      lineRows('idnRows', st.map(function (x) { return x.text; })) +
      actions('save-identity'));
  }

  function openTraitEditor(id) {
    var t = id ? F.Traits.get(id) : null;
    sheetCtx = { id: id };
    openSheet(sheetHead(t ? 'Trait' : 'New trait') +
      field('trName', 'Trait', t ? t.name : '') +
      '<div class="mn-field" style="margin-top:14px"><label class="mn-label" for="trBand">Band</label>' +
        '<select class="mn-select" id="trBand">' + F.TRAIT_BANDS.map(function (b) {
          return '<option value="' + b.key + '"' + (t && t.band === b.key ? ' selected' : '') + '>' + esc(b.label) + '</option>';
        }).join('') + '</select></div>' +
      field('trNote', 'Note', t ? t.note : '', 'textarea', 2) +
      actions('save-trait', t ? 'del-trait' : null));
  }

  function openAreaEditor(id) {
    var a = F.Areas.get(id);
    if (!a) return;
    var meta = F.AREAS.find(function (x) { return x.key === a.area; });
    sheetCtx = { id: id };
    openSheet(sheetHead(meta ? meta.label : a.area) +
      field('arHead', 'Headline — the one line shown on the card', a.headline, 'textarea', 2) +
      '<p class="mn-label" style="margin-top:20px">Bullets</p>' + lineRows('arBullets', a.bullets) +
      '<p class="mn-label" style="margin-top:20px">No longer</p>' + lineRows('arShed', a.shed, 'Things he no longer believes or does.') +
      field('arBody', 'The long version', a.body, 'textarea', 6) +
      field('arImage', 'Image URL', a.image) +
      actions('save-area'), true);
  }

  function openAreaRead(id) {
    var a = F.Areas.get(id);
    if (!a) return;
    var meta = F.AREAS.find(function (x) { return x.key === a.area; });
    openSheet(sheetHead(meta ? meta.label : a.area) +
      (a.image ? '<img src="' + esc(a.image) + '" alt="" style="width:100%;border-radius:var(--mn-radius-sm);margin-bottom:20px">' : '') +
      (a.headline ? '<p class="mn-h3" style="margin-bottom:18px">' + esc(a.headline) + '</p>' : '') +
      (a.bullets.length ? '<ul class="fs-list">' + a.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' : '') +
      (a.body ? '<p class="mn-body" style="margin-top:20px;max-width:none">' + nl2br(a.body) + '</p>' : '') +
      (a.shed.length
        ? '<p class="mn-plate mn-plate--sm" style="margin-top:26px">No longer</p>' +
          '<ul class="fs-list fs-list--cool" style="margin-top:12px">' + a.shed.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>'
        : '') +
      '<div class="mn-sheet__actions">' +
        '<button type="button" class="mn-btn" data-act="edit-area" data-id="' + esc(id) + '">Edit</button>' +
        '<button type="button" class="mn-btn mn-btn--primary" data-act="close-sheet">Done</button>' +
      '</div>', true);
  }

  function openDayEditor(id) {
    var r = id ? F.Day.get(id) : null;
    sheetCtx = { id: id };
    openSheet(sheetHead(r ? 'An hour of the day' : 'Add an hour') +
      field('dyTime', 'Time', r ? r.time : '') +
      field('dyTitle', 'What happens', r ? r.title : '') +
      field('dyDetail', 'Detail', r ? r.detail : '', 'textarea', 2) +
      actions('save-day', r ? 'del-day' : null));
  }

  function openStandardsEditor() {
    openSheet(sheetHead('My standards') +
      '<p class="mn-plate mn-plate--sm" style="margin-top:8px">I always</p>' +
      lineRows('stAlways', F.standardsOf('always').map(function (x) { return x.text; })) +
      '<p class="mn-plate mn-plate--sm" style="margin-top:26px">I don&rsquo;t</p>' +
      lineRows('stNever', F.standardsOf('never').map(function (x) { return x.text; })) +
      actions('save-standards'));
  }

  function openMoreLessEditor() {
    openSheet(sheetHead('More, less') +
      '<p class="mn-plate mn-plate--sm" style="margin-top:8px">More</p>' +
      lineRows('mlMore', F.morelessOf('more').map(function (x) { return x.text; })) +
      '<p class="mn-plate mn-plate--sm" style="margin-top:26px">Less</p>' +
      lineRows('mlLess', F.morelessOf('less').map(function (x) { return x.text; })) +
      actions('save-moreless'));
  }

  function openDimensionsEditor() {
    var rows = F.Dimensions.sorted();
    openSheet(sheetHead('Becoming &rarr; being') +
      '<div id="dmRows" class="mn-stack">' + rows.map(function (r) {
        return '<div class="mn-field" data-dm="' + esc(r.id) + '">' +
          '<label class="mn-label">' + esc(r.label) + '</label>' +
          '<div class="mn-grid2">' +
            '<textarea class="mn-textarea" data-f="current" rows="2" placeholder="Now">' + esc(r.current) + '</textarea>' +
            '<textarea class="mn-textarea" data-f="future" rows="2" placeholder="Then">' + esc(r.future) + '</textarea>' +
          '</div></div>';
      }).join('') + '</div>' +
      actions('save-dimensions'), true);
  }

  function openMemoryEditor(id) {
    var m = id ? F.Memories.get(id) : null;
    sheetCtx = { id: id };
    openSheet(sheetHead(m ? 'A memory from the future' : 'Write a future memory') +
      '<p class="mn-small">Past tense. Write it as though it already happened.</p>' +
      field('mmTitle', 'What happened', m ? m.title : '') +
      field('mmDate', 'When', m ? m.dateText : '') +
      field('mmEmotion', 'What it felt like', m ? m.emotion : '') +
      field('mmBody', 'The scene', m ? m.body : '', 'textarea', 5) +
      field('mmWhy', 'Why it matters', m ? m.whyItMatters : '', 'textarea', 2) +
      field('mmImage', 'Image URL', m ? m.imageUrl : '') +
      actions('save-memory', m ? 'del-memory' : null), true);
  }

  function openMemoryRead(id) {
    var m = F.Memories.get(id);
    if (!m) return;
    openSheet(sheetHead(m.title) +
      (m.imageUrl ? '<img src="' + esc(m.imageUrl) + '" alt="" style="width:100%;border-radius:var(--mn-radius-sm);margin-bottom:20px">' : '') +
      '<div class="mn-row" style="gap:10px;margin-bottom:16px">' +
        (m.dateText ? '<span class="mn-label">' + esc(m.dateText) + '</span>' : '') +
        (m.emotion ? '<span class="bs-tag is-accent">' + esc(m.emotion) + '</span>' : '') +
      '</div>' +
      (m.body ? '<p class="mn-body" style="max-width:none;font-size:17px;line-height:1.8">' + nl2br(m.body) + '</p>' : '') +
      (m.whyItMatters ? '<p class="mn-plate mn-plate--sm" style="margin-top:26px">Why it matters</p><p class="mn-body" style="margin-top:10px;max-width:none">' + nl2br(m.whyItMatters) + '</p>' : '') +
      '<div class="mn-sheet__actions">' +
        '<button type="button" class="mn-btn" data-act="edit-memory" data-id="' + esc(id) + '">Edit</button>' +
        '<button type="button" class="mn-btn mn-btn--primary" data-act="close-sheet">Done</button>' +
      '</div>', true);
  }

  function openQuoteEditor(id) {
    var q = id ? F.Quotes.get(id) : null;
    sheetCtx = { id: id };
    openSheet(sheetHead(q ? 'Quote' : 'Add a quote') +
      field('qtText', 'Quote', q ? q.text : '', 'textarea', 3) +
      field('qtAuthor', 'Who said it', q ? q.author : '') +
      '<div class="mn-field" style="margin-top:14px"><label class="mn-label" for="qtCat">Category</label>' +
        '<select class="mn-select" id="qtCat"><option value=""></option>' + F.QUOTE_CATEGORIES.map(function (c) {
          return '<option' + (q && q.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
        }).join('') + '</select></div>' +
      '<label class="mn-check-row" style="margin-top:14px">' +
        '<input type="checkbox" class="mn-check" id="qtCore"' + (q && q.isCore ? ' checked' : '') + '>' +
        '<span class="mn-check-row__text">One of the core few, shown on the page</span></label>' +
      (q ? '<label class="mn-check-row"><input type="checkbox" class="mn-check" id="qtMoment"' +
        (F.getSettings().quoteOfMomentId === q.id ? ' checked' : '') + '>' +
        '<span class="mn-check-row__text">Quote of the moment</span></label>' : '') +
      actions('save-quote', q ? 'del-quote' : null));
  }

  function openAllQuotes() {
    var all = F.Quotes.sorted();
    var cats = ['All'].concat(F.QUOTE_CATEGORIES);
    var shown = quoteFilter === 'All' ? all : all.filter(function (q) { return q.category === quoteFilter; });
    openSheet(sheetHead('All quotes') +
      '<div class="mn-row" style="margin-bottom:18px">' + cats.map(function (c) {
        return '<button type="button" class="mn-chip" data-act="quote-filter" data-v="' + esc(c) + '"' +
          ' aria-pressed="' + (quoteFilter === c ? 'true' : 'false') + '">' + esc(c) + '</button>';
      }).join('') + '</div>' +
      (shown.length
        ? '<div class="mn-stack--tight" style="display:flex;flex-direction:column">' + shown.map(function (q) {
            return '<div class="bs-card" data-act="edit-quote" data-id="' + esc(q.id) + '" tabindex="0" role="button">' +
              '<div class="bs-card-title" style="font-size:16px">' + esc(q.text) + '</div>' +
              '<div class="mn-row" style="gap:8px">' +
                (q.author ? '<span class="mn-label">' + esc(q.author) + '</span>' : '') +
                (q.category ? '<span class="bs-tag">' + esc(q.category) + '</span>' : '') +
                (q.isCore ? '<span class="bs-tag is-accent">Core</span>' : '') +
              '</div></div>';
          }).join('') + '</div>'
        : '<div class="mn-empty">Nothing in ' + esc(quoteFilter) + '.</div>') +
      '<div class="mn-sheet__actions">' +
        '<button type="button" class="mn-btn" data-act="add-quote">Add a quote</button>' +
        '<button type="button" class="mn-btn mn-btn--primary" data-act="close-sheet">Done</button>' +
      '</div>', true);
  }

  function openNoteEditor(id) {
    var n = id ? F.Notes.get(id) : null;
    sheetCtx = { id: id };
    openSheet(sheetHead(n ? 'Note' : 'New note') +
      field('ntText', '', n ? n.text : '', 'textarea', 6) +
      actions('save-note', n ? 'del-note-sheet' : null));
  }

  function openEvidenceEditor() {
    openSheet(sheetHead('Evidence') +
      '<p class="mn-small">One thing you did that the person you are becoming would have done.</p>' +
      field('evDate', 'When', F.todayISO(), 'date') +
      field('evText', 'What you did', '', 'textarea', 3) +
      actions('save-evidence'));
  }

  function openAllEvidence() {
    var all = F.evidenceFeed();
    openSheet(sheetHead('All evidence') +
      '<ul class="fs-evidence">' + all.map(function (e) {
        return '<li><span class="fs-evidence__date">' + esc(prettyShort(e.date)) + '</span>' +
          '<span class="fs-evidence__text">' + esc(e.text) + '</span>' +
          (e.source === 'weeklyreview' ? '<span class="bs-tag">Weekly review</span>' : '') + '</li>';
      }).join('') + '</ul>' +
      '<div class="mn-sheet__actions"><button type="button" class="mn-btn mn-btn--primary" data-act="close-sheet">Done</button></div>', true);
  }

  function openLetterEditor(id) {
    var l = id ? F.Letters.get(id) : null;
    sheetCtx = { id: id };
    openSheet(sheetHead(l ? 'Letter' : 'A letter to future me') +
      field('ltTitle', 'Title', l ? l.title : '') +
      field('ltBody', 'The letter', l ? l.body : '', 'textarea', 10) +
      field('ltOpen', 'Seal until (optional)', l ? l.openAt : '', 'date') +
      actions('save-letter', l ? 'del-letter' : null), true);
  }

  function openLetterRead(id) {
    var l = F.Letters.get(id);
    if (!l) return;
    if (F.letterIsSealed(l)) {
      openSheet(sheetHead(l.title || 'Sealed') +
        '<div class="mn-empty"><p>Sealed until ' + esc(l.openAt) + '.</p></div>' +
        '<div class="mn-sheet__actions">' +
          '<button type="button" class="mn-btn" data-act="break-seal" data-id="' + esc(id) + '">Open it anyway</button>' +
          '<button type="button" class="mn-btn mn-btn--primary" data-act="close-sheet">Leave it</button>' +
        '</div>');
      return;
    }
    openSheet(sheetHead(l.title || 'Untitled') +
      '<p class="mn-label">' + esc(new Date(l.writtenAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })) + '</p>' +
      '<p class="mn-body" style="margin-top:18px;max-width:none;font-size:17px;line-height:1.85">' + nl2br(l.body) + '</p>' +
      '<div class="mn-sheet__actions">' +
        '<button type="button" class="mn-btn" data-act="edit-letter" data-id="' + esc(id) + '">Edit</button>' +
        '<button type="button" class="mn-btn mn-btn--primary" data-act="close-sheet">Done</button>' +
      '</div>', true);
  }

  function openHeroEditor() {
    var h = F.getHero();
    openSheet(sheetHead('The cover') +
      field('hrEyebrow', 'Eyebrow', h.eyebrow) +
      '<p class="mn-label" style="margin-top:20px">Title — one line per line</p>' + lineRows('hrLines', h.lines) +
      field('hrPeriod', 'Period', h.period) +
      field('hrStatement', 'Identity statement', h.statement, 'textarea', 3) +
      actions('save-hero'));
  }

  function openImageEditor(categoryId) {
    sheetCtx = { categoryId: categoryId };
    openSheet(sheetHead('Add an image') +
      '<p class="mn-small">Paste a URL, or upload — an upload is compressed and hosted, so what gets stored is a link rather than the picture.</p>' +
      field('imUrl', 'Image URL', '') +
      '<div class="mn-field" style="margin-top:14px"><label class="mn-label" for="imFile">Or upload</label>' +
        '<input class="mn-input" type="file" id="imFile" accept="image/*"></div>' +
      field('imCaption', 'Caption', '') +
      '<label class="mn-check-row" style="margin-top:14px"><input type="checkbox" class="mn-check" id="imMain" checked>' +
        '<span class="mn-check-row__text">Show on the front collage</span></label>' +
      actions('save-image'));
  }

  // ============================================================
  // EVENTS
  // ============================================================
  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');

    switch (act) {
      case 'close-sheet': closeSheet(); break;
      case 'go': e.preventDefault(); go(el.getAttribute('data-href')); break;

      case 'edit-hero': openHeroEditor(); break;
      case 'save-hero': {
        F.saveHero({
          eyebrow: byId('hrEyebrow').value.trim(),
          lines: readLines('hrLines'),
          period: byId('hrPeriod').value.trim(),
          statement: byId('hrStatement').value.trim()
        });
        closeSheet(); applyHero(); toast('Saved'); break;
      }

      case 'edit-focus': openFocusEditor(); break;
      case 'save-focus': {
        F.saveFocus({
          season: byId('fcSeason').value.trim(), identity: byId('fcIdentity').value.trim(),
          trait: byId('fcTrait').value.trim(), standard: byId('fcStandard').value.trim(),
          habit: byId('fcHabit').value.trim(), leavingBehind: byId('fcLeaving').value.trim()
        });
        closeSheet(); renderFocus(); applyMedal(); toast('Saved'); break;
      }

      case 'open-gallery': openGallery = id; renderBoard(); break;
      case 'close-gallery': openGallery = null; renderBoard(); break;
      case 'add-image': openImageEditor(id); break;
      case 'save-image': saveImage(); break;
      case 'toggle-main': {
        var im = F.BoardImages.get(id);
        if (im) F.BoardImages.update(id, { isMain: !im.isMain });
        renderBoard(); break;
      }
      case 'del-image': {
        if (!confirm('Remove this image?')) break;
        F.BoardImages.remove(id); renderBoard(); break;
      }

      case 'edit-identity': openIdentityEditor(); break;
      case 'save-identity': {
        F.saveIdentity({ statements: readLines('idnRows').map(function (t, i) { return { id: F.uid('idn'), text: t, order: i }; }) });
        closeSheet(); renderIdentity(); toast('Saved'); break;
      }

      case 'add-trait': openTraitEditor(null); break;
      case 'edit-trait': openTraitEditor(id); break;
      case 'save-trait': {
        var tf = { name: byId('trName').value.trim(), band: byId('trBand').value, note: byId('trNote').value.trim() };
        if (!tf.name) { toast('A trait needs a name.', true); break; }
        if (sheetCtx.id) F.Traits.update(sheetCtx.id, tf); else F.Traits.add(tf);
        closeSheet(); renderTraits(); toast('Saved'); break;
      }
      case 'del-trait': {
        if (!confirm('Delete this trait?')) break;
        F.Traits.remove(sheetCtx.id); closeSheet(); renderTraits(); break;
      }

      case 'open-area': openAreaRead(id); break;
      case 'edit-area': openAreaEditor(id); break;
      case 'save-area': {
        F.Areas.update(sheetCtx.id, {
          headline: byId('arHead').value.trim(), body: byId('arBody').value.trim(),
          bullets: readLines('arBullets'), shed: readLines('arShed'),
          image: byId('arImage').value.trim()
        });
        closeSheet(); renderAreas(); toast('Saved'); break;
      }

      case 'add-day': openDayEditor(null); break;
      case 'edit-day': openDayEditor(id); break;
      case 'save-day': {
        var df = { time: byId('dyTime').value.trim(), title: byId('dyTitle').value.trim(), detail: byId('dyDetail').value.trim() };
        if (!df.title) { toast('This hour needs something in it.', true); break; }
        if (sheetCtx.id) F.Day.update(sheetCtx.id, df); else F.Day.add(df);
        closeSheet(); renderDay(); toast('Saved'); break;
      }
      case 'del-day': { F.Day.remove(sheetCtx.id); closeSheet(); renderDay(); break; }

      case 'edit-standards': openStandardsEditor(); break;
      case 'save-standards': {
        var st = readLines('stAlways').map(function (t, i) { return { id: F.uid('st'), kind: 'always', text: t, order: i }; })
          .concat(readLines('stNever').map(function (t, i) { return { id: F.uid('st'), kind: 'never', text: t, order: i }; }));
        F.Standards.replaceAll(st);
        closeSheet(); renderStandards(); toast('Saved'); break;
      }

      case 'edit-moreless': openMoreLessEditor(); break;
      case 'save-moreless': {
        var ml = readLines('mlMore').map(function (t, i) { return { id: F.uid('ml'), side: 'more', text: t, order: i }; })
          .concat(readLines('mlLess').map(function (t, i) { return { id: F.uid('ml'), side: 'less', text: t, order: i }; }));
        F.MoreLess.replaceAll(ml);
        closeSheet(); renderMoreLess(); toast('Saved'); break;
      }

      case 'edit-dimensions': openDimensionsEditor(); break;
      case 'save-dimensions': {
        Array.prototype.forEach.call(document.querySelectorAll('#dmRows [data-dm]'), function (row) {
          F.Dimensions.update(row.getAttribute('data-dm'), {
            current: row.querySelector('[data-f="current"]').value.trim(),
            future: row.querySelector('[data-f="future"]').value.trim()
          });
        });
        closeSheet(); renderDimensions(); toast('Saved'); break;
      }

      case 'add-memory': openMemoryEditor(null); break;
      case 'open-memory': openMemoryRead(id); break;
      case 'edit-memory': openMemoryEditor(id); break;
      case 'save-memory': {
        var mf = {
          title: byId('mmTitle').value.trim(), dateText: byId('mmDate').value.trim(),
          emotion: byId('mmEmotion').value.trim(), body: byId('mmBody').value.trim(),
          whyItMatters: byId('mmWhy').value.trim(), imageUrl: byId('mmImage').value.trim()
        };
        if (!mf.title) { toast('A memory needs a title.', true); break; }
        if (sheetCtx.id) F.Memories.update(sheetCtx.id, mf); else F.Memories.add(mf);
        closeSheet(); renderMemories(); toast('Saved'); break;
      }
      case 'del-memory': {
        if (!confirm('Delete this memory?')) break;
        F.Memories.remove(sheetCtx.id); closeSheet(); renderMemories(); break;
      }

      case 'add-quote': openQuoteEditor(null); break;
      case 'edit-quote': openQuoteEditor(id); break;
      case 'all-quotes': openAllQuotes(); break;
      case 'quote-filter': quoteFilter = el.getAttribute('data-v'); openAllQuotes(); break;
      case 'save-quote': {
        var qf = {
          text: byId('qtText').value.trim(), author: byId('qtAuthor').value.trim(),
          category: byId('qtCat').value, isCore: byId('qtCore').checked
        };
        if (!qf.text) { toast('A quote needs some words.', true); break; }
        var rec = sheetCtx.id ? F.Quotes.update(sheetCtx.id, qf) : F.Quotes.add(qf);
        var mom = byId('qtMoment');
        if (mom) F.saveSettings({ quoteOfMomentId: mom.checked ? rec.id : '' });
        closeSheet(); renderQuotes(); renderQuoteOfMoment(); toast('Saved'); break;
      }
      case 'del-quote': {
        if (!confirm('Delete this quote?')) break;
        F.Quotes.remove(sheetCtx.id); closeSheet(); renderQuotes(); renderQuoteOfMoment(); break;
      }

      case 'add-note': openNoteEditor(null); break;
      case 'edit-note': openNoteEditor(id); break;
      case 'save-note': {
        var nt = byId('ntText').value.trim();
        if (!nt) { toast('Nothing to save.', true); break; }
        if (sheetCtx.id) F.Notes.update(sheetCtx.id, { text: nt }); else F.Notes.add({ text: nt });
        closeSheet(); renderNotes(); break;
      }
      case 'del-note-sheet': { F.Notes.remove(sheetCtx.id); closeSheet(); renderNotes(); break; }
      case 'pin-note': {
        var n0 = F.Notes.get(id);
        if (n0) F.Notes.update(id, { pinned: !n0.pinned });
        renderNotes(); break;
      }
      case 'del-note': {
        if (!confirm('Delete this note?')) break;
        F.Notes.remove(id); renderNotes(); break;
      }

      case 'add-evidence': openEvidenceEditor(); break;
      case 'save-evidence': {
        var et = byId('evText').value.trim();
        if (!et) { toast('What did you do?', true); break; }
        F.addEvidence(et, { date: byId('evDate').value || F.todayISO() });
        closeSheet(); renderEvidence(); toast('Logged'); break;
      }
      case 'all-evidence': openAllEvidence(); break;
      case 'del-evidence': {
        if (!confirm('Remove this piece of evidence?')) break;
        F.Evidence.remove(id); renderEvidence(); break;
      }

      case 'add-letter': openLetterEditor(null); break;
      case 'open-letter': openLetterRead(id); break;
      case 'edit-letter': openLetterEditor(id); break;
      case 'save-letter': {
        var lf = { title: byId('ltTitle').value.trim(), body: byId('ltBody').value, openAt: byId('ltOpen').value };
        if (!lf.body.trim()) { toast('An empty letter is not a letter.', true); break; }
        if (sheetCtx.id) F.Letters.update(sheetCtx.id, lf); else F.Letters.add(lf);
        closeSheet(); renderLetters(); toast('Saved'); break;
      }
      case 'del-letter': {
        if (!confirm('Delete this letter?')) break;
        F.Letters.remove(sheetCtx.id); closeSheet(); renderLetters(); break;
      }
      case 'break-seal': { F.Letters.update(id, { openedAt: Date.now() }); openLetterRead(id); renderLetters(); break; }

      case 'add-line': {
        var host = byId(el.getAttribute('data-host'));
        if (host) host.insertAdjacentHTML('beforeend', lineRow(''));
        break;
      }
      case 'rm-line': { var row2 = el.closest('[data-line]'); if (row2) row2.remove(); break; }

      case 'import-vision': {
        var r = F.migrateSystemVision(true);
        if (r.ran) { renderAll(); toast('Imported ' + r.moved.length + ' field' + (r.moved.length === 1 ? '' : 's')); }
        else toast(r.reason, true);
        renderVisionBanner();
        break;
      }
    }
  }

  function saveImage() {
    var url = byId('imUrl').value.trim();
    var caption = byId('imCaption').value.trim();
    var isMain = byId('imMain').checked;
    var file = byId('imFile').files && byId('imFile').files[0];
    var catId = sheetCtx.categoryId;

    function commit(finalUrl) {
      F.BoardImages.add({ categoryId: catId, url: finalUrl, caption: caption, isMain: isMain });
      closeSheet(); renderBoard(); toast('Added');
    }

    if (file) {
      var reader = new FileReader();
      reader.onload = function () {
        compress(String(reader.result), 1400, 0.82).then(function (small) {
          // Straight to the bucket. A base64 image in the row would make
          // every later save re-upload it.
          if (global.PhotoStore && global.PhotoStore.upload) {
            global.PhotoStore.upload(small, function (hosted) { commit(hosted || small); });
          } else commit(small);
        });
      };
      reader.readAsDataURL(file);
      return;
    }
    if (!url) { toast('Give it a URL or a file.', true); return; }
    commit(url);
  }
  function compress(dataUrl, maxDim, q) {
    return new Promise(function (res) {
      try {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          var sc = Math.min(1, maxDim / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * sc); c.height = Math.round(h * sc);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', q || 0.82));
        };
        img.onerror = function () { res(dataUrl); };
        img.src = dataUrl;
      } catch (e) { res(dataUrl); }
    });
  }

  function onInput(e) {
    if (e.target.id === 'fsNoteQuick') return;   // handled on Enter
  }
  function onKeydown(e) {
    if (e.key === 'Escape') { closeSheet(); return; }
    if (e.target.id === 'fsNoteQuick' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      var v = e.target.value.trim();
      if (!v) return;
      F.Notes.add({ text: v });
      e.target.value = '';
      renderNotes();
    }
    // A card that is a button by role has to answer the keyboard too.
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-act]')) {
      e.preventDefault();
      e.target.click();
    }
  }

  // ============================================================
  // HERO + MEDALLION
  // ============================================================
  function applyHero() {
    var h = F.getHero();
    if (!global.MainHero) return;
    global.MainHero.setScene({
      key: 'futureself', index: 0,
      eyebrow: h.eyebrow, lines: h.lines, note: h.statement
    });
    global.MainHero.measure();
    var p = byId('fsPeriod');
    if (p) p.textContent = h.period || '';
  }
  function applyMedal() {
    if (!global.MainHero) return;
    var f = F.getFocus();
    global.MainHero.setMedal({
      lead: 'This season',
      main: f.trait || f.identity || 'Set it',
      level: 'mid',
      chosen: !!(f.trait || f.identity),
      rim: f.season || '',
      label: 'This season — jump to Current Focus',
      onClick: function () {
        var el = byId('fsFocus');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /** A one-time offer to bring the old Vision answers across. */
  function renderVisionBanner() {
    var host = byId('fsVisionBanner');
    if (!host) return;
    if (F.visionMigrated() || !F.readSystemVision()) { host.innerHTML = ''; host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = '<div class="mn-card mn-card--raised">' +
      '<p class="mn-plate mn-plate--sm">Your old Future Self Vision</p>' +
      '<p class="mn-body" style="margin-top:10px">Eight answers you wrote under Subconscious Reprogramming are still saved. They can be brought into the sections below — the environment, work and lifestyle cards, your identity statements, the day, and the notes.</p>' +
      '<div class="mn-row" style="margin-top:16px"><button type="button" class="mn-btn mn-btn--primary" data-act="import-vision">Bring them across</button></div>' +
      '</div>';
  }

  // ============================================================
  // BOOT
  // ============================================================
  function renderAll() {
    renderVisionBanner();
    renderFocus();
    renderQuoteOfMoment();
    renderBoard();
    renderIdentity();
    renderTraits();
    renderAreas();
    renderDay();
    renderMemories();
    renderDimensions();
    renderStandards();
    renderMoreLess();
    renderEvidence();
    renderQuotes();
    renderNotes();
    renderLetters();
    applyMedal();
    if (global.MainHero) global.MainHero.measure();
  }

  function boot() {
    F = global.FutureSelfData;
    if (!F) return;
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', onKeydown);
    var bg = byId('mnSheetBg');
    if (bg) bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeSheet(); });
    global.addEventListener('pagehide', flushSaves);
    applyHero();
    renderAll();
  }

  global.FutureSelfUI = { boot: boot, renderAll: renderAll, applyHero: applyHero, go: go, toast: toast };
})(window);
