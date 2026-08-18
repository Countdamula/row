/* =====================================================================
   athenaeum-data.js — the data layer for The Athenaeum, a learning
   dashboard built around one idea:

       FIELD  →  CURRICULA  →  MODULES  →  LESSONS

   A Field is permanent. A Curriculum is temporary. Everything worth
   keeping after a curriculum ends (concepts, connections, contradictions,
   research, resources) belongs to the FIELD, never to the curriculum —
   that is the whole point of the split, and it is why `concepts`,
   `inbox`, `connections` and `contradictions` all carry a subjectId and
   only optionally a curriculumId.

   RELATIONSHIP TO THE OTHER LEARNING PAGES: none. learning.html
   ('learning:'), learning-dashboard.html ('lhub:') and knowledge-hub.html
   ('kh:') are untouched, still nav-listed, and share no data and no code
   with this file. The Athenaeum was built fresh, per an explicit choice
   confirmed with the user before any code was written.

   Storage follows this app's established contract exactly:
     local-store-idb.js  → localStorage is an IndexedDB-backed shim
     sync.js             → initCloudSync({appKey:'athenaeum', syncedPrefixes:['ath:']})

   Every key below is 'ath:'-prefixed. 'ath:' and appKey 'athenaeum' were
   both unused before this build; nothing else in the app reads or writes
   either one.

   NOTE ON model(): makeCollection.update() re-runs the record's model on
   every edit, and every model here is a field WHITELIST. A field that
   isn't listed in its model is silently dropped the next time the record
   is edited — so add new fields to the model, never just to a caller.
   ===================================================================== */

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE
  // ============================================================
  function storeGet(key) {
    try { var raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('ath:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('ath:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  var KEYS = {
    subjects: 'ath:subjects',
    topics: 'ath:topics',
    concepts: 'ath:concepts',
    connections: 'ath:connections',
    contradictions: 'ath:contradictions',
    resources: 'ath:resources',
    // A book's chapters and a video's timestamped notes live in their own
    // collections, NOT inside the resource record. `ath:resources` is
    // re-serialised in full on every single edit and re-modelled on every
    // update() — putting whole pasted chapters in there would make renaming
    // a resource cost as much as saving a book.
    chapters: 'ath:chapters',
    marks: 'ath:resmarks',
    curricula: 'ath:curricula',
    modules: 'ath:modules',
    lessons: 'ath:lessons',
    assignments: 'ath:assignments',
    inbox: 'ath:inbox',
    lenses: 'ath:lenses',
    reviews: 'ath:reviews',
    sessions: 'ath:sessions',
    experiments: 'ath:experiments',
    box: 'ath:box',
    focus: 'ath:focus',
    hero: 'ath:hero',
    today: 'ath:today',
    uiState: 'ath:uiState',
    settings: 'ath:settings',
    seededAt: 'ath:seededAt',
    resMigratedAt: 'ath:resMigratedV2'
  };

  // ============================================================
  // ID / DATE / TEXT HELPERS — same shapes as promptarium-data.js
  // ============================================================
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toISODate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayISO() { return toISODate(new Date()); }
  function nowISO() { return new Date().toISOString(); }
  function addDays(iso, n) {
    var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return todayISO();
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }
  function daysBetween(aIso, bIso) {
    var a = new Date(String(aIso).slice(0, 10) + 'T00:00:00');
    var b = new Date(String(bIso).slice(0, 10) + 'T00:00:00');
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.round((b - a) / 86400000);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDateShort(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function fmtAgo(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24); if (d < 7) return d + 'd ago';
    var w = Math.floor(d / 7); if (w < 5) return w + 'w ago';
    var mo = Math.floor(d / 30); if (mo < 12) return mo + 'mo ago';
    return Math.floor(d / 365) + 'y ago';
  }
  // Study time is stored in minutes and always read back as "41h 20m".
  function fmtHours(mins) {
    var n = Math.max(0, Math.round(Number(mins) || 0));
    var h = Math.floor(n / 60), m = n % 60;
    if (!h && !m) return '0h';
    if (!h) return m + 'm';
    if (!m) return h + 'h';
    return h + 'h ' + m + 'm';
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function num(v, dflt) { var n = Number(v); return isFinite(n) ? n : (dflt || 0); }
  function str(v) { return v == null ? '' : String(v); }
  function arr(v) { return Array.isArray(v) ? v.slice() : []; }
  // Every field is optional at the edges, but a record must never carry a
  // value outside its enum or the filters below silently drop it.
  function oneOf(v, allowed, dflt) {
    var s = String(v == null ? '' : v);
    return allowed.indexOf(s) >= 0 ? s : dflt;
  }
  // Roman numerals: the eleven fields are a fixed, ordered canon, so they
  // are numbered like the divisions of a library rather than a list.
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
    'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  function roman(n) { return ROMAN[n] || String(n); }

  // Two callers with different appetites. Field values (a resource's url, a
  // cover) are typed by hand and get the friendly treatment: a bare
  // "openlibrary.org/x" is promoted to https, and a data: image is allowed
  // because that is what an upload looks like before PhotoStore swaps it.
  // §SANITISE below calls the same function in strict mode for hrefs found
  // inside PASTED markup, where nothing may be inferred and control
  // characters must be stripped first — "java\nscript:" and
  // "&#106;avascript:" both normalise to javascript: once the browser has
  // decoded them, so testing the raw string is not enough.
  // stripControl is written as a codepoint filter rather than a regex
  // character class so this source file never has to carry literal control
  // bytes of its own.
  function stripControl(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c > 31 && c !== 127 && c !== 8232 && c !== 8233) out += s.charAt(i);
    }
    return out;
  }
  function safeUrl(u, opts) {
    var strict = opts === true || (opts && opts.strict);
    var s = stripControl(String(u == null ? '' : u)).trim();
    if (!s) return '';
    if (strict) {
      var low = s.toLowerCase();
      if (low.indexOf('http://') === 0 || low.indexOf('https://') === 0 || low.indexOf('mailto:') === 0) return s;
      if (opts && opts.allowDataImage &&
        /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) return s;
      return '';
    }
    if (/^(https?:|mailto:|data:image\/)/i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return 'https://' + s;
    return '';
  }

  // ============================================================
  // §SANITISE — ported from promptarium-data.js:135-257.
  //
  // A book chapter is pasted in from somewhere else, so everything that
  // lands in a bodyHtml/notesHtml field goes through here first. Two
  // properties matter:
  //
  //   1. It parses with DOMParser, never `div.innerHTML`. A DOMParser
  //      document has no browsing context, so an `<img onerror=…>` in the
  //      pasted markup cannot fire while it is being parsed. Using a live
  //      element to "clean" hostile HTML executes it on the way in.
  //   2. It runs inside the models below, so makeCollection.update()
  //      re-applies it on EVERY write. No code path — paste, toolbar,
  //      drag-drop, IME, a future feature — can get a dirty value into
  //      storage.
  //
  // `style` and `class` are stripped deliberately, not incidentally. On a
  // near-black page that is not a nicety: a chapter copied out of a PDF
  // reader or a Kindle page arrives carrying `background:#fff;color:#000`,
  // and keeping it would drop a white slab into the middle of the
  // Athenaeum's one continuous ground. Stripping it is what makes pasted
  // text adopt this page's palette.
  // ============================================================
  var SAN_KEEP = {
    P:1, BR:1, H2:1, H3:1, H4:1, STRONG:1, EM:1, U:1, S:1,
    UL:1, OL:1, LI:1, BLOCKQUOTE:1, CODE:1, PRE:1, A:1, IMG:1, HR:1,
    FIGURE:1, FIGCAPTION:1, SUP:1, SUB:1, SMALL:1
  };
  // Removed together with their subtree — their content is not worth
  // rescuing and is usually the payload.
  var SAN_DROP = {
    SCRIPT:1, STYLE:1, IFRAME:1, OBJECT:1, EMBED:1, LINK:1, META:1, BASE:1,
    NOSCRIPT:1, TEMPLATE:1, SVG:1, MATH:1, FORM:1, INPUT:1, BUTTON:1,
    SELECT:1, TEXTAREA:1, OPTION:1, AUDIO:1, VIDEO:1, SOURCE:1, TRACK:1,
    CANVAS:1, FRAME:1, FRAMESET:1, APPLET:1
  };
  var SAN_RENAME = { B:'STRONG', I:'EM', H1:'H2', H5:'H4', H6:'H4', STRIKE:'S', DEL:'S', MARK:'STRONG' };
  var SAN_ATTR = { A: ['href', 'title'], IMG: ['src', 'alt'] };
  // A pasted book is legitimately large, so these caps are looser than
  // Promptarium's 4000/12 — but they still exist, because past them a paste
  // is a denial-of-service on the renderer and on the sync payload alike.
  var SAN_MAX_NODES = 12000, SAN_MAX_DEPTH = 14;

  function sanitizeHtml(html) {
    var raw = String(html == null ? '' : html);
    if (!raw) return '';
    var doc;
    try {
      doc = new DOMParser().parseFromString('<!doctype html><body>' + raw, 'text/html');
    } catch (e) {
      return '<p>' + esc(raw) + '</p>';
    }
    var body = doc.body;
    if (!body) return '';

    // Past the cap, keep the words and throw away the structure.
    if (body.getElementsByTagName('*').length > SAN_MAX_NODES) {
      return '<p>' + esc(body.textContent || '').slice(0, 200000) + '</p>';
    }

    function walk(node, depth) {
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;
        if (child.nodeType === 8) {                       // comment
          child.parentNode.removeChild(child);
        } else if (child.nodeType === 1) {
          var tag = child.tagName.toUpperCase();
          if (SAN_DROP[tag]) {
            child.parentNode.removeChild(child);
          } else if (depth > SAN_MAX_DEPTH) {
            unwrap(child);
          } else {
            if (SAN_RENAME[tag]) { child = rename(child, SAN_RENAME[tag]); tag = SAN_RENAME[tag]; }
            if (!SAN_KEEP[tag]) {
              walk(child, depth + 1);
              unwrap(child);
            } else {
              scrubAttrs(child, tag);
              if (tag === 'A' && !child.getAttribute('href')) { walk(child, depth + 1); unwrap(child); }
              else if (tag === 'IMG' && !child.getAttribute('src')) { child.parentNode.removeChild(child); }
              else walk(child, depth + 1);
            }
          }
        }
        child = next;
      }
    }
    function rename(el, tag) {
      var n = doc.createElement(tag);
      while (el.firstChild) n.appendChild(el.firstChild);
      el.parentNode.replaceChild(n, el);
      return n;
    }
    function unwrap(el) {
      var p = el.parentNode;
      if (!p) return;
      while (el.firstChild) p.insertBefore(el.firstChild, el);
      p.removeChild(el);
    }
    function scrubAttrs(el, tag) {
      var allow = SAN_ATTR[tag] || [];
      // Backwards: removeAttribute mutates the live NamedNodeMap. This one
      // pass is what kills every on*, style, class, srcset and formaction.
      for (var i = el.attributes.length - 1; i >= 0; i--) {
        var name = el.attributes[i].name;
        if (allow.indexOf(name.toLowerCase()) < 0) el.removeAttribute(name);
      }
      if (tag === 'A') {
        var href = safeUrl(el.getAttribute('href'), { strict: true });
        if (href) el.setAttribute('href', href); else el.removeAttribute('href');
      }
      if (tag === 'IMG') {
        var src = safeUrl(el.getAttribute('src'), { strict: true, allowDataImage: true });
        if (src) el.setAttribute('src', src); else el.removeAttribute('src');
      }
    }

    walk(body, 0);
    return body.innerHTML.replace(/(<p>\s*<\/p>|<li>\s*<\/li>)/gi, '').trim();
  }

  /* Plain text out of rich HTML — search, word counts, and deciding whether
     an editor is visually empty. */
  function htmlToText(html) {
    try {
      // textContent runs block elements together — "<p>a</p><p>b</p>" reads
      // as "ab", which would merge words across paragraphs in search and in
      // previews. Give the block boundaries a space before parsing.
      var spaced = String(html || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote|pre|figcaption|tr|td)>/gi, ' ');
      var d = new DOMParser().parseFromString('<!doctype html><body>' + spaced, 'text/html');
      return (d.body && d.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) { return ''; }
  }

  /* Reading time. 240 wpm is a book-prose pace, not the 200 usually quoted
     for web copy. Always at least a minute, so a short chapter never reads
     "0 min". */
  function readingMinutes(html) {
    var words = htmlToText(html).split(/\s+/).filter(Boolean).length;
    return words ? Math.max(1, Math.round(words / 240)) : 0;
  }

  /* Canvas downscale — the same helper every other data file in this app
     carries. Per-file duplication is the house pattern here, not a shared
     module. Covers are shown at most ~420px wide, so 640 is generous. */
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 640; quality = quality == null ? 0.82 : quality;
    return new Promise(function (resolve) {
      try {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if (!w || !h) { resolve(dataUrl); return; }
          var scale = Math.min(1, maxDim / Math.max(w, h));
          var cw = Math.round(w * scale), ch = Math.round(h * scale);
          var c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          var ctx = c.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, cw, ch);
          try { resolve(c.toDataURL('image/jpeg', quality)); }
          catch (e) { resolve(dataUrl); }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) { resolve(dataUrl); }
    });
  }

  // ============================================================
  // §LINK PREVIEW — paste a link, get a title, a creator and a cover.
  //
  // Every provider here is a public, keyless endpoint, because this app has
  // no backend and no place to keep an API key (see the repo CLAUDE.md).
  // Ported rather than imported: entertainment-hub-data.js and
  // entertainment-reading-data.js both declare their own collections and
  // write their own localStorage keys the moment they load, so pulling them
  // into an Athenaeum page to borrow one function would drag their whole
  // data layer along with it.
  //
  // Every lookup is best-effort and silent. A blocked network, an offline
  // provider or an unrecognised link all return the same thing — an empty
  // result — and every field stays typed by hand.
  // ============================================================
  function ytId(url) {
    try {
      var u = new URL(url);
      if (u.hostname.indexOf('youtu.be') !== -1) return u.pathname.slice(1).split('/')[0] || '';
      if (u.hostname.indexOf('youtube.com') !== -1) {
        if (u.pathname === '/watch') return u.searchParams.get('v') || '';
        var m = u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/);
        if (m) return m[2];
      }
    } catch (e) {}
    return '';
  }
  function isbnFrom(url) {
    var m = String(url || '').match(/(\d{13}|\d{9}[\dXx])/);
    return m ? m[1] : '';
  }
  function olCover(covers) {
    var id = Array.isArray(covers) ? covers[0] : covers;
    return id ? ('https://covers.openlibrary.org/b/id/' + id + '-L.jpg') : '';
  }
  function olText(d) {
    if (!d) return '';
    if (typeof d === 'string') return d;
    return str(d.value);
  }
  function getJSON(url) {
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  /* Resolves to {title, author, cover, source, year, lengthText} — every
     field a string, every field possibly empty. Never rejects. */
  function fetchResourcePreview(url) {
    var out = { title: '', author: '', cover: '', source: '', year: '', lengthText: '' };
    var u = safeUrl(url);
    if (!u || typeof fetch !== 'function') return Promise.resolve(out);
    var host = '';
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) {}

    var id = ytId(u);
    if (id) {
      out.cover = 'https://img.youtube.com/vi/' + id + '/maxresdefault.jpg';
      return getJSON('https://www.youtube.com/oembed?url=' + encodeURIComponent(u) + '&format=json')
        .then(function (d) {
          if (d) {
            out.title = str(d.title);
            out.author = str(d.author_name);
            out.source = 'YouTube';
            if (d.thumbnail_url) out.cover = str(d.thumbnail_url);
          }
          return out;
        });
    }
    if (host.indexOf('spotify.com') >= 0) {
      return getJSON('https://open.spotify.com/oembed?url=' + encodeURIComponent(u)).then(function (d) {
        if (d) { out.title = str(d.title); out.cover = str(d.thumbnail_url); out.source = 'Spotify'; }
        return out;
      });
    }
    if (host.indexOf('vimeo.com') >= 0) {
      return getJSON('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(u)).then(function (d) {
        if (d) {
          out.title = str(d.title); out.author = str(d.author_name);
          out.cover = str(d.thumbnail_url); out.source = 'Vimeo';
          if (d.duration) out.lengthText = fmtHours(Math.round(num(d.duration, 0) / 60));
        }
        return out;
      });
    }

    // Books. Open Library's REST endpoints (not the older bibkeys API) —
    // an edition carries the cover and the publisher, its work carries the
    // description, and the author is a separate fetch behind a key.
    var isbn = isbnFrom(u);
    if (host.indexOf('openlibrary.org') >= 0 || isbn) {
      var path = isbn ? '/isbn/' + isbn + '.json' : (function () {
        try { return new URL(u).pathname.replace(/\/+$/, '') + '.json'; } catch (e) { return ''; }
      })();
      if (!path) return Promise.resolve(out);
      return getJSON('https://openlibrary.org' + path).then(function (ed) {
        if (!ed) return out;
        out.title = str(ed.title);
        out.cover = olCover(ed.covers);
        out.source = Array.isArray(ed.publishers) ? str(ed.publishers[0]) : '';
        var y = String(ed.publish_date || '').match(/\d{4}/);
        out.year = y ? y[0] : '';
        if (ed.number_of_pages) out.lengthText = ed.number_of_pages + ' pp';
        var key = ed.authors && ed.authors[0] && ed.authors[0].key;
        if (!key) return out;
        return getJSON('https://openlibrary.org' + key + '.json').then(function (a) {
          if (a) out.author = str(a.name);
          return out;
        });
      });
    }
    return Promise.resolve(out);
  }

  // ============================================================
  // §EMBED — what a media resource actually plays.
  //
  // Returns {kind, src, seekable}. `seekable` says whether the page can
  // drive the playhead: native <video>/<audio> always can, YouTube can once
  // its iframe API loads, and nothing else can — which is why a timestamp
  // on a Spotify episode is a note with a number on it, not a control.
  // An unrecognised link returns kind 'link', and the page shows the cover
  // and an "Open at source" button rather than an empty frame.
  // ============================================================
  function embedFor(url) {
    var out = { kind: 'link', src: '', seekable: false };
    var u = safeUrl(url);
    if (!u) return out;
    var host = '';
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return out; }

    var id = ytId(u);
    if (id) { out.kind = 'youtube'; out.src = 'https://www.youtube.com/embed/' + id + '?enablejsapi=1&rel=0'; out.seekable = true; return out; }
    if (host.indexOf('vimeo.com') >= 0) {
      var vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vm) { out.kind = 'vimeo'; out.src = 'https://player.vimeo.com/video/' + vm[1]; return out; }
    }
    if (host.indexOf('spotify.com') >= 0) {
      out.kind = 'spotify';
      out.src = u.replace(/open\.spotify\.com\/(intl-[a-z]+\/)?/, 'open.spotify.com/embed/').split('?')[0];
      return out;
    }
    if (host.indexOf('podcasts.apple.com') >= 0) {
      out.kind = 'apple'; out.src = u.replace('podcasts.apple.com', 'embed.podcasts.apple.com'); return out;
    }
    if (host.indexOf('soundcloud.com') >= 0) {
      out.kind = 'soundcloud';
      out.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(u) + '&visual=false';
      return out;
    }
    if (/\.(mp4|webm|ogv|mov)(\?|$)/i.test(u)) { out.kind = 'video'; out.src = u; out.seekable = true; return out; }
    if (/\.(mp3|m4a|aac|oga|ogg|wav|flac)(\?|$)/i.test(u)) { out.kind = 'audio'; out.src = u; out.seekable = true; return out; }
    return out;
  }

  /* Seconds ⇄ "1:04:12". Timestamps are stored as seconds so they sort. */
  function fmtClock(secs) {
    var n = Math.max(0, Math.round(num(secs, 0)));
    var h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
    return h ? (h + ':' + pad2(m) + ':' + pad2(s)) : (m + ':' + pad2(s));
  }
  function parseClock(text) {
    var parts = String(text || '').trim().split(':').map(function (p) { return parseInt(p, 10) || 0; });
    if (!parts.length || String(text || '').trim() === '') return -1;
    var n = 0;
    for (var i = 0; i < parts.length; i++) n = n * 60 + parts[i];
    return n;
  }

  // ============================================================
  // §LADDERS — the vocabulary the whole dashboard speaks in.
  //
  // Mastery and understanding share ONE seven-rung ladder so "where I am"
  // and "where I'm going" are directly comparable on a topic card. The
  // ladder is stored as an integer 0-6; the label is derived, never
  // stored, so renaming a rung never needs a migration.
  // ============================================================
  var MASTERY = [
    { v: 0, label: 'Untouched', hint: 'Named it. Nothing more.' },
    { v: 1, label: 'Curious', hint: 'Read around the edges.' },
    { v: 2, label: 'Novice', hint: 'Know the vocabulary.' },
    { v: 3, label: 'Apprentice', hint: 'Can follow an argument in it.' },
    { v: 4, label: 'Practitioner', hint: 'Can use it under real conditions.' },
    { v: 5, label: 'Fluent', hint: 'Can teach it and defend it.' },
    { v: 6, label: 'Adept', hint: 'Can extend it. Have my own position.' }
  ];
  function masteryLabel(v) { var m = MASTERY[clamp(num(v, 0), 0, 6)]; return m ? m.label : 'Untouched'; }
  function masteryHint(v) { var m = MASTERY[clamp(num(v, 0), 0, 6)]; return m ? m.hint : ''; }
  function masteryPct(v) { return Math.round((clamp(num(v, 0), 0, 6) / 6) * 100); }

  var SUBJECT_STATUSES = [
    { id: 'deep', label: 'Deep dive', tone: 'go' },
    { id: 'active', label: 'Active study', tone: 'go' },
    { id: 'maintaining', label: 'Maintaining', tone: 'hold' },
    { id: 'paused', label: 'Paused', tone: 'hold' },
    { id: 'dormant', label: 'Dormant', tone: 'off' }
  ];
  var SEASONS = [
    { id: 'in', label: 'In season' },
    { id: 'off', label: 'Off season' },
    { id: 'back', label: 'Back burner' },
    { id: 'fallow', label: 'Fallow' }
  ];
  var CURRICULUM_STATUSES = [
    { id: 'current', label: 'Current' },
    { id: 'next', label: 'Next' },
    { id: 'backburner', label: 'Back burner' },
    { id: 'future', label: 'Future' },
    { id: 'completed', label: 'Completed' },
    { id: 'abandoned', label: 'Abandoned' }
  ];
  var TOPIC_STATUSES = [
    { id: 'unexplored', label: 'Unexplored' },
    { id: 'learning', label: 'Learning' },
    { id: 'solid', label: 'Solid' },
    { id: 'teaching', label: 'Can teach' },
    { id: 'revisit', label: 'Needs revisit' }
  ];
  var IMPORTANCE = [
    { id: 'core', label: 'Core' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
    { id: 'optional', label: 'Optional' }
  ];
  var RESOURCE_BUCKETS = [
    { id: 'core', label: 'Core', blurb: 'The strongest things I have on this field.' },
    { id: 'active', label: 'Active', blurb: 'Being studied right now.' },
    { id: 'completed', label: 'Completed', blurb: 'Finished and mined.' },
    { id: 'reference', label: 'Reference library', blurb: 'Worth keeping permanently.' },
    { id: 'suggested', label: 'Suggested', blurb: 'Interesting, not needed yet.' },
    { id: 'rejected', label: 'Rejected', blurb: 'Deliberately decided against. Kept so I do not re-litigate it.' }
  ];
  var RESOURCE_TYPES = ['Book', 'Paper', 'Course', 'Lecture', 'Video', 'Podcast', 'Article', 'Person', 'Dataset', 'Tool', 'Other'];

  // The Learning Inbox capture kinds, in the order the user named them.
  var INBOX_KINDS = [
    { id: 'claim', label: 'Claim' },
    { id: 'theory', label: 'Theory' },
    { id: 'question', label: 'Question' },
    { id: 'example', label: 'Example' },
    { id: 'person', label: 'Person' },
    { id: 'book', label: 'Book' },
    { id: 'idea', label: 'Idea' },
    { id: 'controversy', label: 'Controversy' },
    { id: 'observation', label: 'Observation' }
  ];
  var INBOX_STATUSES = [
    { id: 'new', label: 'Unexamined' },
    { id: 'investigating', label: 'Investigating' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'archived', label: 'Archived' }
  ];

  var SESSION_KINDS = [
    { id: 'class', label: 'Class', blurb: 'Primary learning.' },
    { id: 'study', label: 'Study', blurb: 'Processing and retention.' },
    { id: 'research', label: 'Research', blurb: 'Deep research.' },
    { id: 'reflection', label: 'Reflection', blurb: 'Review and synthesis.' },
    { id: 'experiment', label: 'Experiment', blurb: 'Application.' }
  ];
  var ASSIGNMENT_TYPES = ['Essay', 'Exam', 'Case analysis', 'Project', 'Teaching exercise', 'Experiment'];
  var BOX_KINDS = [
    { id: 'field', label: 'Future field' },
    { id: 'curriculum', label: 'Future curriculum' },
    { id: 'rabbithole', label: 'Rabbit hole' },
    { id: 'book', label: 'Book to investigate' },
    { id: 'question', label: 'Question' },
    { id: 'skill', label: 'Skill' },
    { id: 'topic', label: 'Topic' },
    { id: 'curiosity', label: 'Curiosity' }
  ];
  var REVIEW_STRENGTHS = [
    { id: 'weak', label: 'Weak' },
    { id: 'learning', label: 'Learning' },
    { id: 'solid', label: 'Solid' },
    { id: 'mastered', label: 'Mastered' }
  ];
  var EXPERIMENT_STATUSES = [
    { id: 'planned', label: 'Planned' },
    { id: 'running', label: 'Running' },
    { id: 'done', label: 'Concluded' },
    { id: 'abandoned', label: 'Abandoned' }
  ];
  var CONNECTION_KINDS = [
    { id: 'internal', label: 'Internal' },
    { id: 'cross', label: 'Cross-field' }
  ];

  function labelFrom(list, id, dflt) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].label;
    return dflt || '';
  }
  function idsOf(list) { return list.map(function (x) { return x.id; }); }

  // ============================================================
  // §MODELS — every one a whitelist. See the header note.
  // ============================================================
  function subjectModel(d) {
    d = d || {};
    return {
      id: d.id || uid('sub'),
      name: str(d.name),
      // The one-line reason this field exists, shown on the gallery card.
      blurb: str(d.blurb),
      cover: str(d.cover),
      // objectPosition for the cover, so a photo can be re-framed without
      // re-cropping the file. "50% 50%" unless the user drags it.
      coverPos: d.coverPos ? str(d.coverPos) : '50% 50%',
      // Drives the generated cover plate when there is no photo yet, so an
      // un-photographed field still looks deliberate.
      hue: clamp(num(d.hue, 200), 0, 360),
      glyph: str(d.glyph),
      status: oneOf(d.status, idsOf(SUBJECT_STATUSES), 'dormant'),
      mastery: clamp(num(d.mastery, 0), 0, 6),
      currentFocus: str(d.currentFocus),
      // Subject Hub header properties.
      whyIStudy: str(d.whyIStudy),
      masteryMeans: str(d.masteryMeans),
      understanding: clamp(num(d.understanding, 0), 0, 6),
      longTermGoals: str(d.longTermGoals),
      season: oneOf(d.season, idsOf(SEASONS), 'fallow'),
      // Minutes. Curricula/completed counts are DERIVED, never stored —
      // see completedCurriculaCount() and activeCurriculumFor().
      studyMinutes: Math.max(0, num(d.studyMinutes, 0)),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  function topicModel(d) {
    d = d || {};
    return {
      id: d.id || uid('top'),
      subjectId: str(d.subjectId),
      // null/'' = a root topic. The Subject Map is this field alone.
      parentId: str(d.parentId),
      title: str(d.title),
      note: str(d.note),
      status: oneOf(d.status, idsOf(TOPIC_STATUSES), 'unexplored'),
      importance: oneOf(d.importance, idsOf(IMPORTANCE), 'medium'),
      masteryTarget: clamp(num(d.masteryTarget, 4), 0, 6),
      currentKnowledge: clamp(num(d.currentKnowledge, 0), 0, 6),
      curriculumIds: arr(d.curriculumIds).map(str),
      conceptIds: arr(d.conceptIds).map(str),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  function conceptModel(d) {
    d = d || {};
    return {
      id: d.id || uid('con'),
      subjectId: str(d.subjectId),
      topicId: str(d.topicId),
      name: str(d.name),
      definition: str(d.definition),
      simple: str(d.simple),
      technical: str(d.technical),
      examples: str(d.examples),
      evidence: str(d.evidence),
      criticism: str(d.criticism),
      relatedIds: arr(d.relatedIds).map(str),
      sources: str(d.sources),
      interpretation: str(d.interpretation),
      confidence: clamp(num(d.confidence, 3), 1, 5),
      mastery: clamp(num(d.mastery, 0), 0, 6),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO(),
      updatedAt: d.updatedAt || nowISO()
    };
  }

  function connectionModel(d) {
    d = d || {};
    return {
      id: d.id || uid('lnk'),
      kind: oneOf(d.kind, idsOf(CONNECTION_KINDS), 'internal'),
      // The field that OWNS the link. A cross-field link is stored once,
      // on the subject it was drawn from, and read from both ends by
      // connectionsFor().
      subjectId: str(d.subjectId),
      // For 'cross', the far end is a subject id. For 'internal', both
      // ends are topic or concept ids within subjectId.
      fromType: oneOf(d.fromType, ['topic', 'concept', 'subject'], 'topic'),
      fromId: str(d.fromId),
      toType: oneOf(d.toType, ['topic', 'concept', 'subject'], 'topic'),
      toId: str(d.toId),
      label: str(d.label),
      note: str(d.note),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  function contradictionModel(d) {
    d = d || {};
    return {
      id: d.id || uid('cdx'),
      subjectId: str(d.subjectId),
      title: str(d.title),
      theoryA: str(d.theoryA),
      theoryB: str(d.theoryB),
      evidenceA: str(d.evidenceA),
      evidenceB: str(d.evidenceB),
      assumptions: str(d.assumptions),
      methodology: str(d.methodology),
      whereEachCorrect: str(d.whereEachCorrect),
      interpretation: str(d.interpretation),
      confidence: clamp(num(d.confidence, 3), 1, 5),
      resolved: !!d.resolved,
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  /* Tags are lowercased on the way in and de-duplicated, so "Stoicism",
     "stoicism" and " stoicism " are one tag and the tag rail on the Library
     is not three chips deep in the same word. */
  function tagList(v) {
    var seen = {}, out = [];
    arr(v).forEach(function (t) {
      var s = str(t).trim().toLowerCase().replace(/\s+/g, ' ');
      if (s && !seen[s]) { seen[s] = 1; out.push(s); }
    });
    return out;
  }
  function idList(v) {
    var seen = {}, out = [];
    arr(v).forEach(function (t) {
      var s = str(t).trim();
      if (s && !seen[s]) { seen[s] = 1; out.push(s); }
    });
    return out;
  }

  function resourceModel(d) {
    d = d || {};
    // A resource may sit in no field, one field, or several — a book can
    // genuinely serve Psychology and Philosophy at once, and something can
    // land in the Library before you know where it belongs. `subjectId` is
    // the pre-2026-08 single-field shape: it is read when subjectIds is
    // empty and written back from subjectIds[0], so any code still reading
    // the old field keeps working while the migration rolls through.
    var subjectIds = idList(d.subjectIds);
    if (!subjectIds.length && str(d.subjectId)) subjectIds = [str(d.subjectId)];
    return {
      id: d.id || uid('res'),
      subjectIds: subjectIds,
      subjectId: subjectIds[0] || '',
      // A resource can serve several curricula; the curriculum page reads
      // this array, the subject library ignores it.
      curriculumIds: arr(d.curriculumIds).map(str),
      // Distinct from the above: the ONE curriculum a Course resource was
      // turned into. The curriculum still owns its modules and lessons —
      // this is a pointer, not ownership.
      curriculumId: str(d.curriculumId),
      title: str(d.title),
      author: str(d.author),
      // The people credited on this resource, as ids of type:'Person'
      // resources. `author` survives alongside it as the free-text fallback
      // for everything that never earns a Person record of its own.
      personIds: idList(d.personIds),
      type: oneOf(d.type, RESOURCE_TYPES, 'Book'),
      url: safeUrl(d.url),
      bucket: oneOf(d.bucket, idsOf(RESOURCE_BUCKETS), 'suggested'),
      tags: tagList(d.tags),
      // The dek — one or two lines under the title, on the card and on the
      // detail page. Plain text on purpose: it is set in a clamped two-line
      // box and rich markup there would fight the clamp.
      summary: str(d.summary),
      // The resource's own body: an article, a paper's abstract and notes, a
      // person's biography. Books do not use this — their text lives in
      // chapters. Sanitised here, so update() re-sanitises on every write.
      bodyHtml: sanitizeHtml(d.bodyHtml),
      cover: safeUrl(d.cover),
      coverPos: str(d.coverPos) || '50% 50%',
      hue: clamp(num(d.hue, 210), 0, 360),
      year: str(d.year),
      source: str(d.source),
      lengthText: str(d.lengthText),
      progress: clamp(num(d.progress, 0), 0, 100),
      startedAt: str(d.startedAt),
      finishedAt: str(d.finishedAt),
      // "How will this actually be studied" — the retention strategy the
      // curriculum page groups by resource.
      retention: str(d.retention),
      notes: str(d.notes),
      rating: clamp(num(d.rating, 0), 0, 5),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  /* A chapter of a book — or any long text pasted in whole. Its own
     collection, keyed by resourceId; see the note on KEYS.chapters. */
  function chapterModel(d) {
    d = d || {};
    return {
      id: d.id || uid('chp'),
      resourceId: str(d.resourceId),
      title: str(d.title),
      subtitle: str(d.subtitle),
      bodyHtml: sanitizeHtml(d.bodyHtml),
      notesHtml: sanitizeHtml(d.notesHtml),
      read: !!d.read,
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  /* A note against a moment in a video, a podcast or a lecture. `at` is
     seconds, or -1 for a note that isn't pinned to a time. */
  function markModel(d) {
    d = d || {};
    var at = num(d.at, -1);
    return {
      id: d.id || uid('mrk'),
      resourceId: str(d.resourceId),
      at: at < 0 ? -1 : Math.round(at),
      bodyHtml: sanitizeHtml(d.bodyHtml),
      createdAt: d.createdAt || nowISO()
    };
  }

  function outcomeModel(o) {
    o = o || {};
    return { text: str(o.text), progress: clamp(num(o.progress, 0), 0, 100) };
  }
  function curriculumModel(d) {
    d = d || {};
    return {
      id: d.id || uid('cur'),
      subjectId: str(d.subjectId),
      title: str(d.title),
      status: oneOf(d.status, idsOf(CURRICULUM_STATUSES), 'future'),
      why: str(d.why),
      startDate: str(d.startDate),
      endDate: str(d.endDate),
      weeklyHours: Math.max(0, num(d.weeklyHours, 0)),
      difficulty: clamp(num(d.difficulty, 3), 1, 5),
      // The boundary system: what is in, and what is deliberately out.
      inScope: arr(d.inScope).map(str),
      antiScope: arr(d.antiScope).map(str),
      outcomes: arr(d.outcomes).map(outcomeModel),
      retentionStrategy: str(d.retentionStrategy),
      // What to do the next time this is opened. Surfaces on the homepage.
      nextAction: str(d.nextAction),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  function moduleModel(d) {
    d = d || {};
    return {
      id: d.id || uid('mod'),
      curriculumId: str(d.curriculumId),
      title: str(d.title),
      note: str(d.note),
      done: !!d.done,
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }
  function lessonModel(d) {
    d = d || {};
    return {
      id: d.id || uid('les'),
      moduleId: str(d.moduleId),
      curriculumId: str(d.curriculumId),
      title: str(d.title),
      note: str(d.note),
      done: !!d.done,
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }
  function assignmentModel(d) {
    d = d || {};
    return {
      id: d.id || uid('asg'),
      curriculumId: str(d.curriculumId),
      subjectId: str(d.subjectId),
      type: str(d.type) || 'Essay',
      title: str(d.title),
      brief: str(d.brief),
      due: str(d.due),
      done: !!d.done,
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  /* A Learning Inbox capture. The curriculumId is where it was RAISED;
     the subjectId is where it LIVES. A curriculum ending never takes its
     research with it — that is the whole reason both are stored. */
  function inboxModel(d) {
    d = d || {};
    return {
      id: d.id || uid('inb'),
      subjectId: str(d.subjectId),
      curriculumId: str(d.curriculumId),
      kind: oneOf(d.kind, idsOf(INBOX_KINDS), 'question'),
      text: str(d.text),
      note: str(d.note),
      source: str(d.source),
      lensId: str(d.lensId),
      status: oneOf(d.status, idsOf(INBOX_STATUSES), 'new'),
      // Set when the capture graduates into a concept or a box item.
      promotedTo: str(d.promotedTo),
      promotedId: str(d.promotedId),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  /* A Research Lens — a standing question kept permanently visible.
     subjectId '' means it applies to every field. */
  function lensModel(d) {
    d = d || {};
    return {
      id: d.id || uid('len'),
      subjectId: str(d.subjectId),
      question: str(d.question),
      note: str(d.note),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  function reviewModel(d) {
    d = d || {};
    return {
      id: d.id || uid('rev'),
      subjectId: str(d.subjectId),
      conceptId: str(d.conceptId),
      label: str(d.label),
      dueDate: str(d.dueDate) || todayISO(),
      intervalDays: Math.max(1, num(d.intervalDays, 1)),
      strength: oneOf(d.strength, idsOf(REVIEW_STRENGTHS), 'learning'),
      lastReviewed: str(d.lastReviewed),
      reps: Math.max(0, num(d.reps, 0)),
      lapses: Math.max(0, num(d.lapses, 0)),
      createdAt: d.createdAt || nowISO()
    };
  }

  function sessionModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ses'),
      kind: oneOf(d.kind, idsOf(SESSION_KINDS), 'study'),
      subjectId: str(d.subjectId),
      curriculumId: str(d.curriculumId),
      title: str(d.title),
      date: str(d.date) || todayISO(),
      startTime: str(d.startTime),
      minutes: Math.max(0, num(d.minutes, 60)),
      note: str(d.note),
      done: !!d.done,
      createdAt: d.createdAt || nowISO()
    };
  }

  function experimentModel(d) {
    d = d || {};
    return {
      id: d.id || uid('exp'),
      subjectId: str(d.subjectId),
      title: str(d.title),
      hypothesis: str(d.hypothesis),
      protocol: str(d.protocol),
      startDate: str(d.startDate),
      endDate: str(d.endDate),
      status: oneOf(d.status, idsOf(EXPERIMENT_STATUSES), 'planned'),
      result: str(d.result),
      conclusion: str(d.conclusion),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  function boxModel(d) {
    d = d || {};
    return {
      id: d.id || uid('box'),
      kind: oneOf(d.kind, idsOf(BOX_KINDS), 'curiosity'),
      subjectId: str(d.subjectId),
      title: str(d.title),
      why: str(d.why),
      interest: clamp(num(d.interest, 3), 1, 5),
      priority: clamp(num(d.priority, 3), 1, 5),
      potentialCurriculum: str(d.potentialCurriculum),
      // Set when "Promote to next curriculum" creates a real record, so
      // the box entry stops competing for attention without being lost.
      promotedId: str(d.promotedId),
      order: num(d.order, 0),
      createdAt: d.createdAt || nowISO()
    };
  }

  // ============================================================
  // COLLECTIONS — makeCollection copied verbatim from promptarium-data.js
  // ============================================================
  function makeCollection(key, model) {
    function list() { var v = storeGet(key); return Array.isArray(v) ? v : []; }
    function get(id) { var all = list(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
    function add(data) { var r = model(data); var all = list(); all.push(r); storeSet(key, all); return r; }
    function update(id, patch) {
      var all = list();
      var idx = -1;
      for (var i = 0; i < all.length; i++) if (all[i].id === id) { idx = i; break; }
      if (idx < 0) return null;
      var merged = {};
      for (var k in all[idx]) merged[k] = all[idx][k];
      for (var k2 in patch) merged[k2] = patch[k2];
      merged.id = id;
      all[idx] = model(merged);
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) {
      var all = list();
      var next = all.filter(function (x) { return x.id !== id; });
      storeSet(key, next);
      return next.length !== all.length;
    }
    function removeWhere(fn) {
      var all = list();
      var next = all.filter(function (x) { return !fn(x); });
      storeSet(key, next);
      return all.length - next.length;
    }
    function replaceAll(records) { storeSet(key, Array.isArray(records) ? records : []); }
    return { key: key, list: list, get: get, add: add, update: update, remove: remove, removeWhere: removeWhere, replaceAll: replaceAll };
  }

  var Subjects       = makeCollection(KEYS.subjects, subjectModel);
  var Topics         = makeCollection(KEYS.topics, topicModel);
  var Concepts       = makeCollection(KEYS.concepts, conceptModel);
  var Connections    = makeCollection(KEYS.connections, connectionModel);
  var Contradictions = makeCollection(KEYS.contradictions, contradictionModel);
  var Resources      = makeCollection(KEYS.resources, resourceModel);
  var Chapters       = makeCollection(KEYS.chapters, chapterModel);
  var Marks          = makeCollection(KEYS.marks, markModel);
  var Curricula      = makeCollection(KEYS.curricula, curriculumModel);
  var Modules        = makeCollection(KEYS.modules, moduleModel);
  var Lessons        = makeCollection(KEYS.lessons, lessonModel);
  var Assignments    = makeCollection(KEYS.assignments, assignmentModel);
  var Inbox          = makeCollection(KEYS.inbox, inboxModel);
  var Lenses         = makeCollection(KEYS.lenses, lensModel);
  var Reviews        = makeCollection(KEYS.reviews, reviewModel);
  var Sessions       = makeCollection(KEYS.sessions, sessionModel);
  var Experiments    = makeCollection(KEYS.experiments, experimentModel);
  var BoxItems       = makeCollection(KEYS.box, boxModel);

  function byOrder(a, b) {
    var d = (a.order || 0) - (b.order || 0);
    return d !== 0 ? d : String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  }
  function byDate(a, b) { return String(a.date || '').localeCompare(String(b.date || '')); }
  function nextOrder(records) {
    var max = -1;
    for (var i = 0; i < records.length; i++) if ((records[i].order || 0) > max) max = records[i].order || 0;
    return max + 1;
  }
  function reorderCollection(col, orderedIds) {
    var all = col.list();
    var pos = {};
    for (var i = 0; i < orderedIds.length; i++) pos[orderedIds[i]] = i;
    for (var j = 0; j < all.length; j++) {
      if (Object.prototype.hasOwnProperty.call(pos, all[j].id)) all[j].order = pos[all[j].id];
    }
    col.replaceAll(all);
  }

  // ============================================================
  // §SINGLETONS — one record each, patch-merged.
  // ============================================================
  function readRecord(key) { var v = storeGet(key); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function patchRecord(key, patch) {
    var cur = readRecord(key);
    for (var k in patch) cur[k] = patch[k];
    storeSet(key, cur);
    return cur;
  }
  function getUiState() { return readRecord(KEYS.uiState); }
  function setUiState(patch) { return patchRecord(KEYS.uiState, patch); }
  function getSettings() { return readRecord(KEYS.settings); }
  function setSettings(patch) { return patchRecord(KEYS.settings, patch); }

  function getHero() {
    var h = readRecord(KEYS.hero);
    return {
      eyebrow: str(h.eyebrow) || 'A private academy of one',
      title: str(h.title) || 'The Athenaeum',
      line: str(h.line) || 'Eleven permanent fields.\nOne curriculum at a time.',
      note: str(h.note) || 'A field is permanent. A curriculum is temporary. Everything worth keeping survives the curriculum that taught it.',
      image: str(h.image),
      motto: str(h.motto) || 'STUDY · SYNTHESISE · APPLY · '
    };
  }
  function setHero(patch) { return patchRecord(KEYS.hero, patch); }

  /* The three-way switcher on the homepage. Each slot holds a curriculum
     id. A curriculum's own `status` is the source of truth for its label;
     these three are the pinned picks, so switching a slot never rewrites
     history. */
  function getFocus() {
    var f = readRecord(KEYS.focus);
    return { currentId: str(f.currentId), nextId: str(f.nextId), backBurnerId: str(f.backBurnerId) };
  }
  function setFocus(patch) { return patchRecord(KEYS.focus, patch); }

  /* Today's Learning. Every line is COMPUTED from sessions/reviews/
     assignments; these fields are optional manual overrides, so a blank
     override always falls back to the real data rather than blanking it. */
  function getToday() {
    var t = readRecord(KEYS.today);
    return {
      date: str(t.date),
      studyOverride: str(t.studyOverride),
      reviewOverride: str(t.reviewOverride),
      assignmentOverride: str(t.assignmentOverride),
      intention: str(t.intention)
    };
  }
  function setToday(patch) { return patchRecord(KEYS.today, patch); }

  // ============================================================
  // §QUERIES — every derived number the UI shows lives here, so a card
  // and its hub can never disagree.
  // ============================================================
  function subjectList() { return Subjects.list().slice().sort(byOrder); }
  function subjectById(id) { return Subjects.get(id); }
  function subjectName(id) { var s = Subjects.get(id); return s ? s.name : ''; }

  function curriculaFor(subjectId) {
    return Curricula.list().filter(function (c) { return c.subjectId === subjectId; }).sort(byOrder);
  }
  function curriculaByStatus(subjectId, status) {
    return curriculaFor(subjectId).filter(function (c) { return c.status === status; });
  }
  function completedCurriculaCount(subjectId) {
    return curriculaByStatus(subjectId, 'completed').length;
  }
  function activeCurriculumFor(subjectId) {
    var cur = curriculaByStatus(subjectId, 'current');
    return cur.length ? cur[0] : null;
  }

  function modulesFor(curriculumId) {
    return Modules.list().filter(function (m) { return m.curriculumId === curriculumId; }).sort(byOrder);
  }
  function lessonsFor(moduleId) {
    return Lessons.list().filter(function (l) { return l.moduleId === moduleId; }).sort(byOrder);
  }
  function lessonsForCurriculum(curriculumId) {
    return Lessons.list().filter(function (l) { return l.curriculumId === curriculumId; }).sort(byOrder);
  }
  function assignmentsFor(curriculumId) {
    return Assignments.list().filter(function (a) { return a.curriculumId === curriculumId; }).sort(byOrder);
  }

  /* Progress is measured against LEARNING OUTCOMES when a curriculum has
     them, and falls back to lessons completed when it does not — a
     curriculum with real outcomes should never be scored on how many
     videos got watched. */
  function curriculumProgress(curriculumId) {
    var c = Curricula.get(curriculumId);
    if (!c) return 0;
    if (c.outcomes && c.outcomes.length) {
      var sum = 0;
      c.outcomes.forEach(function (o) { sum += clamp(num(o.progress, 0), 0, 100); });
      return Math.round(sum / c.outcomes.length);
    }
    var ls = lessonsForCurriculum(curriculumId);
    if (!ls.length) return 0;
    var done = ls.filter(function (l) { return l.done; }).length;
    return Math.round((done / ls.length) * 100);
  }

  /* The current position inside a curriculum: the first unfinished lesson
     and the module that owns it. This is what the homepage reads. */
  function curriculumPosition(curriculumId) {
    var mods = modulesFor(curriculumId);
    for (var i = 0; i < mods.length; i++) {
      var ls = lessonsFor(mods[i].id);
      for (var j = 0; j < ls.length; j++) {
        if (!ls[j].done) return { module: mods[i], lesson: ls[j] };
      }
      if (!ls.length && !mods[i].done) return { module: mods[i], lesson: null };
    }
    return { module: mods.length ? mods[mods.length - 1] : null, lesson: null };
  }

  function topicsFor(subjectId) {
    return Topics.list().filter(function (t) { return t.subjectId === subjectId; }).sort(byOrder);
  }
  function childTopics(subjectId, parentId) {
    return topicsFor(subjectId).filter(function (t) { return (t.parentId || '') === (parentId || ''); });
  }
  function topicTree(subjectId) {
    var all = topicsFor(subjectId);
    var byParent = {};
    all.forEach(function (t) {
      var p = t.parentId || '';
      (byParent[p] = byParent[p] || []).push(t);
    });
    function build(parentId, depth) {
      return (byParent[parentId] || []).map(function (t) {
        return { topic: t, depth: depth, children: build(t.id, depth + 1) };
      });
    }
    return build('', 0);
  }
  // Guard against a topic being dragged under its own descendant.
  function isDescendantTopic(topicId, maybeAncestorId) {
    var seen = {};
    var cur = Topics.get(topicId);
    while (cur && cur.parentId && !seen[cur.id]) {
      seen[cur.id] = 1;
      if (cur.parentId === maybeAncestorId) return true;
      cur = Topics.get(cur.parentId);
    }
    return false;
  }

  function conceptsFor(subjectId) {
    return Concepts.list().filter(function (c) { return c.subjectId === subjectId; }).sort(byOrder);
  }
  function conceptsForTopic(topicId) {
    return Concepts.list().filter(function (c) { return c.topicId === topicId; }).sort(byOrder);
  }
  // ============================================================
  // §RESOURCE QUERIES
  //
  // resFields() is the single place that knows a resource can carry either
  // shape. Every filter below goes through it, so a record written before
  // the many-fields change still answers correctly whether or not the
  // migration has run yet on this device.
  // ============================================================
  function resFields(r) {
    if (!r) return [];
    var ids = idList(r.subjectIds);
    if (!ids.length && r.subjectId) ids = [String(r.subjectId)];
    return ids;
  }
  function resourcesFor(subjectId) {
    return Resources.list().filter(function (r) {
      return resFields(r).indexOf(subjectId) >= 0;
    }).sort(byOrder);
  }
  function resourcesInBucket(subjectId, bucket) {
    return resourcesFor(subjectId).filter(function (r) { return r.bucket === bucket; });
  }
  function resourcesForCurriculum(curriculumId) {
    return Resources.list().filter(function (r) {
      return (r.curriculumIds || []).indexOf(curriculumId) >= 0;
    }).sort(byOrder);
  }
  function resourcesUnfiled() {
    return Resources.list().filter(function (r) { return !resFields(r).length; }).sort(byOrder);
  }
  function resourcesByType(type) {
    return Resources.list().filter(function (r) { return r.type === type; }).sort(byOrder);
  }
  function resourcesTagged(tag) {
    var t = String(tag || '').toLowerCase();
    return Resources.list().filter(function (r) { return (r.tags || []).indexOf(t) >= 0; }).sort(byOrder);
  }
  /* Every tag in the library with its count, commonest first, then
     alphabetical — so the tag rail is stable between renders rather than
     reshuffling whenever two tags tie. */
  function allResourceTags() {
    var counts = {};
    Resources.list().forEach(function (r) {
      (r.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.keys(counts).map(function (t) { return { tag: t, count: counts[t] }; })
      .sort(function (a, b) { return b.count - a.count || a.tag.localeCompare(b.tag); });
  }
  function peopleResources() {
    return resourcesByType('Person').sort(function (a, b) {
      return String(a.title).localeCompare(String(b.title));
    });
  }
  /* Everything credited to a person — plus, as a courtesy, anything whose
     free-text author happens to be their exact name, so a library filled in
     before the Person record existed still finds its works. */
  function resourcesCrediting(personId) {
    var p = Resources.get(personId);
    var name = p ? String(p.title).trim().toLowerCase() : '';
    return Resources.list().filter(function (r) {
      if (r.id === personId) return false;
      if ((r.personIds || []).indexOf(personId) >= 0) return true;
      return !!name && String(r.author).trim().toLowerCase() === name;
    }).sort(byOrder);
  }
  function chaptersFor(resourceId) {
    return Chapters.list().filter(function (c) { return c.resourceId === resourceId; }).sort(byOrder);
  }
  /* Timestamped notes sort by time, with un-pinned notes (at === -1) last
     rather than first, where a raw numeric sort would put them. */
  function marksFor(resourceId) {
    return Marks.list().filter(function (m) { return m.resourceId === resourceId; })
      .sort(function (a, b) {
        if (a.at < 0 && b.at < 0) return String(a.createdAt).localeCompare(String(b.createdAt));
        if (a.at < 0) return 1;
        if (b.at < 0) return -1;
        return a.at - b.at;
      });
  }
  /* A book's progress is its chapters, not a number someone typed. Anything
     without chapters falls back to the manual `progress` field. */
  function resourceProgress(r) {
    if (!r) return 0;
    var ch = chaptersFor(r.id);
    if (!ch.length) return clamp(num(r.progress, 0), 0, 100);
    var done = ch.filter(function (c) { return c.read; }).length;
    return Math.round((done / ch.length) * 100);
  }
  function contradictionsFor(subjectId) {
    return Contradictions.list().filter(function (c) { return c.subjectId === subjectId; }).sort(byOrder);
  }
  function openContradictions() {
    return Contradictions.list().filter(function (c) { return !c.resolved; }).sort(byOrder);
  }

  /* Cross-field links read from BOTH ends: a link stored on Psychology
     pointing at History must also appear inside History. */
  function connectionsFor(subjectId) {
    return Connections.list().filter(function (c) {
      if (c.subjectId === subjectId) return true;
      return c.kind === 'cross' && c.toType === 'subject' && c.toId === subjectId;
    }).sort(byOrder);
  }
  function internalConnections(subjectId) {
    return connectionsFor(subjectId).filter(function (c) { return c.kind === 'internal' && c.subjectId === subjectId; });
  }
  function crossConnections(subjectId) {
    return connectionsFor(subjectId).filter(function (c) { return c.kind === 'cross'; });
  }
  // Given a cross link and the subject reading it, name the far end.
  function otherEndOf(conn, subjectId) {
    if (conn.kind !== 'cross') return '';
    return conn.subjectId === subjectId ? conn.toId : conn.subjectId;
  }

  function inboxFor(subjectId) {
    return Inbox.list().filter(function (i) { return i.subjectId === subjectId; })
      .sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
  }
  function inboxOpen(subjectId) {
    return inboxFor(subjectId).filter(function (i) { return i.status === 'new' || i.status === 'investigating'; });
  }
  function inboxAll() {
    return Inbox.list().slice()
      .sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
  }
  function lensesFor(subjectId) {
    return Lenses.list().filter(function (l) { return !l.subjectId || l.subjectId === subjectId; }).sort(byOrder);
  }

  function experimentsFor(subjectId) {
    return Experiments.list().filter(function (e) { return e.subjectId === subjectId; }).sort(byOrder);
  }
  function sessionsOn(dateIso) {
    return Sessions.list().filter(function (s) { return s.date === dateIso; })
      .sort(function (a, b) { return String(a.startTime || '').localeCompare(String(b.startTime || '')); });
  }
  function sessionsBetween(fromIso, toIso) {
    return Sessions.list().filter(function (s) {
      return s.date >= fromIso && s.date <= toIso;
    }).sort(byDate);
  }

  // --- Retention ------------------------------------------------------
  function reviewsDue(onIso) {
    var day = onIso || todayISO();
    return Reviews.list().filter(function (r) { return r.dueDate <= day; })
      .sort(function (a, b) { return String(a.dueDate).localeCompare(String(b.dueDate)); });
  }
  function reviewsOverdue(onIso) {
    var day = onIso || todayISO();
    return Reviews.list().filter(function (r) { return r.dueDate < day; })
      .sort(function (a, b) { return String(a.dueDate).localeCompare(String(b.dueDate)); });
  }
  function reviewsWeak() {
    return Reviews.list().filter(function (r) { return r.strength === 'weak'; }).sort(byOrder);
  }
  function reviewsRecent(days) {
    var cut = addDays(todayISO(), -(days || 14));
    return Reviews.list().filter(function (r) { return r.lastReviewed && r.lastReviewed.slice(0, 10) >= cut; })
      .sort(function (a, b) { return String(b.lastReviewed).localeCompare(String(a.lastReviewed)); });
  }
  function reviewsMastered() {
    return Reviews.list().filter(function (r) { return r.strength === 'mastered'; });
  }
  /* A deliberately simple, legible schedule — doubling on a good recall,
     back to one day on a bad one. Not SM-2: the point is that Damian can
     predict when something will come back, not that the algorithm is
     clever. */
  var REVIEW_LADDER = [1, 3, 7, 16, 35, 75, 150];
  function gradeReview(id, good) {
    var r = Reviews.get(id);
    if (!r) return null;
    var idx = REVIEW_LADDER.indexOf(r.intervalDays);
    var nextIdx = good ? Math.min(REVIEW_LADDER.length - 1, (idx < 0 ? 0 : idx) + 1) : 0;
    var nextInterval = REVIEW_LADDER[nextIdx];
    var strength = !good ? 'weak'
      : nextIdx >= 5 ? 'mastered'
      : nextIdx >= 3 ? 'solid'
      : 'learning';
    return Reviews.update(id, {
      intervalDays: nextInterval,
      dueDate: addDays(todayISO(), nextInterval),
      lastReviewed: nowISO(),
      strength: strength,
      reps: num(r.reps, 0) + 1,
      lapses: num(r.lapses, 0) + (good ? 0 : 1)
    });
  }

  // --- Homepage roll-ups ----------------------------------------------
  function subjectStats(subjectId) {
    var active = activeCurriculumFor(subjectId);
    return {
      active: active,
      completed: completedCurriculaCount(subjectId),
      topics: topicsFor(subjectId).length,
      concepts: conceptsFor(subjectId).length,
      openQuestions: inboxOpen(subjectId).length,
      openContradictions: contradictionsFor(subjectId).filter(function (c) { return !c.resolved; }).length,
      resources: resourcesFor(subjectId).length,
      progress: active ? curriculumProgress(active.id) : 0
    };
  }

  /* Resolve one slot of the homepage switcher into everything the card
     needs. Falls back to any curriculum with the matching status when the
     slot has not been pinned, so the section is never empty by accident. */
  function focusSlot(slot) {
    var f = getFocus();
    var id = slot === 'next' ? f.nextId : slot === 'back' ? f.backBurnerId : f.currentId;
    var c = id ? Curricula.get(id) : null;
    if (!c) {
      var want = slot === 'next' ? 'next' : slot === 'back' ? 'backburner' : 'current';
      var found = Curricula.list().filter(function (x) { return x.status === want; }).sort(byOrder);
      c = found.length ? found[0] : null;
    }
    if (!c) return null;
    var pos = curriculumPosition(c.id);
    return {
      curriculum: c,
      subject: subjectById(c.subjectId),
      module: pos.module,
      lesson: pos.lesson,
      progress: curriculumProgress(c.id),
      nextAction: c.nextAction || (pos.lesson ? pos.lesson.title : '')
    };
  }

  /* Today's Learning: the study session, the review load and the next
     assignment. Overrides win only when non-empty. */
  function todayLines() {
    var t = getToday();
    var day = todayISO();
    var sessions = sessionsOn(day);
    var due = reviewsDue(day);
    var nextAsg = Assignments.list().filter(function (a) { return !a.done && a.due; })
      .sort(function (a, b) { return String(a.due).localeCompare(String(b.due)); })[0] || null;

    var study = sessions.filter(function (s) { return !s.done; })[0] || sessions[0] || null;
    return {
      intention: t.intention,
      study: {
        text: t.studyOverride || (study ? study.title : ''),
        meta: study ? (labelFrom(SESSION_KINDS, study.kind, 'Study') + ' · ' + fmtHours(study.minutes) + (study.startTime ? ' · ' + study.startTime : '')) : '',
        subjectId: study ? study.subjectId : '',
        count: sessions.length,
        empty: !t.studyOverride && !study
      },
      review: {
        text: t.reviewOverride || (due.length ? due.length + (due.length === 1 ? ' concept due' : ' concepts due') : ''),
        meta: due.length ? due.slice(0, 3).map(function (r) { return r.label; }).filter(Boolean).join(' · ') : '',
        count: due.length,
        empty: !t.reviewOverride && !due.length
      },
      assignment: {
        text: t.assignmentOverride || (nextAsg ? nextAsg.title : ''),
        meta: nextAsg ? (nextAsg.type + ' · due ' + fmtDateShort(nextAsg.due)) : '',
        overdue: !!(nextAsg && nextAsg.due < day),
        empty: !t.assignmentOverride && !nextAsg
      }
    };
  }

  // --- Cascading deletes ----------------------------------------------
  /* Deleting never orphans and never silently takes knowledge with it.
     A curriculum takes its own modules/lessons/assignments (they have no
     meaning outside it) but LEAVES concepts, inbox captures and resources
     alone — those belong to the field. */
  function removeCurriculum(id) {
    var c = Curricula.get(id);
    if (!c) return false;
    Modules.removeWhere(function (m) { return m.curriculumId === id; });
    Lessons.removeWhere(function (l) { return l.curriculumId === id; });
    Assignments.removeWhere(function (a) { return a.curriculumId === id; });
    Resources.list().forEach(function (r) {
      if ((r.curriculumIds || []).indexOf(id) >= 0) {
        Resources.update(r.id, { curriculumIds: r.curriculumIds.filter(function (x) { return x !== id; }) });
      }
    });
    Inbox.list().forEach(function (i) { if (i.curriculumId === id) Inbox.update(i.id, { curriculumId: '' }); });
    Sessions.list().forEach(function (s) { if (s.curriculumId === id) Sessions.update(s.id, { curriculumId: '' }); });
    var f = getFocus();
    var patch = {};
    if (f.currentId === id) patch.currentId = '';
    if (f.nextId === id) patch.nextId = '';
    if (f.backBurnerId === id) patch.backBurnerId = '';
    if (Object.keys(patch).length) setFocus(patch);
    return Curricula.remove(id);
  }

  /* A resource takes its own chapters and timestamped notes with it —
     those have no meaning without it — but only NULLS every reference
     pointing at it. Deleting a Person must never delete their books. */
  function removeResource(id) {
    var r = Resources.get(id);
    if (!r) return false;
    Chapters.removeWhere(function (c) { return c.resourceId === id; });
    Marks.removeWhere(function (m) { return m.resourceId === id; });
    Resources.list().forEach(function (o) {
      if (o.id !== id && (o.personIds || []).indexOf(id) >= 0) {
        Resources.update(o.id, { personIds: o.personIds.filter(function (x) { return x !== id; }) });
      }
    });
    return Resources.remove(id);
  }

  // ============================================================
  // §MIGRATION — single-field resources to many-field resources.
  //
  // list() returns raw stored records; the model does NOT run on read. So a
  // resource written before this change keeps its bare `subjectId` until
  // something edits it, and every query would have to keep guessing forever.
  // This runs the whole collection through resourceModel once.
  //
  // It must not run before the cloud pull has had its chance, or a device
  // that opened the Library first would push a migration built from a stale
  // local list — hence the call site inside maybeSeedAfterSyncAttempt.
  // Idempotent: the flag is belt, running it twice is braces.
  // ============================================================
  function migrateResourcesV2() {
    try {
      if (storeGet(KEYS.resMigratedAt)) return false;
      var all = Resources.list();
      if (all.length) {
        var needed = all.some(function (r) { return !Array.isArray(r.subjectIds) || r.tags === undefined; });
        if (needed) Resources.replaceAll(all.map(resourceModel));
      }
      storeSet(KEYS.resMigratedAt, nowISO());
      return true;
    } catch (e) { return false; }
  }

  /* Deleting a topic re-parents its children to its own parent rather
     than deleting a whole branch, and detaches its concepts instead of
     destroying them. */
  function removeTopic(id) {
    var t = Topics.get(id);
    if (!t) return false;
    Topics.list().forEach(function (c) { if (c.parentId === id) Topics.update(c.id, { parentId: t.parentId || '' }); });
    Concepts.list().forEach(function (c) { if (c.topicId === id) Concepts.update(c.id, { topicId: '' }); });
    Connections.removeWhere(function (c) { return c.fromId === id || c.toId === id; });
    return Topics.remove(id);
  }

  function removeConcept(id) {
    Connections.removeWhere(function (c) { return c.fromId === id || c.toId === id; });
    Reviews.removeWhere(function (r) { return r.conceptId === id; });
    Concepts.list().forEach(function (c) {
      if ((c.relatedIds || []).indexOf(id) >= 0) {
        Concepts.update(c.id, { relatedIds: c.relatedIds.filter(function (x) { return x !== id; }) });
      }
    });
    Topics.list().forEach(function (t) {
      if ((t.conceptIds || []).indexOf(id) >= 0) {
        Topics.update(t.id, { conceptIds: t.conceptIds.filter(function (x) { return x !== id; }) });
      }
    });
    return Concepts.remove(id);
  }

  /* Promote a Box entry into a real curriculum. The box item is kept and
     stamped rather than deleted, so the trail from curiosity to
     curriculum stays readable. */
  function promoteBoxItem(id, subjectId, status) {
    var b = BoxItems.get(id);
    if (!b) return null;
    var subj = subjectId || b.subjectId;
    if (!subj) return null;
    var c = Curricula.add({
      subjectId: subj,
      title: b.potentialCurriculum || b.title,
      status: oneOf(status, idsOf(CURRICULUM_STATUSES), 'next'),
      why: b.why,
      order: nextOrder(curriculaFor(subj))
    });
    BoxItems.update(id, { promotedId: c.id, subjectId: subj });
    if (c.status === 'next') setFocus({ nextId: c.id });
    if (c.status === 'backburner') setFocus({ backBurnerId: c.id });
    return c;
  }

  /* Promote an inbox capture into a permanent Concept in the same field.
     This is the curriculum→field escape hatch: research raised anywhere
     ends up in the field's permanent knowledge. */
  function promoteInboxToConcept(id) {
    var i = Inbox.get(id);
    if (!i || !i.subjectId) return null;
    var c = Concepts.add({
      subjectId: i.subjectId,
      name: i.text.slice(0, 120),
      definition: i.note,
      sources: i.source,
      order: nextOrder(conceptsFor(i.subjectId))
    });
    Inbox.update(id, { status: 'resolved', promotedTo: 'concept', promotedId: c.id });
    return c;
  }

  // ============================================================
  // §SEED — the eleven fields, in Damian's own words and his own order.
  //
  // Nothing else is seeded. No fake curricula, no fake concepts, no
  // sample topics: an empty field is honest, and a fake one would have to
  // be deleted before the page could be used.
  // ============================================================
  var SEED_SUBJECTS = [
    {
      id: 'psychology', name: 'Human Psychology & Neuroscience', glyph: '◈', hue: 268,
      blurb: 'Understanding the mind — both my own and others’ — reveals the blueprint behind behaviour, influence, and inner mastery.',
      whyIStudy: 'This is the first field. Everything else I study is downstream of understanding how people, including me, actually work.',
      status: 'deep', season: 'in'
    },
    {
      id: 'wealth', name: 'Wealth Accumulation & Entrepreneurship', glyph: '◆', hue: 42,
      blurb: 'By relying on myself and my assets, I build a foundation for freedom and limitless potential.',
      whyIStudy: 'Freedom is the point. Self-reliance and owned assets are the only route to it that does not depend on someone else’s permission.',
      status: 'active', season: 'in'
    },
    {
      id: 'health', name: 'Holistic Health & Alternative Healing', glyph: '❦', hue: 148,
      blurb: 'Healing practices that work with the body, not against it. Health is the foundation — without it, none of the rest matters.',
      whyIStudy: 'I trust ancient wisdom over an industry that profits from keeping people unwell. This is the foundation the other ten stand on.',
      status: 'active', season: 'in'
    },
    {
      id: 'persuasion', name: 'Persuasive Communication & Writing', glyph: '✒', hue: 12,
      blurb: 'To make a social impact, it is essential to communicate and express the inner world effectively.',
      whyIStudy: 'An idea that cannot be transmitted is an idea that does not exist outside my own head.',
      status: 'active', season: 'in'
    },
    {
      id: 'astrology', name: 'Astrology & Numerology', glyph: '☾', hue: 232,
      blurb: 'Tools for reading strengths, openings, challenges and timing — so decisions can be strategic and aligned rather than reactive.',
      whyIStudy: 'Timing is a resource. These systems let me anticipate it instead of being surprised by it.',
      status: 'maintaining', season: 'off'
    },
    {
      id: 'history', name: 'History', glyph: '⌖', hue: 28,
      blurb: 'The past holds the patterns that predict the future. I study warfare and the rise and fall of empires to inform strategy.',
      whyIStudy: 'Every business problem I will ever face has already been played out at a larger scale, with better records.',
      status: 'active', season: 'in'
    },
    {
      id: 'self', name: 'Self-Development', glyph: '◉', hue: 190,
      blurb: 'Mastering oneself means mastering your world, because the internal reflects the external.',
      whyIStudy: 'The bottleneck is never the strategy. It is the person executing it.',
      status: 'active', season: 'in'
    },
    {
      id: 'metaphysics', name: 'Metaphysics & Quantum Physics', glyph: '◇', hue: 208,
      blurb: 'These fields show how the unseen governs the seen, bridging science, spirit, and the unknown.',
      whyIStudy: 'I want the seam where physics and spirit stop contradicting each other — and to know which side of it any given claim sits on.',
      status: 'maintaining', season: 'off'
    },
    {
      id: 'spirit', name: 'Spiritual Practices & Esotericism', glyph: '✧', hue: 288,
      blurb: 'Aligning with hidden and divine wisdom to unlock deeper truths and growth that most people never access.',
      whyIStudy: 'The traditions that were deliberately hidden were hidden because they worked. I want to know which ones still do.',
      status: 'maintaining', season: 'in'
    },
    {
      id: 'ai', name: 'Artificial Intelligence', glyph: '⬡', hue: 172,
      blurb: 'The leverage multiplier. Every other field on this shelf compounds faster when this one is fluent.',
      whyIStudy: 'This is the largest capability shift of my working life. Being early and fluent is worth more than being right later.',
      status: 'active', season: 'in'
    },
    {
      id: 'lens', name: 'Photography & Videography', glyph: '◐', hue: 328,
      blurb: 'The craft of seeing, then of making other people see it. The visual half of communication.',
      whyIStudy: 'Writing carries the argument. Image carries the feeling. I want both hands working.',
      status: 'maintaining', season: 'off'
    }
  ];

  var SEED_LENSES = [
    { question: 'What is missing here?', note: 'The absence is usually louder than what was said.' },
    { question: 'What’s beneath this?', note: 'What has to be true for this claim to hold?' },
    { question: 'What are the flaws?', note: 'Steelman it first, then find the real crack.' },
    { question: 'What are the implications?', note: 'If this is true, what else must change?' },
    { question: 'What’s the origin?', note: 'Who said it first, and what were they arguing against?' }
  ];

  function seedNow() {
    if (storeGet(KEYS.seededAt)) return 0;
    var n = 0;
    if (!Subjects.list().length) {
      SEED_SUBJECTS.forEach(function (s, i) {
        Subjects.add({
          id: s.id, name: s.name, blurb: s.blurb, glyph: s.glyph, hue: s.hue,
          status: s.status, season: s.season, whyIStudy: s.whyIStudy, order: i
        });
        n++;
      });
    }
    if (!Lenses.list().length) {
      SEED_LENSES.forEach(function (l, i) { Lenses.add({ question: l.question, note: l.note, order: i }); n++; });
    }
    storeSet(KEYS.seededAt, nowISO());
    return n;
  }

  /* A field added to SEED_SUBJECTS after a device already seeded would
     otherwise never appear there. Same shape as promptarium-data.js's
     migrateCollections(). */
  function migrateSubjects() {
    var stored = Subjects.list();
    if (!stored.length) return 0;
    var have = {};
    stored.forEach(function (s) { have[s.id] = 1; });
    var added = 0;
    SEED_SUBJECTS.forEach(function (s, i) {
      if (have[s.id]) return;
      Subjects.add({
        id: s.id, name: s.name, blurb: s.blurb, glyph: s.glyph, hue: s.hue,
        status: s.status, season: s.season, whyIStudy: s.whyIStudy, order: i
      });
      added++;
    });
    return added;
  }

  /* Never seed before the cloud pull has had its chance: a push here
     would replace the whole 'athenaeum' row with a fresh-install blank.
     Same guard as promptarium-data.js:1056. */
  function maybeSeedAfterSyncAttempt(ref, onDone) {
    var run = function () {
      var n = seedNow() + migrateSubjects();
      // Same gate, same reason: migrating before the pull would push a
      // rewrite built from a stale local list.
      if (migrateResourcesV2()) n++;
      if (n && typeof onDone === 'function') onDone(n);
    };
    if (ref && ref.applied) { run(); return; }
    setTimeout(run, 1200);
  }

  global.Athenaeum = {
    KEYS: KEYS,
    storeGet: storeGet, storeSet: storeSet,
    uid: uid, nowISO: nowISO, todayISO: todayISO, addDays: addDays, daysBetween: daysBetween,
    fmtDate: fmtDate, fmtDateShort: fmtDateShort, fmtAgo: fmtAgo, fmtHours: fmtHours,
    esc: esc, clamp: clamp, num: num, safeUrl: safeUrl, roman: roman, labelFrom: labelFrom,
    sanitizeHtml: sanitizeHtml, htmlToText: htmlToText, readingMinutes: readingMinutes,
    compressImageDataUrl: compressImageDataUrl, fetchResourcePreview: fetchResourcePreview,
    embedFor: embedFor, fmtClock: fmtClock, parseClock: parseClock,

    MASTERY: MASTERY, masteryLabel: masteryLabel, masteryHint: masteryHint, masteryPct: masteryPct,
    SUBJECT_STATUSES: SUBJECT_STATUSES, SEASONS: SEASONS,
    CURRICULUM_STATUSES: CURRICULUM_STATUSES, TOPIC_STATUSES: TOPIC_STATUSES,
    IMPORTANCE: IMPORTANCE, RESOURCE_BUCKETS: RESOURCE_BUCKETS, RESOURCE_TYPES: RESOURCE_TYPES,
    INBOX_KINDS: INBOX_KINDS, INBOX_STATUSES: INBOX_STATUSES, SESSION_KINDS: SESSION_KINDS,
    ASSIGNMENT_TYPES: ASSIGNMENT_TYPES, BOX_KINDS: BOX_KINDS, REVIEW_STRENGTHS: REVIEW_STRENGTHS,
    EXPERIMENT_STATUSES: EXPERIMENT_STATUSES, CONNECTION_KINDS: CONNECTION_KINDS,

    subjectModel: subjectModel, topicModel: topicModel, conceptModel: conceptModel,
    curriculumModel: curriculumModel, resourceModel: resourceModel, inboxModel: inboxModel,
    chapterModel: chapterModel, markModel: markModel,

    Subjects: Subjects, Topics: Topics, Concepts: Concepts, Connections: Connections,
    Contradictions: Contradictions, Resources: Resources, Chapters: Chapters, Marks: Marks,
    Curricula: Curricula,
    Modules: Modules, Lessons: Lessons, Assignments: Assignments,
    Inbox: Inbox, Lenses: Lenses, Reviews: Reviews, Sessions: Sessions,
    Experiments: Experiments, BoxItems: BoxItems,

    byOrder: byOrder, byDate: byDate, nextOrder: nextOrder, reorderCollection: reorderCollection,

    getUiState: getUiState, setUiState: setUiState,
    getSettings: getSettings, setSettings: setSettings,
    getHero: getHero, setHero: setHero,
    getFocus: getFocus, setFocus: setFocus,
    getToday: getToday, setToday: setToday,

    subjectList: subjectList, subjectById: subjectById, subjectName: subjectName,
    curriculaFor: curriculaFor, curriculaByStatus: curriculaByStatus,
    completedCurriculaCount: completedCurriculaCount, activeCurriculumFor: activeCurriculumFor,
    modulesFor: modulesFor, lessonsFor: lessonsFor, lessonsForCurriculum: lessonsForCurriculum,
    assignmentsFor: assignmentsFor, curriculumProgress: curriculumProgress,
    curriculumPosition: curriculumPosition,
    topicsFor: topicsFor, childTopics: childTopics, topicTree: topicTree,
    isDescendantTopic: isDescendantTopic,
    conceptsFor: conceptsFor, conceptsForTopic: conceptsForTopic,
    resourcesFor: resourcesFor, resourcesInBucket: resourcesInBucket,
    resourcesForCurriculum: resourcesForCurriculum, resFields: resFields,
    resourcesUnfiled: resourcesUnfiled, resourcesByType: resourcesByType,
    resourcesTagged: resourcesTagged, allResourceTags: allResourceTags,
    peopleResources: peopleResources, resourcesCrediting: resourcesCrediting,
    chaptersFor: chaptersFor, marksFor: marksFor, resourceProgress: resourceProgress,
    contradictionsFor: contradictionsFor, openContradictions: openContradictions,
    connectionsFor: connectionsFor, internalConnections: internalConnections,
    crossConnections: crossConnections, otherEndOf: otherEndOf,
    inboxFor: inboxFor, inboxOpen: inboxOpen, inboxAll: inboxAll, lensesFor: lensesFor,
    experimentsFor: experimentsFor, sessionsOn: sessionsOn, sessionsBetween: sessionsBetween,
    reviewsDue: reviewsDue, reviewsOverdue: reviewsOverdue, reviewsWeak: reviewsWeak,
    reviewsRecent: reviewsRecent, reviewsMastered: reviewsMastered, gradeReview: gradeReview,
    subjectStats: subjectStats, focusSlot: focusSlot, todayLines: todayLines,

    removeCurriculum: removeCurriculum, removeTopic: removeTopic, removeConcept: removeConcept,
    removeResource: removeResource, migrateResourcesV2: migrateResourcesV2,
    promoteBoxItem: promoteBoxItem, promoteInboxToConcept: promoteInboxToConcept,

    SEED_SUBJECTS: SEED_SUBJECTS, SEED_LENSES: SEED_LENSES,
    seedNow: seedNow, migrateSubjects: migrateSubjects,
    maybeSeedAfterSyncAttempt: maybeSeedAfterSyncAttempt
  };

})(window);
