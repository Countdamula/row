// =============================================================
// vault-article.js — the articles.
//
//   window.HDArticle
//
// A game page's third section, and the page each of its rows
// opens. Two references drive it, and neither is a dashboard:
//
//   a feed  — a banner with one button, then a hairline-separated
//             list of tag / title / excerpt / by-line / thumbnail
//   a page  — a formatting bar, a big title, and a wide measured
//             column you write into. No Save button; it saves.
//
// IT IS ITS OWN FILE for the same reason vault-game.js is: this
// and the game template are the two things meant to be edited,
// and neither belongs in the middle of a router.
//
// WHAT REPLACED WHAT. Until 2026-09-04 the region below the video
// rail was four columns — Personal notes, Favourite quote,
// Memories, Journal entries. They were small-note surfaces, and
// there was nowhere in this studio to write something long. The
// columns are gone from the interface; every note and entry they
// held is CONVERTED INTO AN ARTICLE the first time a game page is
// opened (§MIGRATE), and the original fields are left in storage
// untouched.
//
// TWO KEYS, NOT ONE FIELD
// ─────────────────────────────────────────────────────────────
//   vault:articles        the INDEX — an array, metadata only
//   vault:article:<id>    one key per article — { bodyHtml }
//
// The body is deliberately NOT on the game record. Vault.list
// re-parses the whole games array on every call and allCards()
// calls it on every repaint of every view, with no caching
// anywhere — so a chapter of prose on a game record would be
// re-parsed by the mosaic, the search and the counts. Split like
// this, the feed parses a small array and the editor parses
// exactly one body.
//
// Both keys sit under `vault:`, so sync.js, snapshots.js,
// data-export.js, trash.js and shrink-banner.js cover them with
// no registration change — the registry watches the PREFIX.
// =============================================================

