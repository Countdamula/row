// =============================================================
// resource-rich.js — the sanitiser and the writing surfaces.
//
// Ported from vault-article.js, which took it from
// athenaeum-data.js, which took it from promptarium-data.js.
// Per-file duplication is this repo's house pattern rather than
// an oversight — a shared module is one more file every page has
// to load in exactly the right order.
//
// TWO PROPERTIES CARRY THE WHOLE THING, AND NEITHER IS OPTIONAL:
//
//   1. It parses with DOMParser, never `div.innerHTML`. A
//      DOMParser document has no browsing context, so an
//      `<img onerror=…>` in pasted markup cannot fire while it is
//      being read. Using a live element to "clean" hostile HTML
//      executes it on the way in.
//   2. It runs on EVERY write. No path — the toolbar, a paste, a
//      drop, an IME, a future feature — can get a dirty value
//      into storage.
//
// WHAT THIS FILE ADDS OVER THE VAULT'S VERSION, and only this:
//
//   · TABLES ARE KEPT. A pasted article has tables and unwrapping
//     one destroys the content rather than simplifying it.
//   · EMBEDS SURVIVE AS A REFERENCE, NOT AS MARKUP. <iframe>,
//     <video> and <source> stay on the DROP list for ever — they
//     are the two tags a stored string must never be able to
//     reintroduce. Instead, extractEmbeds() runs BEFORE the
//     sanitiser, lifts their URLs into res:assets records, and
//     leaves a <figure data-rs-embed="<id>"> standing where they
//     were. `data-rs-embed` is the one attribute this sanitiser
//     writes itself and the only one it allows, so renderBody()
//     can hydrate those figures into click-to-load cards.
//
// The result: everything that came with an article is stored and
// shown — the images inline, the links live, the videos as cards,
// and all of it listed again in the Attachments strip — the way
// Obsidian keeps an embed rather than the way a feed reader
// flattens one.
// =============================================================

