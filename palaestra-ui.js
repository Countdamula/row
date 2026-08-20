// =============================================================
// palaestra-ui.js — shared UI primitives for The Palaestra.
//
// Both palaestra.html and palaestra-workout.html need the same three
// things, so they live here once instead of twice:
//
//   PalUI.sheet     one modal sheet host, opened with HTML + actions
//   PalUI.toast     one transient confirmation line
//   PalUI.media     the photo/video picker used by exercises, body
//                   measurements, session notes and progress photos
//
// THE MEDIA RULE, which is the reason this file exists at all:
// an image is compressed with Pal.compressImageDataUrl() and shown
// immediately, then handed to PhotoStore.upload(); a VIDEO is never
// turned into base64 at all — it goes straight up as a Blob and is
// shown from an object URL until the hosted URL comes back. Until
// then the record holds { sessionOnly: true }, which every model in
// palaestra-data.js strips on write. A base64 video in a `pal:` key
// would push megabytes into the Supabase row on every save.
//
// Separate image and video file inputs, never one accept="image/*,
// video/*" — a combined accept behaves unpredictably across browsers,
// as dreamboard.html already documents.
// =============================================================

(function (global) {
  'use strict';

  var P = global.Pal;
  function esc(s) { return P.escapeHtml(s); }
  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------
  // TOAST
  // ------------------------------------------------------------
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'pal-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  // ------------------------------------------------------------
  // SHEET
  //
  // open({ title, body, actions, onMount, onClose, wide })
  // actions: [{ label, kind, act }] — `act` comes back to onAction.
  // The sheet closes on backdrop click and on Escape, and returns
  // focus to whatever opened it.
  // ------------------------------------------------------------
  var bg = null, body = null, opener = null, current = null;

  function ensureSheet() {
    if (bg) return;
    bg = document.createElement('div');
    bg.className = 'pal-sheetbg';
    bg.id = 'palSheetBg';
    bg.innerHTML = '<div class="pal-sheet" id="palSheet" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(bg);
    body = $('palSheet');

    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeSheet(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bg.classList.contains('is-open')) closeSheet();
    });
    body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-sheet-act]');
      if (!btn || !current) return;
      var act = btn.getAttribute('data-sheet-act');
      if (act === 'cancel') { closeSheet(); return; }
      if (typeof current.onAction === 'function') current.onAction(act, body);
    });
  }

  function openSheet(cfg) {
    ensureSheet();
    current = cfg || {};
    opener = document.activeElement;
    var acts = (current.actions || []).map(function (a) {
      return '<button class="pal-btn' + (a.kind === 'primary' ? ' pal-btn--primary' : '') +
             (a.kind === 'danger' ? ' pal-btn--danger' : '') +
             '" data-sheet-act="' + esc(a.act) + '"' +
             (a.kind === 'danger' ? ' style="margin-right:auto"' : '') + '>' + esc(a.label) + '</button>';
    }).join('');
    body.innerHTML =
      '<div class="pal-sheet__head">' +
        '<h2 class="pal-h2">' + esc(current.title || '') + '</h2>' +
        '<button class="pal-btn pal-btn--icon pal-btn--ghost" data-sheet-act="cancel" aria-label="Close">✕</button>' +
      '</div>' +
      (current.lede ? '<p class="pal-lede" style="margin-bottom:16px">' + esc(current.lede) + '</p>' : '') +
      '<div id="palSheetBody">' + (current.body || '') + '</div>' +
      (acts ? '<div class="pal-sheet__actions">' + acts + '</div>' : '');
    bg.classList.add('is-open');
    if (typeof current.onMount === 'function') current.onMount(body);
    // Focus the first real field, not the close button — the sheet
    // exists to be typed into.
    var first = body.querySelector('input:not([type=hidden]), textarea, select');
    if (first) { try { first.focus(); } catch (e) {} }
  }

  function closeSheet() {
    if (!bg) return;
    var cfg = current;
    bg.classList.remove('is-open');
    current = null;
    if (cfg && typeof cfg.onClose === 'function') cfg.onClose();
    if (opener && opener.isConnected) { try { opener.focus(); } catch (e) {} }
    opener = null;
  }
  function sheetEl() { return body; }
  function sheetOpen() { return !!(bg && bg.classList.contains('is-open')); }

  // ------------------------------------------------------------
  // MEDIA PICKER
  //
  // mountMedia(hostEl, list, onChange) — renders a strip plus three
  // ways in (photo, video, paste a link) and calls onChange(nextList)
  // after every change. The caller owns the record; this owns nothing.
  // ------------------------------------------------------------
  // opts.editable defaults TRUE so every existing call keeps its
  // behaviour. Read-only callers pass false: sheetSession and the cards
  // render a strip nothing is listening to, and an inert ✕ that does
  // nothing when tapped is worse than no ✕ at all.
  function mediaStrip(list, opts) {
    if (!list || !list.length) return '';
    var editable = !opts || opts.editable !== false;
    return '<div class="pal-media" data-media-strip>' + list.map(function (m) {
      var inner = m.kind === 'video'
        ? '<video src="' + esc(m.url) + '" muted playsinline preload="metadata"></video>'
        : '<img src="' + esc(m.url) + '" alt="' + esc(m.name || '') + '" loading="lazy">';
      return '<div class="pal-media__item" data-pending="' + (m.sessionOnly ? 'true' : 'false') + '">' +
               inner +
               (editable
                 ? '<button type="button" class="pal-media__kill" data-media-kill="' + esc(m.id) +
                   '" aria-label="Remove ' + esc(m.name || 'item') + '">✕</button>'
                 : '') +
             '</div>';
    }).join('') + '</div>';
  }

  // THE CARD MEDIA STRIP — photos only, deliberately.
  //
  // A route can hold twenty cards. Twenty <video> elements, even at
  // preload="metadata", is the single most expensive thing this page
  // could ask a phone to do, so a card NEVER creates one: photos are
  // thumbnails, and videos are counted in a badge that opens the card.
  // The full strip, videos and all, lives in the editor sheet.
  function cardMedia(list, max) {
    if (!list || !list.length) return '';
    var photos = [], videos = 0, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].kind === 'video') videos++;
      else if (list[i].url) photos.push(list[i]);
    }
    var cap = max || 3;
    var shown = photos.slice(0, cap);
    var more = photos.length - shown.length;
    if (!shown.length && !videos) return '';

    return '<div class="pal-xmedia" aria-hidden="true">' +
      shown.map(function (m) {
        return '<span class="pal-xmedia__item">' +
          '<img src="' + esc(m.url) + '" alt="" loading="lazy" decoding="async">' +
        '</span>';
      }).join('') +
      (more ? '<span class="pal-xmedia__more">+' + more + '</span>' : '') +
      (videos ? '<span class="pal-xmedia__vid">\u25b8 ' + videos + '</span>' : '') +
    '</div>';
  }

  // What a screen reader gets instead of the strip above.
  function mediaLabel(list) {
    if (!list || !list.length) return '';
    var p = 0, v = 0;
    list.forEach(function (m) { if (m.kind === 'video') v++; else p++; });
    var bits = [];
    if (p) bits.push(p + (p === 1 ? ' photo' : ' photos'));
    if (v) bits.push(v + (v === 1 ? ' video' : ' videos'));
    return bits.join(', ');
  }

  function mountMedia(host, list, onChange) {
    if (!host) return;
    var items = (list || []).map(P.mediaModel);

    function emit() { if (typeof onChange === 'function') onChange(items.slice()); }

    function draw() {
      host.innerHTML =
        mediaStrip(items) +
        '<div class="pal-row" style="margin-top:10px">' +
          '<button type="button" class="pal-btn pal-btn--sm" data-media-add="image">＋ Photo</button>' +
          '<button type="button" class="pal-btn pal-btn--sm" data-media-add="video">＋ Video</button>' +
          '<button type="button" class="pal-btn pal-btn--sm" data-media-add="url">＋ Link</button>' +
        '</div>' +
        '<input type="file" accept="image/*" hidden data-media-input="image">' +
        '<input type="file" accept="video/*" hidden data-media-input="video">';
    }

    function add(rec) {
      items.push(P.mediaModel(rec));
      draw();
      emit();
    }
    function replaceUrl(id, url) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id !== id) continue;
        items[i].url = url;
        items[i].sessionOnly = false;
      }
      draw();
      emit();
    }

    host.addEventListener('click', function (e) {
      var kill = e.target.closest('[data-media-kill]');
      if (kill) {
        e.preventDefault();
        var id = kill.getAttribute('data-media-kill');
        items = items.filter(function (m) { return m.id !== id; });
        draw(); emit();
        return;
      }
      var add1 = e.target.closest('[data-media-add]');
      if (!add1) return;
      e.preventDefault();
      var kind = add1.getAttribute('data-media-add');
      if (kind === 'url') {
        var url = prompt('Paste a photo or video URL');
        if (!url) return;
        var isVid = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
        add({ kind: isVid ? 'video' : 'image', url: url.trim(), name: 'Linked' });
        return;
      }
      var input = host.querySelector('[data-media-input="' + kind + '"]');
      if (input) { input.value = ''; input.click(); }
    });

    host.addEventListener('change', function (e) {
      var input = e.target.closest('[data-media-input]');
      if (!input || !input.files || !input.files[0]) return;
      var file = input.files[0];
      var kind = input.getAttribute('data-media-input');

      if (kind === 'video') {
        // Never base64. Straight to the bucket as a Blob, shown from an
        // object URL in the meantime and marked sessionOnly so it is
        // dropped on write if the upload never lands.
        var temp = P.mediaModel({
          kind: 'video', url: URL.createObjectURL(file), name: file.name, sessionOnly: true
        });
        items.push(temp);
        draw(); emit();
        if (global.PhotoStore) {
          global.PhotoStore.upload(file, function (url) { replaceUrl(temp.id, url); });
        } else {
          toast('Video needs the photo store to save. It will not survive a reload.');
        }
        return;
      }

      P.readFileAsDataUrl(file).then(function (dataUrl) {
        if (!dataUrl) return;
        return P.compressImageDataUrl(dataUrl, 1400, 0.82).then(function (small) {
          // The compressed image is safe to hold locally, so it is added
          // straight away — the upload only ever swaps it for a shorter
          // URL. If the bucket is unreachable the photo still works.
          var rec = P.mediaModel({ kind: 'image', url: small, name: file.name });
          items.push(rec);
          draw(); emit();
          if (global.PhotoStore) {
            global.PhotoStore.upload(small, function (url) { replaceUrl(rec.id, url); });
          }
        });
      });
    });

    draw();
    return { list: function () { return items.slice(); } };
  }

  // ------------------------------------------------------------
  // Small shared render helpers.
  // ------------------------------------------------------------
  function fig(value, unit, size) {
    return '<span class="pal-fig pal-fig--' + (size || 'lg') + '">' + esc(value) +
           (unit ? '<span class="pal-fig__unit">' + esc(unit) + '</span>' : '') + '</span>';
  }
  function meter(pct, lane) {
    var p = P.clamp(P.num(pct, 0), 0, 1);
    return '<div class="pal-meter"' + (lane ? ' data-lane="' + esc(lane) + '"' : '') + '>' +
           '<div class="pal-meter__fill" style="--pct:' + p + '" data-full="' + (p >= 1 ? 'true' : 'false') + '"></div></div>';
  }
  function pips(done, goal, lane) {
    var g = Math.max(1, Math.round(P.num(goal, 1)));
    var d = Math.round(P.num(done, 0));
    var out = '';
    for (var i = 0; i < g; i++) out += '<span class="pal-pip" data-on="' + (i < d ? 'true' : 'false') + '"></span>';
    return '<div class="pal-pips"' + (lane ? ' data-lane="' + esc(lane) + '"' : '') + '>' + out + '</div>';
  }
  function tile(label, valueHtml, note) {
    return '<div class="pal-tile"><div class="pal-tile__label">' + esc(label) + '</div>' +
           valueHtml + (note ? '<div class="pal-tile__note">' + esc(note) + '</div>' : '') + '</div>';
  }
  function empty(title, line, btnLabel, act) {
    return '<div class="pal-empty"><div class="pal-empty__title">' + esc(title) + '</div>' +
           '<p class="pal-sub" style="margin-top:8px">' + esc(line) + '</p>' +
           (btnLabel ? '<button class="pal-btn pal-btn--primary" data-act="' + esc(act) + '">' + esc(btnLabel) + '</button>' : '') +
           '</div>';
  }
  function selectOptions(values, selected) {
    return values.map(function (v) {
      var val = typeof v === 'string' ? v : v.value;
      var lab = typeof v === 'string' ? v : v.label;
      return '<option value="' + esc(val) + '"' + (val === selected ? ' selected' : '') + '>' + esc(lab) + '</option>';
    }).join('');
  }

  global.PalUI = {
    toast: toast,
    openSheet: openSheet, closeSheet: closeSheet, sheetEl: sheetEl, sheetOpen: sheetOpen,
    mountMedia: mountMedia, mediaStrip: mediaStrip,
    cardMedia: cardMedia, mediaLabel: mediaLabel,
    fig: fig, meter: meter, pips: pips, tile: tile, empty: empty,
    selectOptions: selectOptions
  };
})(window);