(function (global) {
  'use strict';

  var U = function () { return global.AscUI; };
  var H = function () { return global.HD; };
  var App = function () { return global.HDApp; };
  var esc = function (s) { return U().esc(s); };
  var attr = function (s) { return U().attr(s); };
  var $ = function (id) { return document.getElementById(id); };

  var IDX = 'vault:articles';
  var BODY = 'vault:article:';
  var AUTHOR = 'Damian';

  function uid() {
    return 'a_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  // The same two helpers vault-data.js uses, and for the same
  // reason: this file owns its keys and nothing else reads them.
  function get(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
    catch (e) { return fallback; }
  }
  function put(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { global.dispatchEvent(new CustomEvent('vault:save', { detail: { key: key, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { global.dispatchEvent(new CustomEvent('vault:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }

  // =============================================================
  // §SANITISE
  // =============================================================
  // Ported from athenaeum-data.js, which took it from
  // promptarium-data.js. Per-file duplication is this repo's house
  // pattern rather than an oversight, and the whitelist has to
  // differ here in two ways anyway (noted at each).
  //
  // Two properties carry the whole thing:
  //
  //   1. It parses with DOMParser, never `div.innerHTML`. A
  //      DOMParser document has no browsing context, so an
  //      `<img onerror=…>` in pasted markup cannot fire while it
  //      is being read. Using a live element to "clean" hostile
  //      HTML executes it on the way in.
  //   2. It runs on EVERY write, so no path — the toolbar, a
  //      paste, a drop, an IME, a future feature — can get a dirty
  //      value into storage.
  //
  // `class` is stripped and `style` is rebuilt rather than kept:
  // text copied out of a PDF reader arrives carrying
  // `background:#fff;color:#000`, and keeping it would drop a
  // white slab into the middle of this page's one ground.

  function stripControl(s) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '');
  }

  function safeUrl(u, opts) {
    var s = stripControl(u).trim();
    if (!s) return '';
    var low = s.toLowerCase();
    if (low.indexOf('http://') === 0 || low.indexOf('https://') === 0 || low.indexOf('mailto:') === 0) return s;
    if (opts && opts.allowDataImage &&
      /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) return s;
    return '';
  }
  // What a link TYPED into the toolbar's dialog is allowed to
  // become. Looser than the paste path on purpose: "example.com"
  // typed by hand means https://example.com. It still ends up
  // going through safeUrl on the way into storage.
  function typedUrl(u) {
    var s = stripControl(u).trim();
    if (!s) return '';
    if (/^(https?:|mailto:)/i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$|\?|#)/i.test(s)) return 'https://' + s;
    return '';
  }

  // H1–H6 ARE ALL KEPT. The Athenaeum renames H1 to H2 and H5/H6
  // to H4, because a pasted book has one title and the page is not
  // it. Here the reference's own toolbar offers all six, so a
  // heading the toolbar can make is a heading the sanitiser has to
  // keep — otherwise pressing H1 works until the next save.
  var SAN_KEEP = {
    P: 1, BR: 1, DIV: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    STRONG: 1, EM: 1, U: 1, S: 1,
    UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, CODE: 1, PRE: 1, A: 1, IMG: 1, HR: 1,
    FIGURE: 1, FIGCAPTION: 1, SUP: 1, SUB: 1, SMALL: 1
  };
  var SAN_DROP = {
    SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, BASE: 1,
    NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, MATH: 1, FORM: 1, INPUT: 1, BUTTON: 1,
    SELECT: 1, TEXTAREA: 1, OPTION: 1, AUDIO: 1, VIDEO: 1, SOURCE: 1, TRACK: 1,
    CANVAS: 1, FRAME: 1, FRAMESET: 1, APPLET: 1
  };
  var SAN_RENAME = { B: 'STRONG', I: 'EM', STRIKE: 'S', DEL: 'S', MARK: 'STRONG' };
  var SAN_ATTR = { A: ['href', 'title'], IMG: ['src', 'alt'] };

  // ALIGNMENT IS THE ONE STYLE THAT SURVIVES. execCommand's four
  // align buttons have no other output — strip every `style` the
  // way the Athenaeum does and half the reference's toolbar
  // silently stops working one save later. The attribute is
  // REBUILT from this list, never echoed from the input, so
  // nothing arbitrary can ride in on it.
  var ALIGN = { left: 1, center: 1, right: 1, justify: 1, start: 1, end: 1 };
  var ALIGNABLE = {
    P: 1, DIV: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    LI: 1, BLOCKQUOTE: 1, FIGCAPTION: 1, PRE: 1
  };
  var SAN_MAX_NODES = 12000, SAN_MAX_DEPTH = 14;

  function sanitizeHtml(html) {
    var raw = String(html == null ? '' : html);
    if (!raw) return '';
    var doc;
    try { doc = new DOMParser().parseFromString('<!doctype html><body>' + raw, 'text/html'); }
    catch (e) { return '<p>' + esc(raw) + '</p>'; }
    var body = doc.body;
    if (!body) return '';

    // Past the cap, keep the words and throw away the structure.
    if (body.getElementsByTagName('*').length > SAN_MAX_NODES) {
      return '<p>' + esc(body.textContent || '').slice(0, 200000) + '</p>';
    }

    function alignOf(el) {
      var s = el.getAttribute('style') || '';
      var m = s.match(/text-align\s*:\s*([a-z]+)/i);
      var v = m ? m[1].toLowerCase() : String(el.getAttribute('align') || '').toLowerCase();
      return ALIGN[v] ? v : '';
    }
    function scrubAttrs(el, tag) {
      var keep = ALIGNABLE[tag] ? alignOf(el) : '';
      var allow = SAN_ATTR[tag] || [];
      // Backwards: removeAttribute mutates the live NamedNodeMap.
      // This one pass is what kills every on*, class, srcset and
      // formaction — and the style we are about to rewrite.
      for (var i = el.attributes.length - 1; i >= 0; i--) {
        var name = el.attributes[i].name;
        if (allow.indexOf(name.toLowerCase()) < 0) el.removeAttribute(name);
      }
      if (keep) el.setAttribute('style', 'text-align:' + keep);
      if (tag === 'A') {
        var href = safeUrl(el.getAttribute('href'));
        if (href) {
          el.setAttribute('href', href);
          // A link inside an archive of your own is still a link
          // OUT. It opens in its own tab and carries no referrer
          // worth the name.
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        } else el.removeAttribute('href');
      }
      if (tag === 'IMG') {
        var src = safeUrl(el.getAttribute('src'), { allowDataImage: true });
        if (src) el.setAttribute('src', src); else el.removeAttribute('src');
      }
    }
    function rename(el, tag) {
      var n = doc.createElement(tag);
      var st = el.getAttribute('style');
      if (st) n.setAttribute('style', st);       // carried so the align survives the rename
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
    function walk(node, depth) {
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;
        if (child.nodeType === 8) {                      // comment
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
              // A SPAN or FONT carrying an alignment is the one
              // unlisted wrapper worth keeping, and it keeps it by
              // becoming a DIV.
              var al = alignOf(child);
              walk(child, depth + 1);
              if (al) { child = rename(child, 'DIV'); scrubAttrs(child, 'DIV'); }
              else unwrap(child);
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

    walk(body, 0);
    return body.innerHTML.replace(/(<p>\s*<\/p>|<li>\s*<\/li>)/gi, '').trim();
  }

  // Plain text out of rich HTML — the excerpt, the search, the
  // reading time, and deciding whether an editor is visually empty.
  function htmlToText(html) {
    try {
      // textContent runs blocks together: "<p>a</p><p>b</p>" reads
      // as "ab" and merges words across paragraphs in every
      // preview. Give the boundaries a space before parsing.
      var spaced = String(html || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote|pre|figcaption|tr|td)>/gi, ' ');
      var d = new DOMParser().parseFromString('<!doctype html><body>' + spaced, 'text/html');
      return (d.body && d.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) { return ''; }
  }

  // The row clamps to two lines, so this only has to be long enough to
  // fill them — but it must not end mid-word. A cut at exactly 260
  // characters reads as a rendering fault rather than as a summary.
  function excerptOf(text, n) {
    var s = String(text || '').trim();
    if (s.length <= n) return s;
    var cut = s.slice(0, n);
    var sp = cut.lastIndexOf(' ');
    return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.!?-]+$/, '') + '…';
  }

  function readingMinutes(html) {
    var words = htmlToText(html).split(/\s+/).filter(Boolean).length;
    return words ? Math.max(1, Math.round(words / 220)) : 0;
  }

  function firstImage(html) {
    var m = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }

  // Canvas downscale — the same helper every other page in this
  // app carries, for the same reason: a pasted screenshot at full
  // size inside a synced key is what makes a row too big to push.
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1400; quality = quality == null ? 0.82 : quality;
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
          try { resolve(c.toDataURL('image/jpeg', quality)); } catch (e) { resolve(dataUrl); }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) { resolve(dataUrl); }
    });
  }

  // =============================================================
  // §STORE
  // =============================================================
  function index() {
    var a = get(IDX, []);
    return Array.isArray(a) ? a : [];
  }
  function writeIndex(arr) { return put(IDX, arr); }

  function list(gameId) {
    return index()
      .filter(function (a) { return a.gameId === gameId; })
      .sort(function (x, y) { return (y.updatedAt || 0) - (x.updatedAt || 0); });
  }
  function one(id) {
    return index().filter(function (a) { return a.id === id; })[0] || null;
  }
  function body(id) {
    var b = get(BODY + id, null);
    return (b && typeof b.bodyHtml === 'string') ? b.bodyHtml : '';
  }

  function create(gameId, fields) {
    fields = fields || {};
    var a = {
      id: uid(), gameId: gameId,
      title: fields.title || '', tag: fields.tag || '',
      author: fields.author || AUTHOR, cover: '', excerpt: '',
      size: 'md', minutes: 0,
      createdAt: fields.createdAt || Date.now(),
      updatedAt: fields.updatedAt || Date.now()
    };
    var all = index();
    all.push(a);
    writeIndex(all);
    put(BODY + a.id, { bodyHtml: '' });
    if (fields.bodyHtml) saveBody(a.id, fields.bodyHtml);
    return one(a.id) || a;
  }

  function patch(id, fields, quiet) {
    var all = index();
    var i = all.findIndex(function (a) { return a.id === id; });
    if (i < 0) return null;
    all[i] = Object.assign({}, all[i], fields);
    // `quiet` is for a migration backfill, which must not pretend
    // every converted note was written today — the feed sorts and
    // dates on updatedAt.
    if (!quiet) all[i].updatedAt = Date.now();
    writeIndex(all);
    return all[i];
  }

  // The body is written; the index entry's DERIVED fields are
  // recomputed from it. Excerpt and thumbnail are never typed —
  // the reference shows both on every row, and a field you have to
  // remember to fill is a field that stays empty.
  function saveBody(id, html) {
    var clean = sanitizeHtml(html);
    put(BODY + id, { bodyHtml: clean });
    var text = htmlToText(clean);
    patch(id, {
      excerpt: excerptOf(text, 260),
      minutes: readingMinutes(clean),
      cover: firstImage(clean)
    });
    return clean;
  }

  // An article is TWO keys, so removing one has to remove both. A
  // body left behind is invisible, syncs forever, and is the one
  // leak this shape can produce.
  function remove(id) {
    writeIndex(index().filter(function (a) { return a.id !== id; }));
    try { localStorage.removeItem(BODY + id); } catch (e) {}
    if (global.AthDraft) { try { AthDraft.clear('rich:' + BODY + id); } catch (e) {} }
  }
  // And deleting a GAME has to take its articles with it, for the
  // same reason.
  function removeForGame(gameId) {
    index().filter(function (a) { return a.gameId === gameId; })
      .forEach(function (a) { remove(a.id); });
  }

  // =============================================================
  // §TIME
  // =============================================================
  // The reference's by-line reads "5 mins ago", which is a
  // different thing from a date: it says how fresh, not when. Past
  // a week that stops being useful and it becomes a date.
  function timeAgo(ts) {
    if (!ts) return '';
    var s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 45) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + (m === 1 ? ' min ago' : ' mins ago');
    var h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(h / 24);
    if (d < 8) return d + (d === 1 ? ' day ago' : ' days ago');
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // =============================================================
  // §THE FEED — what the game page shows below the video rail
  // =============================================================
  // Reference-1 anatomy, House materials. The reference is a black
  // banner on a white page; here the page is already black, so the
  // banner separates by a lifted panel and a gold hairline rather
  // than by a value cliff. Square corners throughout: nothing else
  // in this design is rounded but a play button.

  // No avatars exist in this app and a stock face would be a lie
  // about who wrote this. An initial on a gold hairline says the
  // same thing and belongs to the house.
  function avatar(name) {
    var ch = String(name || AUTHOR).trim().charAt(0).toUpperCase() || 'D';
    return '<span class="hd-feed__av" aria-hidden="true">' + esc(ch) + '</span>';
  }

  // The same ladder card() uses: what the article shows, then what
  // the game shows, then the shelf's own mark. A row with a hole
  // where the picture goes is worse than a row with a sigil in it.
  function thumb(a, d) {
    var src = a.cover || (d && (d.hero || d.cover)) || '';
    if (src) {
      return '<span class="hd-feed__art">' +
        '<img src="' + attr(src) + '" alt="" loading="lazy" decoding="async">' +
        '<span class="hd-feed__tint" aria-hidden="true"></span></span>';
    }
    return '<span class="hd-feed__art hd-feed__art--none" aria-hidden="true">' +
      H().sig('sg-pad', 22) + '</span>';
  }

  function feedRow(a, d, i) {
    var mins = a.minutes ? a.minutes + ' min read' : '';
    return '<article class="hd-feed__row ' + U().rvlClass() + '"' + U().rvlStyle(Math.min(i, 8)) + '>' +
      '<button type="button" class="hd-feed__hit" data-act="open-article" data-aid="' + attr(a.id) + '">' +
        '<span class="hd-feed__say">' +
          '<span class="hd-eyebrow">' + esc(a.tag || 'Article') + '</span>' +
          '<span class="hd-feed__t">' + esc(a.title || 'Untitled') + '</span>' +
          '<span class="hd-feed__x">' +
            esc(a.excerpt || 'Nothing written in this one yet.') + '</span>' +
          '<span class="hd-feed__by">' + avatar(a.author) +
            '<span class="hd-feed__who">By ' + esc(a.author || AUTHOR) + '</span>' +
            '<i>' + esc(timeAgo(a.updatedAt)) + '</i>' +
            // Classed, not just positioned: on a phone the row drops
            // this one, and `:last-child` would drop the timestamp
            // instead on any article with no reading time yet.
            (mins ? '<i class="hd-feed__read">' + esc(mins) + '</i>' : '') +
          '</span>' +
        '</span>' +
        thumb(a, d) +
      '</button>' +
    '</article>';
  }

  function banner(d, gameId) {
    return '<div class="hd-feed__banner">' +
      '<span class="hd-feed__grain" aria-hidden="true"></span>' +
      '<div class="hd-feed__banner-say">' +
        '<h2 class="hd-feed__hl">Everything written here<br>about ' +
          esc((d && d.title) || 'this game') + '</h2>' +
      '</div>' +
      '<button type="button" class="hd-feed__cta" data-act="new-article" data-game="' +
        attr(gameId) + '">New article</button>' +
    '</div>';
  }

  function feed(gameId) {
    var r = H().recordOf('games', gameId);
    var d = r ? H().toCard(r, 'games', 'games') : null;
    var items = list(gameId);
    return '<section class="hd-feed" aria-label="Articles">' +
      banner(d, gameId) +
      (items.length
        ? '<div class="hd-feed__list">' +
            items.map(function (a, i) { return feedRow(a, d, i); }).join('') +
          '</div>'
        : '<div class="hd-feed__none">' +
            '<p>Nothing written about this one yet.</p>' +
            '<p class="hd-feed__none-sub">A guide, a run, the lore you keep looking up — ' +
            'an article has room for all of it, and the formatting to hold it.</p>' +
          '</div>') +
    '</section>';
  }

  // =============================================================
  // §THE TOOLBAR
  // =============================================================
  // The reference's own glyph set, in the reference's own order:
  //
  //   B I U Aa | align x4 | H H1..H6 | S | lists and indents
  //
  // plus the group Damian asked for and the reference has no room
  // for — link, image, quote, code, rule, clear.
  //
  // THE FOUR ALIGN BUTTONS ARE WHY THE SANITISER KEEPS ONE STYLE.
  // execCommand has no other way to say it, and a button whose
  // only output is stripped on save is a button that works until
  // you come back.

  function alignIcon(kind) {
    var w = {
      left:    [14, 9, 14, 7],
      center:  [14, 9, 14, 9],
      right:   [14, 9, 14, 7],
      justify: [14, 14, 14, 14]
    }[kind];
    var y = [3.5, 7, 10.5, 14], out = '';
    for (var i = 0; i < 4; i++) {
      var ww = w[i];
      var x = kind === 'right' ? (15 - ww) : kind === 'center' ? (16 - ww) / 2 : 1;
      out += '<path d="M' + x.toFixed(1) + ' ' + y[i] + 'h' + ww + '"></path>';
    }
    return '<svg width="15" height="15" viewBox="0 0 16 17.5" fill="none" stroke="currentColor" ' +
      'stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' + out + '</svg>';
  }

  function listIcon(ordered) {
    var y = [4, 8.5, 13], out = '';
    for (var i = 0; i < 3; i++) {
      out += ordered
        ? '<path d="M1.4 ' + (y[i] - 1.6) + 'h1.6v3.2"></path>'
        : '<circle cx="2.2" cy="' + y[i] + '" r="1.1" fill="currentColor" stroke="none"></circle>';
      out += '<path d="M6 ' + y[i] + 'h8.6"></path>';
    }
    return '<svg width="15" height="15" viewBox="0 0 16 17" fill="none" stroke="currentColor" ' +
      'stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' + out + '</svg>';
  }

  function indentIcon(out) {
    var arrow = out
      ? '<path d="M6.4 6.2 3.6 8.6l2.8 2.4"></path>'
      : '<path d="M3.6 6.2 6.4 8.6l-2.8 2.4"></path>';
    return '<svg width="15" height="15" viewBox="0 0 16 17" fill="none" stroke="currentColor" ' +
      'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M1.4 3.4h13.2M8.6 6.9h6M8.6 10.3h6M1.4 13.8h13.2"></path>' + arrow + '</svg>';
  }

  var LINK_ICON =
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M6.6 9.4a2.9 2.9 0 0 0 4.3.3l2.1-2.1a2.9 2.9 0 0 0-4.1-4.1l-1.2 1.2"></path>' +
    '<path d="M9.4 6.6a2.9 2.9 0 0 0-4.3-.3L3 8.4a2.9 2.9 0 0 0 4.1 4.1l1.2-1.2"></path></svg>';
  var IMG_ICON =
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.3" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="1.5" y="3" width="13" height="10"></rect>' +
    '<path d="m1.5 10.6 3.4-3.1 2.8 2.5 2.6-2.3 3.2 2.9"></path>' +
    '<circle cx="5.5" cy="6.1" r="1" fill="currentColor" stroke="none"></circle></svg>';
  var RULE_ICON =
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M1.4 8h13.2M3.6 4.2h8.8M3.6 11.8h8.8" opacity=".45"></path>' +
    '<path d="M1.4 8h13.2"></path></svg>';

  function tbtn(o) {
    return '<button type="button" class="hd-tb__b' + (o.cls ? ' ' + o.cls : '') + '"' +
      ' data-act="' + (o.act || 'fmt') + '"' +
      (o.cmd ? ' data-cmd="' + attr(o.cmd) + '"' : '') +
      (o.val ? ' data-val="' + attr(o.val) + '"' : '') +
      ' title="' + attr(o.label) + '" aria-label="' + attr(o.label) + '">' + o.glyph + '</button>';
  }
  function tsep() { return '<span class="hd-tb__sep" aria-hidden="true"></span>'; }

  function heads() {
    var out = tbtn({ cmd: 'formatBlock', val: 'p', label: 'Normal text', glyph: 'H', cls: 'hd-tb__b--h' });
    for (var n = 1; n <= 6; n++) {
      out += tbtn({
        cmd: 'formatBlock', val: 'h' + n, label: 'Heading ' + n, cls: 'hd-tb__b--h',
        glyph: 'H<sub>' + n + '</sub>'
      });
    }
    return out;
  }

  function toolbar() {
    return '<div class="hd-tb" id="hdArtTools" role="toolbar" aria-label="Formatting">' +
      '<div class="hd-tb__in">' +
        tbtn({ cmd: 'bold', label: 'Bold', glyph: '<b>B</b>' }) +
        tbtn({ cmd: 'italic', label: 'Italic', glyph: '<i>I</i>' }) +
        tbtn({ cmd: 'underline', label: 'Underline', glyph: '<u>U</u>' }) +
        tbtn({ act: 'art-size', label: 'Text size', glyph: 'Aa', cls: 'hd-tb__b--aa' }) +
        tsep() +
        tbtn({ cmd: 'justifyLeft', label: 'Align left', glyph: alignIcon('left') }) +
        tbtn({ cmd: 'justifyCenter', label: 'Align centre', glyph: alignIcon('center') }) +
        tbtn({ cmd: 'justifyRight', label: 'Align right', glyph: alignIcon('right') }) +
        tbtn({ cmd: 'justifyFull', label: 'Justify', glyph: alignIcon('justify') }) +
        tsep() +
        heads() +
        tsep() +
        tbtn({ cmd: 'strikeThrough', label: 'Strikethrough', glyph: '<s>S</s>' }) +
        tbtn({ cmd: 'insertUnorderedList', label: 'Bulleted list', glyph: listIcon(false) }) +
        tbtn({ cmd: 'insertOrderedList', label: 'Numbered list', glyph: listIcon(true) }) +
        tbtn({ cmd: 'outdent', label: 'Outdent', glyph: indentIcon(true) }) +
        tbtn({ cmd: 'indent', label: 'Indent', glyph: indentIcon(false) }) +
        tsep() +
        tbtn({ act: 'art-link', label: 'Add a link', glyph: LINK_ICON }) +
        tbtn({ act: 'art-image', label: 'Add an image', glyph: IMG_ICON }) +
        tbtn({ cmd: 'formatBlock', val: 'blockquote', label: 'Quote', glyph: '&#8220;', cls: 'hd-tb__b--q' }) +
        tbtn({ cmd: 'formatBlock', val: 'pre', label: 'Code', glyph: '&lt;/&gt;', cls: 'hd-tb__b--code' }) +
        tbtn({ cmd: 'insertHorizontalRule', label: 'Divider', glyph: RULE_ICON }) +
        tbtn({ cmd: 'removeFormat', label: 'Clear formatting', glyph: 'T<sub>x</sub>', cls: 'hd-tb__b--h' }) +
      '</div>' +
    '</div>';
  }

  // =============================================================
  // §THE ARTICLE PAGE
  // =============================================================
  // THE ONE VIEW IN THIS STUDIO WITH NO HERO. Every other route
  // opens on the same full-viewport photograph; the reference for
  // this page opens on the toolbar, and it is right — a hero above
  // a writing surface is a screen of scrolling before the first
  // word. Two consequences, both handled in the stylesheet and in
  // vault-app.js rather than here:
  //   · .hd-main is pulled up 90px under the sticky bar, so .hd-art
  //     puts the offset back or the toolbar starts underneath it.
  //   · the bar is transparent until you scroll, because elsewhere
  //     it floats on a picture. Here it must be opaque at rest.
  var SIZES = ['sm', 'md', 'lg'];
  var SIZE_NAME = { sm: 'Small', md: 'Regular', lg: 'Large' };

  function longDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function view(id) {
    var a = one(id);
    if (!a) {
      return '<section class="hd-band hd-night hd-archive"><header class="hd-head"><div class="hd-head__l">' +
        '<h1 class="hd-title">Not here</h1>' + H().orn('hd-orn--left') +
        '<p class="hd-sub">That article is no longer in the archive.</p>' +
        '<a class="hd-link" href="#/archive/games">' + H().arrow('Back to Games') + '</a>' +
        '</div></header></section>';
    }
    var g = H().recordOf('games', a.gameId);
    var back = g ? (g.title || 'the game') : 'Games';
    var html = body(a.id);
    var emptyBody = !htmlToText(html);

    return '<article class="hd-art hd-night" data-art="' + attr(a.id) + '" data-size="' +
      attr(SIZES.indexOf(a.size) >= 0 ? a.size : 'md') + '">' +
      toolbar() +
      '<div class="hd-art__page">' +
        '<div class="hd-art__top">' +
          '<a class="hd-link hd-link--quiet" href="' +
            (g ? '#/game/' + attr(a.gameId) : '#/archive/games') + '">' +
            '<span aria-hidden="true">&#8592;</span> ' + esc(back) + '</a>' +
          '<span class="hd-art__state" id="hdArtState" role="status" aria-live="polite"></span>' +
        '</div>' +

        '<h1 class="hd-art__title' + (a.title ? '' : ' is-empty') + '" id="hdArtTitle"' +
          ' contenteditable="true" spellcheck="true" role="textbox" aria-label="Title"' +
          ' data-rich="title" data-ph="Untitled">' + esc(a.title) + '</h1>' +

        '<div class="hd-art__meta">' +
          '<button type="button" class="hd-art__tag' + (a.tag ? '' : ' is-none') + '" data-act="art-meta">' +
            esc(a.tag || 'Add a tag') + '</button>' +
          '<span class="hd-art__dot" aria-hidden="true"></span>' +
          '<span>By ' + esc(a.author || AUTHOR) + '</span>' +
          '<span class="hd-art__dot" aria-hidden="true"></span>' +
          '<span id="hdArtMins">' + (a.minutes ? a.minutes + ' min read' : 'A new article') + '</span>' +
          '<span class="hd-art__dot" aria-hidden="true"></span>' +
          '<span>' + esc(longDate(a.createdAt)) + '</span>' +
        '</div>' +

        '<div class="hd-art__body' + (emptyBody ? ' is-empty' : '') + '" id="hdArtBody"' +
          ' contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true"' +
          ' aria-label="Article" data-rich="body"' +
          ' data-ph="Start writing. Paste anything — headings, lists, links and pictures all survive.">' +
          html + '</div>' +

        '<div class="hd-art__foot">' +
          '<button type="button" class="hd-link hd-link--quiet" data-act="new-article" data-game="' +
            attr(a.gameId) + '">' + H().arrow('Write another') + '</button>' +
          '<button type="button" class="hd-link hd-link--quiet hd-art__del" data-act="art-del">' +
            'Delete this article</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  // =============================================================
  // §THE EDITOR
  // =============================================================
  // Two tiers, because the urgent part and the expensive part are
  // not the same part:
  //
  //   URGENT, every keystroke — the raw innerHTML to AthDraft,
  //     which writes to the REAL localStorage through a hidden
  //     iframe. local-store-idb.js's writes are NOT durable at
  //     unload, so without this a refresh takes whatever was typed
  //     since the last commit.
  //   EXPENSIVE, debounced 700ms — the sanitised commit, plus the
  //     excerpt, the thumbnail and the reading time re-derived.
  //
  // The editable's own DOM is NEVER rewritten by a commit. It is
  // what the caret lives in.
  var ed = { id: '', timer: 0, composing: false, pending: false, range: null };
  // Set the moment the page starts going away. Nothing commits after
  // this: see the clearing rule in commit().
  var unloading = false;

  function bodyEl() { return $('hdArtBody'); }
  function titleEl() { return $('hdArtTitle'); }

  function markEmpty(el) {
    if (!el) return;
    var text = el.getAttribute('data-rich') === 'title'
      ? (el.textContent || '').trim()
      : htmlToText(el.innerHTML);
    el.classList.toggle('is-empty', !text && !el.querySelector('img, hr'));
  }
  function say(text) {
    var n = $('hdArtState');
    if (n) n.textContent = text || '';
  }

  function commit(force) {
    if (!ed.id || unloading) return;
    if (ed.composing && !force) return;
    var b = bodyEl(), t = titleEl();
    if (!b) return;
    clearTimeout(ed.timer);
    ed.pending = false;

    var raw = b.innerHTML;
    var clean = sanitizeHtml(raw);
    put(BODY + ed.id, { bodyHtml: clean });
    var text = htmlToText(clean);
    var fields = {
      excerpt: excerptOf(text, 260),
      minutes: readingMinutes(clean),
      cover: firstImage(clean)
    };
    if (t) fields.title = (t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    patch(ed.id, fields);

    // ── THE CLEARING RULE ────────────────────────────────────
    // The draft is the DURABLE copy and this commit is not: it goes
    // through local-store-idb.js, whose writes are asynchronous and
    // do not survive an unload. Clearing the draft the moment the
    // commit is *issued* is what loses a paragraph — the durable
    // copy is thrown away and the replacement never lands.
    //
    // So the draft is cleared only once LocalStoreIDB reports the
    // write actually flushed, and only if nothing newer has been
    // typed in the meantime. At an unload that promise never
    // resolves, and the draft is still there on the way back in.
    if (global.AthDraft) {
      var key = 'rich:' + BODY + ed.id;
      (global.LocalStoreIDB ? global.LocalStoreIDB.ready() : Promise.resolve()).then(function () {
        try {
          var d = AthDraft.get(key);
          if (d && d.fields && d.fields.__rich0 === raw) AthDraft.clear(key);
        } catch (e) {}
      });
    }
    var mins = $('hdArtMins');
    if (mins) mins.textContent = fields.minutes ? fields.minutes + ' min read' : 'A new article';
    say('Saved');
  }

  function schedule() {
    if (!ed.id) return;
    var b = bodyEl();
    if (!b) return;
    if (global.AthDraft) {
      try {
        AthDraft.put('rich:' + BODY + ed.id, {
          __rich0: b.innerHTML,
          __title: titleEl() ? (titleEl().textContent || '') : ''
        });
      } catch (e) {}
    }
    ed.pending = true;
    say('Saving');
    clearTimeout(ed.timer);
    ed.timer = setTimeout(function () { commit(); }, 700);
  }

  // Anything half-typed must be written down before the page can
  // be rebuilt, or a repaint eats it. vault-app.js calls this at
  // the top of repaint().
  function commitPending() {
    if (!ed.id || !ed.pending) return;
    commit(true);
  }

  // A draft only wins if it actually DIFFERS from what was
  // committed — otherwise every article you reopen announces a
  // rescue that did not happen.
  function restoreDraft() {
    if (!global.AthDraft || !ed.id) return;
    var d;
    try { d = AthDraft.get('rich:' + BODY + ed.id); } catch (e) { return; }
    if (!d || !d.fields || typeof d.fields.__rich0 !== 'string') return;
    var b = bodyEl();
    if (!b) return;
    if (d.fields.__rich0 === b.innerHTML) { try { AthDraft.clear('rich:' + BODY + ed.id); } catch (e) {} return; }
    b.innerHTML = d.fields.__rich0;
    if (typeof d.fields.__title === 'string' && titleEl()) titleEl().textContent = d.fields.__title;
    markEmpty(b); markEmpty(titleEl());
    commit(true);          // the draft and the truth stop disagreeing at once
    U().toast('Recovered what you were writing');
  }

  // ── the selection ──────────────────────────────────────────
  // A dialog steals focus and the browser throws the selection
  // away with it. Everything that opens one saves the Range first
  // and puts it back before it writes.
  function saveRange() {
    try {
      var s = global.getSelection();
      if (!s || !s.rangeCount) return;
      var r = s.getRangeAt(0);
      var b = bodyEl();
      if (b && b.contains(r.commonAncestorContainer)) ed.range = r.cloneRange();
    } catch (e) {}
  }
  function restoreRange() {
    var b = bodyEl();
    if (!b) return false;
    try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); }
    if (!ed.range) return false;
    try {
      var s = global.getSelection();
      s.removeAllRanges();
      s.addRange(ed.range);
      return true;
    } catch (e) { return false; }
  }
  // Focus must be INSIDE the body before execCommand can do
  // anything at all. A toolbar pressed before the page has been
  // clicked into would otherwise silently no-op.
  function ensureCaret() {
    var b = bodyEl();
    if (!b) return false;
    var a = document.activeElement;
    if (a === b || b.contains(a)) return true;
    if (restoreRange()) return true;
    try {
      var r = document.createRange();
      r.selectNodeContents(b);
      r.collapse(false);
      var s = global.getSelection();
      s.removeAllRanges(); s.addRange(r);
    } catch (e) {}
    return true;
  }

  function insertRich(html) {
    try { if (document.execCommand('insertHTML', false, html)) return true; } catch (e) {}
    try {
      var sel = global.getSelection();
      if (!sel || !sel.rangeCount) return false;
      var r = sel.getRangeAt(0);
      r.deleteContents();
      var tpl = document.createElement('div');
      tpl.innerHTML = html;
      var frag = document.createDocumentFragment(), node;
      while ((node = tpl.firstChild)) frag.appendChild(node);
      r.insertNode(frag);
      sel.collapseToEnd();
      return true;
    } catch (e) { return false; }
  }

  function paraHtml(text) {
    return String(text || '').split(/\n{2,}/).filter(function (p) { return p.trim(); })
      .map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }

  // ── paste and drop ─────────────────────────────────────────
  function handlePaste(el, e) {
    var dt = e.clipboardData || e.dataTransfer;
    if (!dt) return;
    e.preventDefault();                 // always — the browser never inserts raw markup

    var isTitle = el.getAttribute('data-rich') === 'title';
    var text = dt.getData ? dt.getData('text/plain') : '';

    // A title is one line of plain text whatever was on the
    // clipboard. Pasting a styled headline into it would otherwise
    // put markup somewhere that is stored as a string.
    if (isTitle) {
      if (!text) return;
      try { document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim()); } catch (e2) {}
      markEmpty(el); schedule();
      return;
    }

    // 1. Images first: a screenshot paste carries both an image and
    //    often a junk text/html wrapper that would win otherwise.
    if (dt.items) {
      for (var i = 0; i < dt.items.length; i++) {
        var it = dt.items[i];
        if (it.kind === 'file' && it.type && it.type.indexOf('image/') === 0) {
          var file = it.getAsFile();
          if (!file) continue;
          readImageFile(el, file);
          return;
        }
      }
    }
    if (dt.files && dt.files.length && dt.files[0].type.indexOf('image/') === 0) {
      readImageFile(el, dt.files[0]);
      return;
    }

    // 2. Real markup. This is the branch that keeps a pasted
    //    guide's headings, lists, links and emphasis.
    var html = dt.getData ? dt.getData('text/html') : '';
    if (html) { insertRich(sanitizeHtml(html)); markEmpty(el); schedule(); return; }

    // 3. Plain text — blank lines become paragraphs.
    if (!text) return;
    insertRich(paraHtml(text) || esc(text));
    markEmpty(el); schedule();
  }

  // A full-size screenshot inside a synced key is what makes a row
  // too big to push, so it is compressed on the way in and then
  // handed to your own storage bucket; the ~100-byte URL replaces
  // the base64 as soon as the upload confirms. Offline, the data
  // URL simply stays and nothing breaks.
  function readImageFile(el, file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      compressImageDataUrl(String(ev.target.result), 1400, 0.82).then(function (small) {
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
        insertRich('<img src="' + attr(small) + '" alt="Pasted image">');
        markEmpty(el);
        commit(true);
        if (global.PhotoStore && PhotoStore.upload) {
          PhotoStore.upload(small, function (url) {
            if (!url) return;                       // no bucket / offline — keep the data URL
            var b = bodyEl();
            if (b) { b.innerHTML = b.innerHTML.split(small).join(url); commit(true); }
          });
        }
      });
    };
    reader.readAsDataURL(file);
  }

  // ── the toolbar's own state ────────────────────────────────
  // A formatting bar that does not light up is a bar you have to
  // remember the state of.
  function syncTools() {
    var host = $('hdArtTools');
    if (!host) return;
    var block = '';
    try { block = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (e) {}
    host.querySelectorAll('[data-cmd]').forEach(function (b) {
      var cmd = b.dataset.cmd, on = false;
      if (cmd === 'formatBlock') {
        var v = String(b.dataset.val || '').toLowerCase();
        on = v === 'p' ? (!block || block === 'p' || block === 'div') : block === v;
      } else {
        try { on = document.queryCommandState(cmd); } catch (e2) { on = false; }
      }
      b.classList.toggle('is-on', !!on);
      b.setAttribute('aria-pressed', String(!!on));
    });
  }

  // Called by vault-app.js AFTER innerHTML has been replaced. The
  // view is a string; this is everything the string cannot do.
  function afterPaint(st) {
    if (!st) return;
    // The one-time conversion of a game's old columns and journal.
    // It runs HERE rather than inside the view, because a view is a
    // string builder and a string builder must not write to
    // storage. It repaints once, and only ever once per game.
    if (st.route === 'game' && st.gameId) {
      var r = H().recordOf('games', st.gameId);
      if (r && !r.articlesMigrated) {
        var made = migrateGame(r);
        if (made) {
          U().toast(made === 1
            ? 'Your note became an article'
            : 'Your ' + made + ' notes became articles');
          App().repaint();
          return;
        }
      }
    }
    if (st.route !== 'article') { ed.id = ''; ed.pending = false; return; }
    var a = one(st.articleId);
    ed.id = a ? a.id : '';
    ed.range = null;
    ed.pending = false;
    if (!ed.id) return;
    // Tags, not inline styles: a `style` is stripped on save, so
    // without this bold would work until you came back.
    try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    markEmpty(bodyEl()); markEmpty(titleEl());
    restoreDraft();
    syncTools();
    // A brand-new article opens with the cursor in the title,
    // because that is the only thing you can do with an empty one.
    if (!a.title && !htmlToText(body(a.id))) {
      var t = titleEl();
      if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
    }
  }

  // ONE binding pass, at boot, delegated on #vtRoot — so a repaint
  // never has to re-bind anything. focus and blur do not bubble;
  // they are caught in the capture phase instead.
  function bind() {
    var root = $('vtRoot');
    if (!root) return;
    var richOf = function (e) {
      var n = e.target.closest ? e.target.closest('[data-rich]') : null;
      return n && root.contains(n) ? n : null;
    };

    root.addEventListener('input', function (e) {
      var el = richOf(e);
      if (!el) return;
      markEmpty(el);
      schedule();
    });
    root.addEventListener('paste', function (e) {
      var el = richOf(e);
      if (el) handlePaste(el, e);
    });
    root.addEventListener('drop', function (e) {
      var el = richOf(e);
      if (el) handlePaste(el, e);
    });
    root.addEventListener('blur', function (e) {
      var el = richOf(e);
      if (!el) return;
      markEmpty(el);
      commit(true);
    }, true);
    root.addEventListener('compositionstart', function (e) {
      if (richOf(e)) ed.composing = true;
    });
    root.addEventListener('compositionend', function (e) {
      if (!richOf(e)) return;
      ed.composing = false;
      commit(true);
    });
    root.addEventListener('keydown', function (e) {
      var el = richOf(e);
      if (!el) return;
      // The title is one line. Enter moves into the article
      // instead of growing a second one.
      if (el.getAttribute('data-rich') === 'title' && e.key === 'Enter') {
        e.preventDefault();
        var b = bodyEl();
        if (b) { try { b.focus({ preventScroll: true }); } catch (e2) { b.focus(); } }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        var k = e.key.toLowerCase();
        if (k === 's') { e.preventDefault(); commit(true); }
      }
    });

    // THE ONE LINE WITHOUT WHICH NO BUTTON WORKS. mousedown on a
    // toolbar button blurs the editable and collapses the
    // selection before the click ever fires, so every command
    // arrives with nothing to act on.
    root.addEventListener('mousedown', function (e) {
      if (e.target.closest && e.target.closest('.hd-tb')) e.preventDefault();
    });

    document.addEventListener('selectionchange', function () {
      if (!ed.id) return;
      saveRange();
      syncTools();
    });
    // A phone that switches app, and a laptop lid. Neither fires
    // anything else reliable.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') commitPending();
    });
    // AND NOTHING COMMITS ON THE WAY OUT. A commit at unload cannot
    // land — the shim's write is asynchronous — and issuing one is
    // strictly worse than not, because of what it would clear. The
    // keystroke draft has already written every character to the
    // real localStorage; that is the copy that survives.
    var out = function () { unloading = true; };
    addEventListener('pagehide', out);
    addEventListener('beforeunload', out);
  }

  // =============================================================
  // §ACTS — merged into vault-app.js's one delegated map
  // =============================================================
  function gameHere(el) {
    if (el && el.dataset && el.dataset.game) return el.dataset.game;
    var st = App().state;
    if (st.route === 'article') { var a = one(st.articleId); return a ? a.gameId : ''; }
    return st.gameId || '';
  }

  var ACTS = {
    // The button the whole section hangs off. It makes a blank
    // article and goes straight to it — there is no dialog,
    // because everything a dialog would ask for is a thing the
    // page itself asks for better.
    'new-article': function (el) {
      var gid = gameHere(el);
      if (!gid) return U().toast('Open a game first');
      var a = create(gid, {});
      location.hash = '#/article/' + encodeURIComponent(a.id);
    },
    'open-article': function (el) {
      var id = el.dataset.aid;
      if (id) location.hash = '#/article/' + encodeURIComponent(id);
    },

    fmt: function (el) {
      if (!ensureCaret()) return;
      var cmd = el.dataset.cmd, val = el.dataset.val || null;
      // formatBlock wants a tag name, and Safari has always wanted
      // it in angle brackets.
      if (cmd === 'formatBlock' && val) val = '<' + val + '>';
      try { document.execCommand(cmd, false, val); } catch (e) {}
      markEmpty(bodyEl());
      syncTools();
      schedule();
    },

    // The reference's "Aa" is one button, not a dropdown, so it
    // cycles. It is a property of the ARTICLE rather than of a
    // selection: execCommand('fontSize') emits <font>, which the
    // sanitiser strips, and a per-word size on a page set in
    // Cormorant is not a thing worth having anyway.
    'art-size': function () {
      if (!ed.id) return;
      var a = one(ed.id);
      if (!a) return;
      var next = SIZES[(SIZES.indexOf(a.size) + 1 + SIZES.length) % SIZES.length] || 'md';
      patch(ed.id, { size: next });
      var host = document.querySelector('.hd-art');
      if (host) host.setAttribute('data-size', next);
      U().toast(SIZE_NAME[next] + ' text');
    },

    'art-link': function () {
      if (!ed.id) return;
      saveRange();
      var sel = '';
      try { sel = String(global.getSelection() || ''); } catch (e) {}
      App().form({
        title: sel ? 'Link this' : 'Add a link',
        fields: [
          { key: 'url', label: 'Address', type: 'url', value: '', placeholder: 'https://' },
          { key: 'text', label: 'Words', value: sel,
            hint: sel ? 'Leave this as it is to keep what you selected.' : 'What the link should read as.' }
        ],
        onSave: function (v) {
          var href = typedUrl(v.url);
          if (!href) { U().toast('That does not look like an address'); return false; }
          var words = String(v.text || '').trim();
          restoreRange();
          if (sel && (!words || words === sel)) {
            try { document.execCommand('createLink', false, href); } catch (e) {}
          } else {
            insertRich('<a href="' + attr(href) + '" target="_blank" rel="noopener noreferrer">' +
              esc(words || href) + '</a>');
          }
          markEmpty(bodyEl());
          commit(true);
        }
      });
    },

    'art-image': function () {
      if (!ed.id) return;
      saveRange();
      App().form({
        title: 'Add an image',
        fields: [
          { key: 'url', label: 'Image address', type: 'url', value: '', placeholder: 'https://' },
          { key: 'alt', label: 'Description', value: '', placeholder: 'What is in it (optional)' }
        ],
        onSave: function (v) {
          var src = typedUrl(v.url);
          if (!src) { U().toast('That does not look like an image address'); return false; }
          restoreRange();
          insertRich('<img src="' + attr(src) + '" alt="' + attr(v.alt || '') + '">');
          markEmpty(bodyEl());
          commit(true);
        }
      });
    },

    'art-meta': function () {
      if (!ed.id) return;
      var a = one(ed.id);
      if (!a) return;
      App().form({
        title: 'This article',
        fields: [
          { key: 'tag', label: 'Tag', value: a.tag || '',
            hint: 'What kind of thing this is. Guide, Lore, Build, Run, Review — your words.' },
          { key: 'author', label: 'By', value: a.author || AUTHOR }
        ],
        onSave: function (v) {
          patch(ed.id, { tag: v.tag.trim(), author: v.author.trim() || AUTHOR });
        }
      });
    },

    'art-del': function () {
      if (!ed.id) return;
      var a = one(ed.id);
      if (!a) return;
      if (!confirm('Delete ' + (a.title ? '"' + a.title + '"' : 'this article') +
        '?\n\nThis cannot be undone.')) return;
      var gid = a.gameId;
      clearTimeout(ed.timer);
      ed.pending = false;
      remove(ed.id);
      ed.id = '';
      U().toast('Deleted');
      location.hash = gid ? '#/game/' + encodeURIComponent(gid) : '#/archive/games';
    }
  };

  // =============================================================
  // §MIGRATE — the four columns, converted rather than stranded
  // =============================================================
  // The columns and the journal were the page's whole lower half
  // until 2026-09-04. They hold real writing, so removing the
  // interface without moving the words would be a silent deletion
  // with extra steps.
  //
  // Runs ONCE per game, the first time its page is opened, guarded
  // by a flag on the record — so it can neither run twice nor
  // resurrect an article that was deliberately deleted. The
  // original `columns`, `entries` and `notes` fields are LEFT IN
  // STORAGE untouched: nothing here is destructive, and the export
  // still carries them.
  function dateStamp(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return 0;
    var p = String(iso).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getTime();
  }

  function migrateGame(r) {
    if (!r || r.articlesMigrated) return 0;
    var made = 0;
    var stamp = function (id, when) {
      if (when) patch(id, { createdAt: when, updatedAt: when }, true);
    };

    (Array.isArray(r.entries) ? r.entries : []).forEach(function (e) {
      if (!e) return;
      var when = dateStamp(e.date) || e.at || r.updatedAt || Date.now();
      var a = create(r.id, {
        title: e.title || 'Untitled', tag: 'Journal',
        bodyHtml: paraHtml(e.body || '')
      });
      stamp(a.id, when);
      made++;
    });

    var cols = Array.isArray(r.columns) ? r.columns : [];
    cols.forEach(function (c) {
      if (!c) return;
      var es = (Array.isArray(c.entries) ? c.entries : [])
        .filter(function (x) { return x && String(x.text || '').trim(); });
      if (!es.length) return;
      var when = es[es.length - 1].at || r.updatedAt || Date.now();
      var a = create(r.id, {
        title: c.title || 'Notes', tag: 'Notes',
        // An attribution is a line under the words it belongs to,
        // which is what it always looked like in the column.
        bodyHtml: es.map(function (x) {
          return paraHtml(x.text) + (x.source ? '<p><em>&#8212; ' + esc(x.source) + '</em></p>' : '');
        }).join('')
      });
      stamp(a.id, when);
      made++;
    });

    // A record that never had a column still had `notes`, which is
    // what the first column used to be computed FROM.
    if (!cols.length && String(r.notes || '').trim()) {
      var n = create(r.id, {
        title: 'Personal notes', tag: 'Notes', bodyHtml: paraHtml(r.notes)
      });
      stamp(n.id, r.updatedAt || Date.now());
      made++;
    }

    global.Vault.update('games', r.id, { articlesMigrated: true });
    return made;
  }

  global.HDArticle = {
    index: index, list: list, one: one, body: body,
    create: create, patch: patch, saveBody: saveBody, remove: remove,
    removeForGame: removeForGame,
    sanitizeHtml: sanitizeHtml, htmlToText: htmlToText, safeUrl: safeUrl,
    typedUrl: typedUrl, readingMinutes: readingMinutes, firstImage: firstImage,
    compressImageDataUrl: compressImageDataUrl, paraHtml: paraHtml,
    timeAgo: timeAgo,
    feed: feed, view: view, toolbar: toolbar,
    bind: bind, afterPaint: afterPaint, commitPending: commitPending,
    migrateGame: migrateGame,
    ACTS: ACTS,
    AUTHOR: AUTHOR, IDX: IDX, BODY: BODY, SIZES: SIZES
  };
})(window);