(function (global) {
  'use strict';

  function U() { return global.AscUI; }
  function D() { return global.Resource; }
  function esc(s) { return U().esc(s); }
  function attr(s) { return U().attr(s); }

  // ═══ §URLS ═════════════════════════════════════════════════

  function stripControl(s) {
    return String(s == null ? '' : s).replace(CTRL, '');
  }
  // Built rather than written as a literal: a control-character
  // class typed into a source file is a class that a heredoc, an
  // editor or a copy-paste can silently flatten, and a
  // wrong-but-valid character class produces no error at any point.
  var CTRL = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) +
    String.fromCharCode(127) + ']', 'g');

  function safeUrl(u, opts) {
    var s = stripControl(u).trim();
    if (!s) return '';
    var low = s.toLowerCase();
    if (low.indexOf('http://') === 0 || low.indexOf('https://') === 0 ||
      low.indexOf('mailto:') === 0) return s;
    if (opts && opts.allowDataImage &&
      /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) return s;
    return '';
  }
  function typedUrl(u) {
    var s = stripControl(u).trim();
    if (!s) return '';
    if (/^(https?:|mailto:)/i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$|\?|#)/i.test(s)) return 'https://' + s;
    return '';
  }

  // ═══ §SANITISE ═════════════════════════════════════════════

  var SAN_KEEP = {
    P: 1, BR: 1, DIV: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    STRONG: 1, EM: 1, U: 1, S: 1,
    UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, CODE: 1, PRE: 1, A: 1, IMG: 1, HR: 1,
    FIGURE: 1, FIGCAPTION: 1, SUP: 1, SUB: 1, SMALL: 1,
    // Kept here and not in the vault: a pasted paper is mostly
    // table, and unwrapping one turns a grid of numbers into a
    // single run-on paragraph.
    TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TD: 1, TH: 1, CAPTION: 1
  };
  var SAN_DROP = {
    SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, BASE: 1,
    NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, MATH: 1, FORM: 1, INPUT: 1, BUTTON: 1,
    SELECT: 1, TEXTAREA: 1, OPTION: 1, AUDIO: 1, VIDEO: 1, SOURCE: 1, TRACK: 1,
    CANVAS: 1, FRAME: 1, FRAMESET: 1, APPLET: 1
  };
  var SAN_RENAME = { B: 'STRONG', I: 'EM', STRIKE: 'S', DEL: 'S', MARK: 'STRONG' };
  var SAN_ATTR = {
    A: ['href', 'title'],
    IMG: ['src', 'alt'],
    // The one attribute this file writes itself. Nothing arbitrary
    // rides in on it: extractEmbeds() is the only writer and it
    // only ever writes an id it just minted.
    FIGURE: ['data-rs-embed'],
    TD: ['colspan', 'rowspan'],
    TH: ['colspan', 'rowspan', 'scope']
  };
  var ALIGN = { left: 1, center: 1, right: 1, justify: 1, start: 1, end: 1 };
  var ALIGNABLE = {
    P: 1, DIV: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    LI: 1, BLOCKQUOTE: 1, FIGCAPTION: 1, PRE: 1, TD: 1, TH: 1, CAPTION: 1
  };
  var SAN_MAX_NODES = 12000, SAN_MAX_DEPTH = 16;

  function sanitizeHtml(html) {
    var raw = String(html == null ? '' : html);
    if (!raw) return '';
    var doc;
    try { doc = new DOMParser().parseFromString('<!doctype html><body>' + raw, 'text/html'); }
    catch (e) { return '<p>' + esc(raw) + '</p>'; }
    var body = doc.body;
    if (!body) return '';

    // Past the cap, keep the words and throw away the structure.
    // A 40,000-node paste is a page of chrome around an article,
    // not an article.
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
      // This one pass kills every on*, class, srcset and formaction
      // — and the style we are about to rewrite.
      for (var i = el.attributes.length - 1; i >= 0; i--) {
        var name = el.attributes[i].name;
        if (allow.indexOf(name.toLowerCase()) < 0) el.removeAttribute(name);
      }
      if (keep) el.setAttribute('style', 'text-align:' + keep);
      if (tag === 'A') {
        var href = safeUrl(el.getAttribute('href'));
        if (href) {
          el.setAttribute('href', href);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        } else el.removeAttribute('href');
      }
      if (tag === 'IMG') {
        var src = safeUrl(el.getAttribute('src'), { allowDataImage: true });
        if (src) el.setAttribute('src', src); else el.removeAttribute('src');
      }
      if (tag === 'FIGURE') {
        // An id, or nothing. Anything that is not one of ours is
        // simply not an embed.
        var ref = String(el.getAttribute('data-rs-embed') || '');
        if (!/^as_[a-z0-9_]+$/i.test(ref)) el.removeAttribute('data-rs-embed');
      }
    }
    function rename(el, tag) {
      var n = doc.createElement(tag);
      var st = el.getAttribute('style');
      if (st) n.setAttribute('style', st);   // carried so the align survives the rename
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
        if (child.nodeType === 8) {
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

  // ═══ §READING THE RESULT ═══════════════════════════════════

  function htmlToText(html) {
    try {
      // textContent runs blocks together: "<p>a</p><p>b</p>" reads
      // as "ab" and merges words across paragraphs in every
      // preview. Give the boundaries a space before parsing.
      var spaced = String(html || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote|pre|figcaption|tr|td|th|table)>/gi, ' ');
      var d = new DOMParser().parseFromString('<!doctype html><body>' + spaced, 'text/html');
      return (d.body && d.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) { return ''; }
  }

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
  function wordCount(html) {
    return htmlToText(html).split(/\s+/).filter(Boolean).length;
  }
  function firstImage(html) {
    var m = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }
  function isEmptyHtml(html) {
    return !htmlToText(html) && !firstImage(html) && String(html || '').indexOf('data-rs-embed') < 0;
  }

  function paraHtml(text) {
    return String(text || '').split(/\n{2,}/).filter(function (p) { return p.trim(); })
      .map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }

  // ═══ §IMAGES ═══════════════════════════════════════════════
  // A pasted screenshot at full size inside a synced key is what
  // makes a row too big to push, so it is compressed on the way in
  // and then handed to Damian's own bucket; the ~100-byte URL
  // replaces the base64 as soon as the upload confirms. Offline,
  // the data URL simply stays and nothing breaks.

  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1400;
    quality = quality == null ? 0.82 : quality;
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

  // Read a File, compress it, upload it, and hand back the best
  // URL available at each stage. `onLocal` fires immediately with
  // the data URL so nothing is ever in an unsaved state; `onFinal`
  // fires again only if the bucket answered.
  function ingestImageFile(file, onLocal, onFinal) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      compressImageDataUrl(String(ev.target.result), 1400, 0.82).then(function (small) {
        if (onLocal) onLocal(small);
        if (global.PhotoStore && PhotoStore.upload) {
          PhotoStore.upload(small, function (url) {
            if (url && onFinal) onFinal(url, small);
          });
        }
      });
    };
    reader.readAsDataURL(file);
  }

  // ═══ §EMBEDS ═══════════════════════════════════════════════
  // Runs on the RAW paste, before the sanitiser, and is the reason
  // a pasted article keeps its videos. Everything it lifts becomes
  // an asset record; everything it leaves behind is a figure the
  // sanitiser is willing to keep.

  function embedSrcOf(el) {
    var tag = el.tagName.toUpperCase();
    if (tag === 'IFRAME') return safeUrl(el.getAttribute('src'));
    if (tag === 'VIDEO') {
      var direct = safeUrl(el.getAttribute('src'));
      if (direct) return direct;
      var s = el.querySelector('source[src]');
      return s ? safeUrl(s.getAttribute('src')) : '';
    }
    return '';
  }

  function extractEmbeds(rawHtml, itemType, itemId) {
    var raw = String(rawHtml == null ? '' : rawHtml);
    if (!raw || raw.indexOf('<') < 0) return raw;
    if (!/<(iframe|video)\b/i.test(raw)) return raw;
    var doc;
    try { doc = new DOMParser().parseFromString('<!doctype html><body>' + raw, 'text/html'); }
    catch (e) { return raw; }
    var body = doc.body;
    if (!body) return raw;

    var nodes = [].slice.call(body.querySelectorAll('iframe, video'));
    nodes.forEach(function (el) {
      var url = embedSrcOf(el);
      var fig = doc.createElement('figure');
      if (url) {
        var rec = D().Assets.add({
          itemType: itemType, itemId: itemId, kind: 'video', url: url,
          title: String(el.getAttribute('title') || '').slice(0, 200)
        });
        fig.setAttribute('data-rs-embed', rec.id);
      }
      // A frame with no readable source leaves an empty figure
      // rather than a hole: the sanitiser drops it a moment later,
      // and the paragraph flow is not re-flowed around a gap.
      if (el.parentNode) el.parentNode.replaceChild(fig, el);
    });
    return body.innerHTML;
  }

  // Every image and every outbound link in a stored body, recorded
  // as assets so the Attachments strip can list what came with the
  // piece. Idempotent by URL — a re-save must not double the list.
  function syncAssetsFromBody(html, itemType, itemId) {
    var doc;
    try { doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html || ''), 'text/html'); }
    catch (e) { return; }
    var body = doc.body;
    if (!body) return;

    var existing = {};
    D().assetsFor(itemType, itemId).forEach(function (a) { existing[a.kind + '|' + a.url] = a; });
    var seen = {};

    [].slice.call(body.querySelectorAll('img[src]')).forEach(function (img) {
      var url = img.getAttribute('src');
      // A data URL is the moment before an upload confirms, not an
      // attachment. Recording one would put a whole image in the
      // index as well as the body.
      if (!url || url.indexOf('data:') === 0) return;
      var k = 'image|' + url;
      seen[k] = 1;
      if (!existing[k]) {
        D().Assets.add({
          itemType: itemType, itemId: itemId, kind: 'image', url: url,
          caption: String(img.getAttribute('alt') || '')
        });
      }
    });
    [].slice.call(body.querySelectorAll('a[href]')).forEach(function (a) {
      var url = a.getAttribute('href');
      if (!url) return;
      var k = 'link|' + url;
      seen[k] = 1;
      if (!existing[k]) {
        D().Assets.add({
          itemType: itemType, itemId: itemId, kind: 'link', url: url,
          title: (a.textContent || '').trim().slice(0, 160)
        });
      }
    });
    // Anything that was an image or a link and no longer appears
    // in the body has been deleted from it. Embeds are NOT swept:
    // a figure is deleted by hand and its record goes with it, but
    // a re-save that happens to run mid-edit must not orphan one.
    Object.keys(existing).forEach(function (k) {
      if (seen[k]) return;
      var kind = k.split('|')[0];
      if (kind === 'image' || kind === 'link') D().Assets.remove(existing[k].id);
    });
  }

  // ── rendering a stored body ────────────────────────────────
  // The figures become cards. Nothing else is touched: the body
  // was sanitised on the way in, so this is a hydration pass and
  // not a second cleaning.
  function renderBody(html, opts) {
    var raw = String(html == null ? '' : html);
    if (!raw) return '';
    if (raw.indexOf('data-rs-embed') < 0) return raw;
    var doc;
    try { doc = new DOMParser().parseFromString('<!doctype html><body>' + raw, 'text/html'); }
    catch (e) { return raw; }
    var body = doc.body;
    if (!body) return raw;

    [].slice.call(body.querySelectorAll('figure[data-rs-embed]')).forEach(function (fig) {
      var rec = D().assetById(fig.getAttribute('data-rs-embed'));
      var holder = doc.createElement('div');
      holder.innerHTML = rec ? embedCard(rec, opts) : '';
      var node = holder.firstChild;
      if (node && fig.parentNode) fig.parentNode.replaceChild(node, fig);
      else if (fig.parentNode) fig.parentNode.removeChild(fig);
    });
    return body.innerHTML;
  }

  // A card, never an iframe. The page loads nothing from anyone
  // else's server until it is asked to — which is the same rule
  // the video page's own player follows.
  function embedCard(rec) {
    var vid = D().youtubeId(rec.url);
    var thumb = vid ? D().youtubeThumb(vid) : '';
    var host = D().siteName(rec.url) || 'Embedded';
    return '<div class="rs-embed"' + (vid ? ' data-yt="' + attr(vid) + '"' : '') + '>' +
      '<button type="button" class="rs-embed__hit" data-act="embed-play"' +
        ' data-id="' + attr(rec.id) + '"' + (vid ? ' data-yt="' + attr(vid) + '"' : '') +
        ' data-url="' + attr(rec.url) + '">' +
        (thumb
          ? '<img class="rs-embed__img" src="' + attr(thumb) + '" alt="" loading="lazy" decoding="async">'
          : '<span class="rs-embed__none"></span>') +
        '<span class="rs-embed__play" aria-hidden="true">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 5.6 18 12l-9.5 6.4z"/></svg>' +
        '</span>' +
        '<span class="rs-embed__cap">' + esc(rec.title || ('Video on ' + host)) + '</span>' +
      '</button>' +
    '</div>';
  }

  // ═══ §SPLITTING A TRANSCRIPT INTO CHAPTERS ═════════════════
  // The bulk flow behind a book's Transcript tab: paste the whole
  // thing once, get a chapter per heading. Ported in spirit from
  // athenaeum-resource.html's paste-a-whole-book flow.
  //
  // Headings first, because a pasted ebook has them. Failing that,
  // lines that LOOK like chapter openings. Failing that, one
  // chapter — which is a correct answer, not a failure.

  var CHAPTER_LINE = /^(chapter|part|book|section|lesson|act)\b[\s.:—-]*([\dixvlc]+|[a-z]+)?\b.{0,80}$/i;

  function splitIntoChapters(html) {
    var clean = sanitizeHtml(html);
    if (!clean) return [];
    var doc;
    try { doc = new DOMParser().parseFromString('<!doctype html><body>' + clean, 'text/html'); }
    catch (e) { return [{ title: 'Transcript', html: clean }]; }
    var body = doc.body;
    if (!body) return [];

    var nodes = [].slice.call(body.childNodes);
    var out = [], cur = null;

    function open(title) {
      cur = { title: String(title || '').trim().slice(0, 160) || ('Chapter ' + (out.length + 1)), parts: [] };
      out.push(cur);
    }
    function serialize(node) {
      if (node.nodeType === 3) {
        var t = String(node.textContent || '').trim();
        return t ? '<p>' + esc(t) + '</p>' : '';
      }
      return node.nodeType === 1 ? node.outerHTML : '';
    }

    nodes.forEach(function (node) {
      var isHeading = node.nodeType === 1 && /^H[1-4]$/.test(node.tagName);
      var text = String(node.textContent || '').trim();
      var looksLikeChapter = !isHeading && node.nodeType === 1 &&
        /^(P|DIV)$/.test(node.tagName) && text.length <= 90 && CHAPTER_LINE.test(text);
      if ((isHeading || looksLikeChapter) && text) { open(text); return; }
      if (!cur) open('');
      var s = serialize(node);
      if (s) cur.parts.push(s);
    });

    return out
      .map(function (c) { return { title: c.title, html: c.parts.join('') }; })
      .filter(function (c) { return c.html.trim() || c.title; });
  }

  // ── a video transcript, organized ──────────────────────────
  // "0:00 Intro" / "[12:04] The turn" / "12:04 - the turn". One
  // timestamp per line opens a section; everything under it is
  // that section's text.
  var STAMP = /^\s*[\[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?\s*[-–—.:]?\s*(.*)$/;

  function organizeTranscript(text) {
    var lines = String(text || '').split(/\r?\n/);
    var out = [], cur = null;
    lines.forEach(function (line) {
      var m = line.match(STAMP);
      if (m && (m[2].trim() || !cur)) {
        cur = { t: m[1], title: m[2].trim(), text: '' };
        out.push(cur);
        return;
      }
      if (!line.trim()) return;
      if (!cur) { cur = { t: '', title: '', text: '' }; out.push(cur); }
      cur.text += (cur.text ? '\n' : '') + line.trim();
    });
    return out;
  }
  // A timestamp back into seconds, so a click can seek the player.
  function stampSeconds(t) {
    var p = String(t || '').split(':').map(Number);
    if (p.some(function (n) { return !isFinite(n); })) return 0;
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return p[0] || 0;
  }

  // ═══ §THE WRITING SURFACES ═════════════════════════════════
  // Any element carrying data-rich="<slot>:<type>:<id>" is an
  // editor. One delegated set of listeners on the view root, bound
  // once at boot, so a repaint never has to re-bind a
  // contenteditable — and the caret is never taken by a re-bind.

  var ed = {
    root: null,
    active: null,       // the focused editor element
    pending: {},        // scope -> true
    timers: {},
    range: null,
    onSaved: null
  };

  function scopeOf(el) { return String(el && el.getAttribute('data-rich') || ''); }
  function partsOf(scope) {
    var p = scope.split(':');
    return p.length === 3 ? { slot: p[0], type: p[1], id: p[2] } : null;
  }
  function draftKey(scope) { return 'rich:rtx:' + scope; }

  function markEmpty(el) {
    if (!el) return;
    var text = (el.textContent || '').trim();
    var rich = el.innerHTML.indexOf('<img') >= 0 || el.innerHTML.indexOf('data-rs-embed') >= 0;
    el.classList.toggle('is-empty', !text && !rich);
  }

  function commitScope(scope, immediate) {
    var el = ed.root && ed.root.querySelector('[data-rich="' + scope + '"]');
    if (!el) return;
    var p = partsOf(scope);
    if (!p) return;
    clearTimeout(ed.timers[scope]);
    var raw = el.innerHTML;
    var withEmbeds = extractEmbeds(raw, p.type, p.id);
    var clean = sanitizeHtml(withEmbeds);
    D().setText(p.slot, p.type, p.id, clean);
    if (p.slot === 'body') syncAssetsFromBody(clean, p.type, p.id);
    ed.pending[scope] = false;
    if (global.AthDraft) { try { AthDraft.clear(draftKey(scope)); } catch (e) {} }
    if (typeof ed.onSaved === 'function') ed.onSaved(p, clean, !!immediate);
  }

  // Per keystroke: the draft, in the REAL localStorage, so a
  // refresh cannot take unsaved writing with it. The expensive
  // pass — sanitise, extract, store, re-derive — is debounced.
  function schedule(el) {
    var scope = scopeOf(el);
    if (!scope) return;
    if (global.AthDraft) {
      try { AthDraft.put(draftKey(scope), { __rich0: el.innerHTML }); } catch (e) {}
    }
    ed.pending[scope] = true;
    clearTimeout(ed.timers[scope]);
    ed.timers[scope] = setTimeout(function () { commitScope(scope); }, 700);
  }

  // Anything half-typed is written down BEFORE the DOM it lives in
  // is thrown away. resource-app.js calls this at the top of
  // repaint(); nothing else on the page can lose work to one.
  function commitPending() {
    Object.keys(ed.pending).forEach(function (scope) {
      if (ed.pending[scope]) commitScope(scope, true);
    });
  }

  function restoreDrafts() {
    if (!global.AthDraft || !ed.root) return;
    [].slice.call(ed.root.querySelectorAll('[data-rich]')).forEach(function (el) {
      var scope = scopeOf(el);
      var d;
      try { d = AthDraft.get(draftKey(scope)); } catch (e) { return; }
      if (!d || !d.fields || typeof d.fields.__rich0 !== 'string') return;
      // A draft only wins if it actually DIFFERS from what was
      // committed — otherwise every panel you open announces a
      // rescue that did not happen.
      if (d.fields.__rich0 === el.innerHTML) {
        try { AthDraft.clear(draftKey(scope)); } catch (e2) {}
        return;
      }
      el.innerHTML = d.fields.__rich0;
      markEmpty(el);
      commitScope(scope, true);
      U().toast('Recovered what you were writing');
    });
  }

  // ── the toolbar ────────────────────────────────────────────
  function saveRange() {
    try {
      var s = global.getSelection();
      if (s && s.rangeCount && ed.active && ed.active.contains(s.anchorNode)) {
        ed.range = s.getRangeAt(0).cloneRange();
      }
    } catch (e) {}
  }
  function restoreRange() {
    if (!ed.range) return false;
    try {
      var s = global.getSelection();
      s.removeAllRanges();
      s.addRange(ed.range);
      return true;
    } catch (e) { return false; }
  }
  // Focus must be INSIDE the editor before execCommand can do
  // anything at all. A toolbar pressed before the surface has been
  // clicked into would otherwise silently no-op.
  function ensureCaret() {
    if (!ed.active) return false;
    var a = document.activeElement;
    if (a === ed.active || ed.active.contains(a)) return true;
    if (restoreRange()) return true;
    try {
      var r = document.createRange();
      r.selectNodeContents(ed.active);
      r.collapse(false);
      var s = global.getSelection();
      s.removeAllRanges(); s.addRange(r);
      ed.active.focus({ preventScroll: true });
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

  function runCommand(cmd, val) {
    if (!ensureCaret()) return;
    if (cmd === 'link') {
      var typed = global.prompt('Link to');
      var href = safeUrl(typedUrl(typed || ''));
      if (!href) return;
      restoreRange();
      var sel = global.getSelection();
      var collapsed = !sel || !sel.rangeCount || sel.getRangeAt(0).collapsed;
      if (collapsed) {
        insertRich('<a href="' + attr(href) + '" target="_blank" rel="noopener noreferrer">' +
          esc(href) + '</a>');
      } else {
        try { document.execCommand('createLink', false, href); } catch (e) {}
      }
    } else if (cmd === 'image') {
      var src = safeUrl(typedUrl(global.prompt('Image URL') || ''));
      if (!src) return;
      restoreRange();
      insertRich('<img src="' + attr(src) + '" alt="">');
    } else {
      try { document.execCommand(cmd, false, val); } catch (e) {}
    }
    if (ed.active) { markEmpty(ed.active); schedule(ed.active); }
    syncTools();
  }

  function syncTools() {
    if (!ed.root) return;
    var block = '';
    try { block = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (e) {}
    [].slice.call(ed.root.querySelectorAll('[data-cmd]')).forEach(function (b) {
      var cmd = b.getAttribute('data-cmd'), on = false;
      if (cmd === 'formatBlock') {
        var v = String(b.getAttribute('data-val') || '').toLowerCase();
        on = v === 'p' ? (!block || block === 'p' || block === 'div') : block === v;
      } else if (cmd !== 'link' && cmd !== 'image') {
        try { on = document.queryCommandState(cmd); } catch (e2) { on = false; }
      }
      b.classList.toggle('is-on', !!on);
      b.setAttribute('aria-pressed', String(!!on));
    });
  }

  function toolbarHtml(scope) {
    function b(cmd, label, cls, val, aria) {
      return '<button type="button" class="rs-tb__b' + (cls ? ' ' + cls : '') +
        '" data-act="rich-cmd" data-cmd="' + attr(cmd) + '"' +
        (val ? ' data-val="' + attr(val) + '"' : '') +
        ' data-scope="' + attr(scope) + '" aria-pressed="false" title="' + attr(aria || label) +
        '" aria-label="' + attr(aria || label) + '">' + label + '</button>';
    }
    var sep = '<span class="rs-tb__sep" aria-hidden="true"></span>';
    return '<div class="rs-tb" role="toolbar" aria-label="Formatting">' +
      b('bold', '<b>B</b>', '', '', 'Bold') +
      b('italic', '<i>I</i>', '', '', 'Italic') +
      b('underline', '<u>U</u>', '', '', 'Underline') +
      b('strikeThrough', '<s>S</s>', '', '', 'Strikethrough') + sep +
      b('formatBlock', 'H<sub>2</sub>', 'rs-tb__b--h', 'h2', 'Heading') +
      b('formatBlock', 'H<sub>3</sub>', 'rs-tb__b--h', 'h3', 'Subheading') +
      b('formatBlock', '¶', 'rs-tb__b--h', 'p', 'Paragraph') + sep +
      b('insertUnorderedList', '•', '', '', 'Bulleted list') +
      b('insertOrderedList', '1.', 'rs-tb__b--num', '', 'Numbered list') +
      b('formatBlock', '“', 'rs-tb__b--q', 'blockquote', 'Quote') +
      b('formatBlock', '&lt;/&gt;', 'rs-tb__b--code', 'pre', 'Code block') + sep +
      b('link', '⚭', '', '', 'Add a link') +
      b('image', '▣', '', '', 'Add an image') +
      b('removeFormat', '✕', '', '', 'Clear formatting') +
    '</div>';
  }

  // ── paste and drop ─────────────────────────────────────────
  function handlePaste(el, e) {
    var dt = e.clipboardData || e.dataTransfer;
    if (!dt) return;
    e.preventDefault();                 // always — the browser never inserts raw markup

    var text = dt.getData ? dt.getData('text/plain') : '';

    // 1. Images first: a screenshot paste carries both an image
    //    and often a junk text/html wrapper that would win.
    var file = null;
    if (dt.items) {
      for (var i = 0; i < dt.items.length; i++) {
        var it = dt.items[i];
        if (it.kind === 'file' && it.type && it.type.indexOf('image/') === 0) {
          file = it.getAsFile();
          if (file) break;
        }
      }
    }
    if (!file && dt.files && dt.files.length && dt.files[0].type.indexOf('image/') === 0) {
      file = dt.files[0];
    }
    if (file) { pasteImage(el, file); return; }

    // 2. Real markup — the branch that keeps a pasted article's
    //    headings, lists, links, tables and emphasis.
    var html = dt.getData ? dt.getData('text/html') : '';
    if (html) {
      var p = partsOf(scopeOf(el));
      var lifted = p ? extractEmbeds(html, p.type, p.id) : html;
      insertRich(sanitizeHtml(lifted));
      markEmpty(el); schedule(el);
      return;
    }

    // 3. Plain text — blank lines become paragraphs.
    if (!text) return;
    insertRich(paraHtml(text) || esc(text));
    markEmpty(el); schedule(el);
  }

  function pasteImage(el, file) {
    ingestImageFile(file, function (small) {
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      insertRich('<img src="' + attr(small) + '" alt="Pasted image">');
      markEmpty(el);
      commitScope(scopeOf(el), true);
    }, function (url, small) {
      // The ~100-byte URL replaces the base64 in place. Nothing
      // else about the document changes.
      if (el.innerHTML.indexOf(small) < 0) return;
      el.innerHTML = el.innerHTML.split(small).join(url);
      commitScope(scopeOf(el), true);
    });
  }

  // ── binding ────────────────────────────────────────────────
  function bind(root, opts) {
    ed.root = root;
    ed.onSaved = opts && opts.onSaved;
    if (!root || root.dataset.richBound === '1') return;
    root.dataset.richBound = '1';

    // Paragraphs, not divs, and no inline <font> tags. Both are
    // document-wide switches and both have to be set before the
    // first command runs.
    try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}

    root.addEventListener('focusin', function (e) {
      var el = e.target.closest && e.target.closest('[data-rich]');
      if (!el) return;
      ed.active = el;
      syncTools();
    });
    root.addEventListener('input', function (e) {
      var el = e.target.closest && e.target.closest('[data-rich]');
      if (!el) return;
      markEmpty(el);
      schedule(el);
    });
    root.addEventListener('keyup', function (e) {
      if (!e.target.closest || !e.target.closest('[data-rich]')) return;
      saveRange(); syncTools();
    });
    root.addEventListener('mouseup', function (e) {
      if (!e.target.closest || !e.target.closest('[data-rich]')) return;
      saveRange(); syncTools();
    });
    root.addEventListener('paste', function (e) {
      var el = e.target.closest && e.target.closest('[data-rich]');
      if (!el) return;
      handlePaste(el, e);
    });
    root.addEventListener('drop', function (e) {
      var el = e.target.closest && e.target.closest('[data-rich]');
      if (!el) return;
      handlePaste(el, e);
    });
    // A toolbar button must not steal the caret from the surface
    // it is about to format.
    root.addEventListener('mousedown', function (e) {
      if (e.target.closest && e.target.closest('[data-act="rich-cmd"]')) e.preventDefault();
    });

    // The phone path. visibilitychange is the only unload signal
    // iOS gives reliably, and the IDB shim commits asynchronously,
    // so anything half-typed is written here rather than at
    // pagehide.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') commitPending();
    });
    addEventListener('pagehide', commitPending);
  }

  // Called by resource-app.js AFTER innerHTML has been replaced.
  // The view is a string; this is everything the string cannot do.
  function afterPaint() {
    if (!ed.root) return;
    ed.active = null;
    ed.range = null;
    [].slice.call(ed.root.querySelectorAll('[data-rich]')).forEach(markEmpty);
    restoreDrafts();
    syncTools();
  }

  global.ResRich = {
    sanitizeHtml: sanitizeHtml, htmlToText: htmlToText,
    excerptOf: excerptOf, readingMinutes: readingMinutes, wordCount: wordCount,
    firstImage: firstImage, isEmptyHtml: isEmptyHtml, paraHtml: paraHtml,
    safeUrl: safeUrl, typedUrl: typedUrl,
    compressImageDataUrl: compressImageDataUrl, ingestImageFile: ingestImageFile,
    extractEmbeds: extractEmbeds, syncAssetsFromBody: syncAssetsFromBody,
    renderBody: renderBody, embedCard: embedCard,
    splitIntoChapters: splitIntoChapters,
    organizeTranscript: organizeTranscript, stampSeconds: stampSeconds,
    toolbarHtml: toolbarHtml, runCommand: runCommand, syncTools: syncTools,
    bind: bind, afterPaint: afterPaint, commitPending: commitPending,
    commitScope: commitScope
  };
})(window);
