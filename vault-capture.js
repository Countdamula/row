// =============================================================
// vault-capture.js — the Capture page and the bulk importer.
//
// ONE FIELD, ONE KEY. Everything else in this studio asks you to
// fill in a form; this asks for a link and files it. The twelve
// categories are a small enough set that a link can usually be
// placed without being asked about, and the cases where it cannot
// are handled by letting the answer be corrected afterwards
// rather than by stopping to ask first.
//
// Loaded BEFORE vault-app.js, which merges HDCapture.ACTS into its
// own delegate and calls into fetchMeta() for the composer's
// autofill — the provider table lives here and nowhere else, so a
// provider added here reaches both paths at once.
//
// NO THIRD-PARTY METADATA SERVICE, which is the rule this studio
// has followed since the composer was built: a lookup service
// would mean every link Damian saves being reported to a stranger.
// Titles and covers come from the PROVIDER'S own oEmbed endpoint,
// and the category is worked out locally from his own library.
// =============================================================
(function (global) {
  'use strict';

  var U = function () { return global.AscUI; };
  var H = function () { return global.HD; };
  var V = function () { return global.Vault; };
  var esc = function (s) { return U().esc(s); };
  var attr = function (s) { return U().attr(s); };
  var $ = function (id) { return document.getElementById(id); };

  // ═══ §PROVIDERS ════════════════════════════════════════════
  // Keyed by bare hostname with www. stripped. The m./music.
  // variants are here deliberately: they are what a phone's share
  // sheet produces, and this page exists to be used from a phone.
  var OEMBED = {
    'youtube.com': function (u) { return 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u); },
    'm.youtube.com': function (u) { return 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u); },
    'music.youtube.com': function (u) { return 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u); },
    'youtu.be': function (u) { return 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u); },
    'vimeo.com': function (u) { return 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(u); },
    'open.spotify.com': function (u) { return 'https://open.spotify.com/oembed?url=' + encodeURIComponent(u); },
    'spotify.com': function (u) { return 'https://open.spotify.com/oembed?url=' + encodeURIComponent(u); },
    'soundcloud.com': function (u) { return 'https://soundcloud.com/oembed?format=json&url=' + encodeURIComponent(u); },
    'm.soundcloud.com': function (u) { return 'https://soundcloud.com/oembed?format=json&url=' + encodeURIComponent(u); }
  };

  function hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; }
  }

  function titleFromSlug(u) {
    try {
      var seg = new URL(u).pathname.split('/').filter(Boolean).pop() || '';
      if (!seg || /^[0-9a-f]{8,}$/i.test(seg)) return '';
      return decodeURIComponent(seg).replace(/\.(html?|php|aspx?)$/i, '')
        .replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim()
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    } catch (e) { return ''; }
  }

  // What can be known about a link without asking anyone but the
  // site it points at. ALWAYS RESOLVES — a blocked, offline or
  // private link still answers with the hostname and a Title-Cased
  // slug, which beats an empty record, and the caller cannot tell
  // the difference except by reading `.thin`.
  function fetchMeta(url) {
    var host = hostOf(url);
    var base = {
      title: titleFromSlug(url), creator: host, cover: '', thin: true
    };
    var vid = H().ytId(url);
    if (vid) base.cover = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg';

    var endpoint = OEMBED[host];
    if (!endpoint || typeof fetch !== 'function') return Promise.resolve(base);

    return fetch(endpoint(url), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return base;
        return {
          title: j.title || base.title,
          creator: j.author_name || base.creator,
          cover: j.thumbnail_url || base.cover,
          thin: false
        };
      })
      .catch(function () { return base; });
  }

  // ═══ §THE CLASSIFIER ═══════════════════════════════════════
  // Four passes, cheapest and most certain first. Everything it
  // knows it learned from Damian's own four hundred records, so it
  // gets better every time he corrects it and it never consults
  // anything off this machine.

  // creator -> the category he files them under. Measured against
  // the real library when this was built: 136 of 139 creators map
  // to exactly ONE category, covering 318 of the 335 YouTube
  // records. That is why this pass comes before the keywords.
  //
  // Rebuilt on demand rather than cached: a correction has to be
  // learned immediately, and four hundred records is microseconds.
  function creatorIndex() {
    var tally = {};
    V().SHELVES.forEach(function (sh) {
      V().list(sh).forEach(function (v) {
        var who = String(v.creator || '').trim().toLowerCase();
        var cat = H().catName(String(v.category || '').trim());
        if (!who || !cat) return;
        if (!tally[who]) tally[who] = {};
        tally[who][cat] = (tally[who][cat] || 0) + 1;
      });
    });
    var out = {};
    Object.keys(tally).forEach(function (who) {
      var best = '', bestN = 0, total = 0;
      Object.keys(tally[who]).forEach(function (cat) {
        total += tally[who][cat];
        if (tally[who][cat] > bestN) { bestN = tally[who][cat]; best = cat; }
      });
      out[who] = { cat: best, n: bestN, total: total };
    });
    return out;
  }

  // Read in order; the first match wins, so the specific sits
  // above the general. "Scary" appears in both Stories and Scary
  // Videos — a creepypasta is a story being told, a scary video is
  // something being watched — so Stories is asked first.
  var KEYWORDS = [
    [/creepypasta|\bno ?sleep\b|scary stor|horror stor|true crime|unsolved|cold case|disappear(ed|ance)|murder|serial killer/i, 'Stories'],
    [/\basmr\b|whisper|tingl|mouth sound|ear ?to ?ear|scalp massage/i, 'ASMR & Immersive Experience'],
    [/ambien(t|ce)|immersive|soundscape|rain ?sounds?|fireplace|white noise/i, 'ASMR & Immersive Experience'],
    [/binaural|isochronic|solfeggio|\d{2,4} ?hz\b|delta waves?|theta waves?/i, 'Binaural Beats'],
    [/\bpodcast\b|\bep(isode)? ?\d+\b|\binterview\b|in conversation/i, 'Podcasts'],
    [/gameplay|walkthrough|speedrun|playthrough|let'?s play|\bspeed ?run\b|boss fight/i, 'Gaming'],
    [/haunted|paranormal|\bghost\b|poltergeist|disturbing|unexplained|caught on camera/i, 'Scary Videos'],
    [/\bvlog\b|day in (my|the) life|week in my life|morning routine|come with me/i, 'Vlog-Like'],
    [/lo-?fi|chill(hop| beats)?|study beats|relax(ing)?|calm/i, 'Chill'],
    [/\bedm\b|techno|trance|dubstep|house mix|electronic|synthwave|drum ?(and|&|n) ?bass/i, 'EDM / Electronic'],
    [/fantasy|celtic|medieval|tavern|elven|bardcore|dungeon|folk ?music/i, 'Fantasy'],
    [/gothic|dark academia|vampire|victorian|baroque|requiem/i, 'Dark / Gothic / Horror / Romance']
  ];

  var MUSIC = ['Chill', 'Binaural Beats', 'Dark / Gothic / Horror / Romance',
               'EDM / Electronic', 'Fantasy'];

  function keywordHit(text, only) {
    var s = String(text || '');
    if (!s) return '';
    for (var i = 0; i < KEYWORDS.length; i++) {
      if (!KEYWORDS[i][0].test(s)) continue;
      if (only && only.indexOf(KEYWORDS[i][1]) < 0) continue;
      return KEYWORDS[i][1];
    }
    return '';
  }

  // A music link whose category the URL cannot settle. The words
  // get a chance first; failing that it goes to whichever music
  // category is already the largest, because that is the one it is
  // most likely to belong to and the cheapest to correct.
  function musicGuess(text) {
    var kw = keywordHit(text, MUSIC);
    if (kw) return { category: kw, why: 'the title', sure: true };
    var counts = H().catCounts(), best = MUSIC[0], bestN = -1;
    MUSIC.forEach(function (c) {
      if ((counts[c] || 0) > bestN) { bestN = counts[c] || 0; best = c; }
    });
    return { category: best, why: 'it is music, but not which kind', sure: false };
  }

  // Returns { category, why, sure }. `why` is shown to Damian, so
  // it is written as the end of the sentence "Filed under X —
  // <why>", and `sure` is what the bulk importer flags for review.
  function suggest(url, meta, idx) {
    meta = meta || {};
    idx = idx || creatorIndex();
    var words = [meta.title || '', meta.creator || ''].join(' ');
    var host = hostOf(url), path = '', qs = null;
    try { var u = new URL(url); path = u.pathname.toLowerCase(); qs = u.searchParams; } catch (e) {}

    // 1. THE LINK, where it is decisive on its own.
    if (/^(open\.)?spotify\.com$/.test(host)) {
      if (/^\/show\//.test(path)) return { category: 'Podcasts', why: 'a Spotify show', sure: true };
      if (/^\/episode\//.test(path)) {
        return { category: 'Favorite Videos & Episodes', why: 'a Spotify episode', sure: true };
      }
      if (/^\/(track|album|playlist|artist|collection)\//.test(path)) return musicGuess(words);
    }
    if (/soundcloud\.com$/.test(host)) return musicGuess(words);
    if (host === 'music.youtube.com') return musicGuess(words);

    // 2. THE CREATOR, learned from the library. The pass that does
    //    the real work.
    var who = String(meta.creator || '').trim().toLowerCase();
    if (who && idx[who] && idx[who].cat) {
      return { category: idx[who].cat, sure: idx[who].n > 1,
               why: 'where you keep ' + (meta.creator || who) };
    }

    // 3. THE WORDS.
    var kw = keywordHit(words);
    if (kw) return { category: kw, why: 'what it is called', sure: true };

    // 4. Nothing recognised it. Episodes is the bucket that
    //    already means "worth keeping, not yet sorted", so an
    //    unplaceable link goes there rather than inventing a home.
    return { category: 'Favorite Videos & Episodes', why: 'nothing recognised it', sure: false };
  }

  // Everything needed to write the record, in one answer.
  function plan(url, meta, idx) {
    var s = suggest(url, meta, idx);
    var shelf = H().homeShelf(s.category);
    var kind = H().classifyKind({
      url: url, kind: 'auto', shelf: shelf, tab: H().groupKeyOfCat(s.category)
    });
    var title = meta.title || titleFromSlug(url) || url;
    return {
      url: url, shelf: shelf, category: s.category, why: s.why, sure: s.sure,
      title: title,
      creator: meta.creator || '', cover: meta.cover || '', kind: kind,
      // A guess, like the category — and like the category it can
      // be corrected on the row it lands in. See V().isLiveSignal.
      live: V().isLiveSignal(url, title)
    };
  }

  // ═══ §WHAT IS ALREADY HERE ═════════════════════════════════
  // findByUrl() canonicalises and re-parses every record on every
  // call — about four hundred `new URL()` each time. Fine once;
  // ruinous in a loop over a pasted list. The importer builds this
  // index ONCE instead.
  function urlIndex() {
    var idx = {};
    V().SHELVES.forEach(function (sh) {
      V().list(sh).forEach(function (v) {
        var c = V().canonUrl(v.url);
        if (c && !idx[c]) idx[c] = { shelf: sh, item: v };
      });
    });
    return idx;
  }

  // ═══ §THE PAGE ═════════════════════════════════════════════

  // The session's captures, newest first. Deliberately NOT stored:
  // it is a receipt for what just happened, not a second library,
  // and a stale one on tomorrow's visit would be clutter.
  var justCaptured = [];
  var busy = false;
  // The Capture page's own 'this is a live stream' switch. Kept for
  // the page session, so a run of streams is one press, not one each.
  var capLiveOn = false;

  function catOptions(selected) {
    return H().allCats().map(function (c) {
      return '<option value="' + attr(c) + '"' + (c === selected ? ' selected' : '') + '>' +
        esc(c) + '</option>';
    }).join('');
  }

  function capturedRow(r, i) {
    return '<li class="vt-cap__row" data-cap="' + i + '">' +
      '<span class="vt-cap__art">' +
        (r.cover
          ? '<img src="' + attr(r.cover) + '" alt="" loading="lazy" decoding="async">'
          : '<span class="vt-cap__none" aria-hidden="true">' + H().sig('sg-all', 18) + '</span>') +
      '</span>' +
      '<span class="vt-cap__say">' +
        '<b>' + esc(r.title) + '</b>' +
        '<i>' + esc([r.creator, r.why].filter(Boolean).join(' · ')) + '</i>' +
      '</span>' +
      '<span class="vt-cap__ctl">' +
        '<select class="asc-select vt-cap__sel" data-act="recat" data-cap="' + i + '" ' +
          'aria-label="Category for ' + attr(r.title) + '">' + catOptions(r.category) + '</select>' +
        '<button type="button" class="asc-btn asc-btn--sm vt-cap__live' + (r.live ? ' is-on' : '') + '"' +
          ' data-act="cap-live" data-cap="' + i + '" aria-pressed="' + (r.live ? 'true' : 'false') + '">' +
          (r.live ? '● Live' : '○ Live') + '</button>' +
      '</span>' +
    '</li>';
  }

  function capturedList() {
    if (!justCaptured.length) return '';
    return '<div class="vt-cap__done">' +
      '<p class="hd-eyebrow">Just captured</p>' +
      '<ul class="vt-cap__list">' +
        justCaptured.map(capturedRow).join('') +
      '</ul>' +
      '<p class="vt-cap__hint">Change a category here and it moves — and the next link ' +
        'from that channel will know where it goes.</p>' +
    '</div>';
  }

  function viewCapture() {
    var n = H().allCards().length;
    return '<section class="hd-band hd-night vt-cap">' +
      '<div class="vt-cap__in">' +
        '<p class="hd-eyebrow">Capture</p>' +
        '<h1 class="hd-display hd-display--mid">Paste a link.</h1>' +
        '<p class="hd-prose vt-cap__lede">It reads the title and the cover from the site ' +
          'itself, works out where it belongs from what you already keep, and files it. ' +
          '<b>' + n + '</b> entries in so far.</p>' +

        '<form class="vt-cap__form" id="capForm" autocomplete="off">' +
          '<input class="asc-input vt-cap__in1" id="capUrl" type="url" inputmode="url" ' +
            'spellcheck="false" placeholder="https://…" aria-label="Link to capture">' +
          '<button class="asc-btn asc-btn--primary vt-cap__go" type="submit" id="capGo">Capture</button>' +
          // SAYING it is live beats guessing. YouTube's own title for a
          // stream rarely carries the red dot or '24/7', so the guess
          // alone missed most of them.
          '<button type="button" class="asc-btn asc-btn--sm vt-cap__live' + (capLiveOn ? ' is-on' : '') + '"' +
            ' id="capLive" data-act="cap-live-all" aria-pressed="' + capLiveOn + '">' +
            (capLiveOn ? '● Live stream' : '○ Live stream') + '</button>' +
        '</form>' +
        '<p class="vt-cap__msg" id="capMsg" role="status" aria-live="polite"></p>' +

        capturedList() +

        '<details class="vt-bulk" id="capBulk">' +
          '<summary class="vt-bulk__sum">Add a lot at once</summary>' +
          '<div class="vt-bulk__body">' +
            '<p class="hd-prose vt-bulk__lede">One link per line. Everything else on the ' +
              'line is ignored, so a list copied out of somewhere else usually works as it is.</p>' +
            '<textarea class="asc-textarea asc-textarea--tall" id="capBulkIn" ' +
              'spellcheck="false" aria-label="Links to import, one per line" ' +
              'placeholder="https://www.youtube.com/watch?v=…&#10;https://open.spotify.com/track/…"></textarea>' +
            '<div class="vt-bulk__acts">' +
              '<button class="asc-btn" type="button" data-act="bulk-read" id="capRead">Read the list</button>' +
              '<span class="vt-bulk__note" id="capBulkMsg" role="status" aria-live="polite"></span>' +
            '</div>' +
            '<div id="capBulkOut"></div>' +
            '<p class="vt-bulk__warn">A playlist link is saved as <b>one entry</b> — its own ' +
              'title and cover. Opening it out into its separate tracks needs a Spotify or ' +
              'YouTube account key, which this site deliberately does not have. Paste the ' +
              'individual links if you want them one by one.</p>' +
          '</div>' +
        '</details>' +
      '</div>' +
    '</section>';
  }

  // ═══ §CAPTURING ════════════════════════════════════════════

  function say(el, msg, tone) {
    var n = $(el);
    if (!n) return;
    n.textContent = msg || '';
    n.className = (el === 'capMsg' ? 'vt-cap__msg' : 'vt-bulk__note') +
      (tone ? ' is-' + tone : '');
  }

  function repaintCaptured() {
    var host = document.querySelector('.vt-cap__in');
    if (!host) return;
    var old = host.querySelector('.vt-cap__done');
    var next = capturedList();
    if (!next) { if (old) old.remove(); return; }
    var wrap = document.createElement('div');
    wrap.innerHTML = next;
    if (old) old.replaceWith(wrap.firstChild);
    else host.querySelector('#capMsg').after(wrap.firstChild);
  }

  function captureOne(raw) {
    var url = String(raw || '').trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      say('capMsg', 'That does not look like a link. It needs to start with http.', 'bad');
      return;
    }
    if (busy) return;
    busy = true;
    say('capMsg', 'Reading it…');

    var dupe = V().findByUrl(url);
    if (dupe) {
      busy = false;
      // Capturing a stream you ALREADY have is how most streams get
      // marked — many were starred long before Live existed. Saying
      // 'already here' and doing nothing is what read as broken.
      if ((capLiveOn || V().isLiveSignal(url, dupe.item.title)) && dupe.item.live !== true) {
        V().update(dupe.shelf, dupe.item.id, { live: true });
        say('capMsg', '“' + dupe.item.title + '” was already here — it is in Live Streams now.', 'good');
        U().toast('Moved to Live Streams');
        var b0 = $('capUrl');
        if (b0) { b0.value = ''; b0.focus(); }
        return;
      }
      say('capMsg', '“' + dupe.item.title + '” is already here, under ' +
        (H().catName(dupe.item.category) || 'no category') +
        (dupe.item.live ? ', in Live Streams' : '') + '.', 'warn');
      var box = $('capUrl');
      if (box) { box.select(); }
      return;
    }

    fetchMeta(url).then(function (meta) {
      var p = plan(url, meta);
      var rec = V().add(p.shelf, {
        url: p.url, title: p.title, creator: p.creator, cover: p.cover,
        category: p.category, kind: p.kind, live: capLiveOn || p.live
      });
      justCaptured.unshift({
        id: rec.id, shelf: p.shelf, title: p.title, creator: p.creator,
        cover: p.cover, category: p.category, why: p.why, live: capLiveOn || p.live
      });
      if (justCaptured.length > 8) justCaptured.length = 8;
      busy = false;
      var box = $('capUrl');
      if (box) { box.value = ''; box.focus(); }
      say('capMsg', 'Filed under ' + p.category + ' — ' + p.why + '.' +
        (rec.live ? ' It is in Live Streams.' : ''), p.sure || rec.live ? 'good' : 'warn');
      repaintCaptured();
    });
  }

  // Moving a captured item to the category Damian actually wanted.
  // Because the creator index is rebuilt from the records
  // themselves, this correction IS the teaching — there is no
  // second store to keep in step.
  function recat(el) {
    var i = Number(el.dataset.cap);
    var row = justCaptured[i];
    if (!row) return;
    var to = el.value;
    if (!to || to === row.category) return;
    var want = H().homeShelf(to);
    var shelf = row.shelf;
    if (want !== shelf) {
      var moved = V().move(shelf, row.id, want);
      if (moved) { shelf = want; row.shelf = want; }
    }
    V().update(shelf, row.id, { category: to });
    row.category = to;
    row.why = 'you moved it here';
    U().toast('Moved to ' + to);
    // NOT HDApp.repaint(). This page IS #vtRoot's contents, so a
    // full repaint throws away the list the select sits in, the
    // open bulk panel and anything half-typed in it. The archive's
    // counts are stale until the next navigation, which is the
    // cheaper wrong thing.
    repaintCaptured();
  }

  // ═══ §BULK IMPORT ══════════════════════════════════════════
  // Larder's grocery ingest already solved these ergonomics: read
  // the lines, show what each one will become, then commit the lot
  // with one summary. The difference here is that reading a line
  // means a network call, so it happens in a throttled pass and
  // the preview fills in as answers arrive.

  var bulkRows = [];

  function bulkRowHtml(r, i) {
    return '<li class="vt-bulk__row' + (r.dupe ? ' is-dupe' : '') + '" data-row="' + i + '">' +
      '<span class="vt-bulk__t">' + esc(r.title || r.url) +
        (r.dupe ? '<b class="vt-bulk__dupe">Already saved</b>' : '') +
        '<i>' + esc(r.creator || hostOf(r.url)) + '</i>' +
      '</span>' +
      (r.dupe
        ? '<span class="vt-bulk__skip">Skipped</span>'
        : '<select class="asc-select vt-bulk__sel" data-act="bulk-cat" data-row="' + i + '" ' +
            'aria-label="Category for ' + attr(r.title || r.url) + '">' +
            catOptions(r.category) + '</select>') +
    '</li>';
  }

  function paintBulk() {
    var out = $('capBulkOut');
    if (!out) return;
    if (!bulkRows.length) { out.innerHTML = ''; return; }
    var keep = bulkRows.filter(function (r) { return !r.dupe; }).length;
    var dupes = bulkRows.length - keep;
    out.innerHTML =
      '<ul class="vt-bulk__list">' + bulkRows.map(bulkRowHtml).join('') + '</ul>' +
      '<div class="vt-bulk__acts">' +
        '<button class="asc-btn asc-btn--primary" type="button" data-act="bulk-save"' +
          (keep ? '' : ' disabled') + '>' +
          (keep ? 'Import ' + keep + (keep === 1 ? ' entry' : ' entries') : 'Nothing to import') +
        '</button>' +
        (dupes ? '<span class="vt-bulk__note">' + dupes +
          (dupes === 1 ? ' link is' : ' links are') + ' already here and will be left alone.</span>' : '') +
      '</div>';
  }

  // Four at a time. Fifty links is fifty cross-origin requests and
  // firing them at once gets the slow ones dropped — which would
  // show up as a title quietly missing rather than as an error.
  function throttle(items, width, work) {
    return new Promise(function (done) {
      var next = 0, live = 0, finished = 0;
      if (!items.length) return done();
      var step = function () {
        while (live < width && next < items.length) {
          var i = next++;
          live++;
          work(items[i], i).then(function () {
            live--; finished++;
            if (finished === items.length) done(); else step();
          });
        }
      };
      step();
    });
  }

  function readBulk() {
    var box = $('capBulkIn');
    if (!box) return;
    var lines = String(box.value || '').split(/\r?\n/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    // Anything that is not a link is dropped silently: a list
    // copied out of a page usually carries headings with it, and
    // complaining about them would be complaining about the paste.
    var urls = lines.filter(function (s) { return /^https?:\/\//i.test(s); });
    var skipped = lines.length - urls.length;

    if (!urls.length) {
      bulkRows = [];
      paintBulk();
      say('capBulkMsg', lines.length ? 'No links in that.' : 'Nothing pasted yet.', 'bad');
      return;
    }

    var seen = {}, uniq = [];
    urls.forEach(function (u) {
      var c = V().canonUrl(u);
      if (seen[c]) return;
      seen[c] = 1;
      uniq.push(u);
    });

    var have = urlIndex();
    var idx = creatorIndex();
    bulkRows = uniq.map(function (u) {
      return { url: u, title: '', creator: '', cover: '', category: '',
               dupe: !!have[V().canonUrl(u)] };
    });
    paintBulk();
    say('capBulkMsg', 'Reading ' + uniq.length + ' links…');

    var todo = bulkRows.map(function (r, i) { return i; })
      .filter(function (i) { return !bulkRows[i].dupe; });

    throttle(todo, 4, function (i) {
      return fetchMeta(bulkRows[i].url).then(function (meta) {
        var p = plan(bulkRows[i].url, meta, idx);
        bulkRows[i].title = p.title;
        bulkRows[i].creator = p.creator;
        bulkRows[i].cover = p.cover;
        bulkRows[i].category = p.category;
        bulkRows[i].kind = p.kind;
        bulkRows[i].live = p.live;
        bulkRows[i].sure = p.sure;
      });
    }).then(function () {
      paintBulk();
      var unsure = bulkRows.filter(function (r) { return !r.dupe && !r.sure; }).length;
      say('capBulkMsg',
        'Ready.' + (skipped
          ? (skipped === 1 ? ' 1 line was not a link.' : ' ' + skipped + ' lines were not links.')
          : '') +
        (unsure ? ' ' + unsure + ' could not be placed confidently — worth a look.' : ''),
        unsure ? 'warn' : 'good');
    });
  }

  function saveBulk() {
    var keep = bulkRows.filter(function (r) { return !r.dupe; });
    if (!keep.length) return;

    // ONE WRITE PER SHELF. Every localStorage.setItem is
    // monkey-patched by sync.js into a dirty mark plus a scheduled
    // push, so fifty Vault.add() calls would be fifty full-array
    // serialisations and fifty pushes. Grouping first makes it one
    // per shelf — and `order` has to be set here, because add()
    // assigns it after its own Object.assign and is the one field
    // a caller cannot hand in.
    var byShelf = {};
    keep.forEach(function (r) {
      var sh = H().homeShelf(r.category);
      (byShelf[sh] = byShelf[sh] || []).push(r);
    });

    var added = 0;
    Object.keys(byShelf).forEach(function (sh) {
      var all = V().list(sh);
      byShelf[sh].forEach(function (r) {
        all.push({
          id: 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
          title: r.title || r.url, url: r.url, cover: r.cover || '', creator: r.creator || '',
          description: '', category: r.category, lengthText: '', notes: '',
          rating: 0, favorite: false, queued: false, kind: r.kind || 'auto', live: r.live === true,
          openCount: 0, lastOpenedAt: null, source: '', importedFrom: '', legacyId: '',
          createdAt: Date.now(), updatedAt: Date.now(), order: all.length
        });
        added++;
      });
      V().replaceAll(sh, all);
    });

    var dupes = bulkRows.length - keep.length;
    bulkRows = [];
    var box = $('capBulkIn');
    if (box) box.value = '';
    paintBulk();
    say('capBulkMsg', 'Imported ' + added + (added === 1 ? ' entry' : ' entries') +
      (dupes ? ' · ' + dupes + ' already here' : '') + '.', 'good');
    U().toast('Imported ' + added + (added === 1 ? ' entry' : ' entries'));
    // Same reason as recat(): repainting here would wipe the
    // summary that has just been written, which is the one thing
    // the reader is waiting for.
  }

  // ═══ §THE ACTIONS ══════════════════════════════════════════

  var ACTS = {
    'bulk-read': function () { readBulk(); },
    'bulk-save': function () { saveBulk(); },
    recat: function (el) { recat(el); },
    // The live guess, corrected on the row it landed in. Same rule
    // as recat(): update in place, never HDApp.repaint() — this page
    // IS #vtRoot's contents.
    'cap-live': function (el) {
      var row = justCaptured[Number(el.dataset.cap)];
      if (!row) return;
      row.live = !row.live;
      V().update(row.shelf, row.id, { live: row.live });
      U().toast(row.live ? 'Moved to Live Streams' : 'Moved back out of Live Streams');
      repaintCaptured();
    },
    'cap-live-all': function (el) {
      capLiveOn = !capLiveOn;
      el.classList.toggle('is-on', capLiveOn);
      el.setAttribute('aria-pressed', String(capLiveOn));
      el.textContent = capLiveOn ? '● Live stream' : '○ Live stream';
    },
    'bulk-cat': function (el) {
      var r = bulkRows[Number(el.dataset.row)];
      if (r) r.category = el.value;
    }
  };

  // The form is inside #vtRoot, which vault-app.js repaints
  // wholesale, so this binds on submit at the document rather than
  // holding a reference to a node that will be replaced.
  function bind() {
    document.addEventListener('submit', function (e) {
      if (!e.target || e.target.id !== 'capForm') return;
      e.preventDefault();
      var box = $('capUrl');
      captureOne(box ? box.value : '');
    });
    // A list pasted straight into the single field is a list, not
    // a link — the same courtesy Larder's grocery field does.
    document.addEventListener('paste', function (e) {
      var box = $('capUrl');
      if (!box || e.target !== box) return;
      var text = (e.clipboardData || global.clipboardData);
      text = text && text.getData('text');
      if (!text || !/\r?\n/.test(text.trim())) return;
      e.preventDefault();
      var panel = $('capBulk'), area = $('capBulkIn');
      if (!panel || !area) return;
      panel.open = true;
      area.value = text.trim();
      say('capMsg', 'That was a list, so it went to the importer below.');
      readBulk();
    });
  }

  // Is someone mid-capture? vault-app.js asks before letting a
  // cloud pull rebuild the DOM, the same guard the composer gets.
  function busyTyping() {
    var box = $('capUrl'), area = $('capBulkIn');
    return !!((box && box.value.trim()) || (area && area.value.trim()) || bulkRows.length);
  }

  global.HDCapture = {
    ACTS: ACTS, bind: bind, viewCapture: viewCapture, busyTyping: busyTyping,
    fetchMeta: fetchMeta, OEMBED: OEMBED, titleFromSlug: titleFromSlug,
    suggest: suggest, plan: plan, creatorIndex: creatorIndex, urlIndex: urlIndex,
    captureOne: captureOne, readBulk: readBulk, saveBulk: saveBulk,
    justCaptured: function () { return justCaptured.slice(); }
  };
})(window);
