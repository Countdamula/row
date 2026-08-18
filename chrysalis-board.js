// =============================================================
// chrysalis-board.js — the image board, shared.
//
// Lived inside chrysalis-version.html until Today needed the same
// gallery. A pattern that appears twice is a component, and a second
// hand-copied gallery would have drifted from the first within a week.
//
// Both surfaces render the SAME records — Images.forVersion(versionId)
// — so an image added on Today is on The Becoming, and the cover set
// in one place is the cover everywhere.
//
// Usage:
//   ChrBoard.section({ versionId, readOnly, label, title, lede })
//   ChrBoard.wire(rootEl, { versionId, readOnly }, refresh)
// =============================================================
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var ICON = {
    left:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    star:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M12 3l2.6 5.8L21 9.6l-4.5 4.2 1.2 6.2L12 17l-5.7 3 1.2-6.2L3 9.6l6.4-.8z"/></svg>',
    del:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
  };

  function section(opts) {
    opts = opts || {};
    var DB = window.ChrysalisDB;
    var versionId = opts.versionId;
    var readOnly = !!opts.readOnly;
    var headId = 'board-h';

    if (!versionId) {
      return '<section class="chr-band" aria-labelledby="' + headId + '"><div class="chr-band__inner">' +
        (opts.label ? '<p class="chr-label">' + esc(opts.label) + '</p>' : '') +
        '<h2 class="chr-h2" id="' + headId + '">' + esc(opts.title || 'The Image Board') + '</h2>' +
        '<p class="chr-lede">The board belongs to a version — it is the picture of one particular ' +
        'person you are becoming. <a class="chr-link" href="chrysalis.html#/versions">Name one</a> ' +
        'and it appears here.</p>' +
      '</div></section>';
    }

    var shots = DB.Images.forVersion(versionId);
    var localCount = shots.filter(DB.Images.isLocal).length;

    var body;
    if (!shots.length) {
      body = '<p class="chr-prose">Nothing here yet. Add photographs of the life, not the possessions — ' +
             'how this person stands, what their days look like, who they are with.</p>';
    } else {
      body = '<div class="chr-board">' + shots.map(function (s, i) {
        return '<figure class="chr-shot">' +
          '<button type="button" class="chr-shot__frame" data-act="zoom" data-id="' + s.id + '" ' +
            'aria-label="View ' + esc(s.caption || 'image ' + (i + 1)) + '">' +
            (s.isAnchor ? '<span class="chr-shot__anchor">Cover</span>' : '') +
            (DB.Images.isLocal(s) ? '<span class="chr-shot__local" title="Stored locally, not uploaded">local</span>' : '') +
            '<img src="' + esc(s.url) + '" alt="' + esc(s.caption || '') + '" loading="lazy">' +
          '</button>' +
          (readOnly
            ? (s.caption ? '<figcaption class="chr-shot__cap chr-meta">' + esc(s.caption) + '</figcaption>' : '')
            : '<figcaption>' +
                '<input class="chr-field chr-shot__cap" data-act="caption" data-id="' + s.id + '" ' +
                  'type="text" value="' + esc(s.caption) + '" placeholder="Say what this is" ' +
                  'aria-label="Caption for image ' + (i + 1) + '">' +
                '<span class="chr-shot__tools">' +
                  '<button class="chr-tick" type="button" data-act="left" data-id="' + s.id + '" aria-label="Move earlier"' + (i === 0 ? ' disabled' : '') + '>' + ICON.left + '</button>' +
                  '<button class="chr-tick" type="button" data-act="right" data-id="' + s.id + '" aria-label="Move later"' + (i === shots.length - 1 ? ' disabled' : '') + '>' + ICON.right + '</button>' +
                  '<button class="chr-tick" type="button" data-act="anchor" data-id="' + s.id + '" aria-label="Use as cover"' + (s.isAnchor ? ' disabled' : '') + '>' + ICON.star + '</button>' +
                  '<button class="chr-tick chr-tick--danger" type="button" data-act="remove" data-id="' + s.id + '" aria-label="Remove image">' + ICON.del + '</button>' +
                '</span>' +
              '</figcaption>') +
        '</figure>';
      }).join('') + '</div>';
    }

    return '<section class="chr-band" aria-labelledby="' + headId + '"><div class="chr-band__inner">' +
      (opts.label ? '<p class="chr-label">' + esc(opts.label) + '</p>' : '') +
      '<h2 class="chr-h2" id="' + headId + '">' + esc(opts.title || 'The Image Board') + '</h2>' +
      '<p class="chr-lede">' + (opts.lede ||
        'What does this person look like, live like, move like? Images of <em>the person</em> — ' +
        'the Dream Board already holds the things.') + '</p>' +
      body +
      (readOnly ? '' :
        '<div class="chr-drop" id="chrDrop" style="margin-top:clamp(20px,3vh,30px)">' +
          '<p style="margin:0 0 14px">Drop images here, or</p>' +
          '<p style="margin:0"><label class="chr-act" for="chrFile" tabindex="0" role="button">Choose images</label>' +
          '<input id="chrFile" type="file" accept="image/*" multiple ' +
            'style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"></p>' +
          '<p style="margin:18px 0 0"><input class="chr-field" id="chrUrl" type="url" ' +
            'placeholder="…or paste an image URL and press Enter" aria-label="Image URL" ' +
            'style="max-width:420px;margin:0 auto"></p>' +
        '</div>') +
      (localCount
        ? '<p class="chr-warn">' + localCount + ' image' + (localCount > 1 ? 's are' : ' is') +
          ' stored locally rather than uploaded, so ' + (localCount > 1 ? 'they travel' : 'it travels') +
          ' inside every cloud sync. That happens when the <code>dashboard-photos</code> bucket ' +
          'is unreachable. They still work; they are just heavy.</p>'
        : '') +
      '</div></section>';
  }

  function wire(root, opts, refresh) {
    opts = opts || {};
    var DB = window.ChrysalisDB;
    var versionId = opts.versionId;
    refresh = refresh || function () {};

    root.querySelectorAll('[data-act="zoom"]').forEach(function (b) {
      b.addEventListener('click', function () { openLightbox(b.getAttribute('data-id')); });
    });
    if (opts.readOnly || !versionId) return;

    root.querySelectorAll('[data-act="caption"]').forEach(function (inp) {
      DB.autosave(inp, function (value) {
        DB.Images.update(inp.getAttribute('data-id'), { caption: value });
      });
    });

    root.querySelectorAll('.chr-shot__tools [data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id');
        var act = b.getAttribute('data-act');
        if (act === 'left') DB.Images.move(id, -1);
        if (act === 'right') DB.Images.move(id, 1);
        if (act === 'anchor') DB.Images.setAnchor(versionId, id);
        if (act === 'remove') {
          if (!window.confirm('Remove this image?')) return;
          DB.Images.remove(id);
        }
        refresh();
      });
    });

    var file = root.querySelector('#chrFile');
    var drop = root.querySelector('#chrDrop');
    var urlIn = root.querySelector('#chrUrl');

    if (file) file.addEventListener('change', function () {
      ingest(file.files, versionId, refresh);
      file.value = '';
    });

    /* The <label> is the visible control, so it must behave like a
       button for a keyboard as well as a mouse. */
    if (drop) {
      var lbl = drop.querySelector('label[for="chrFile"]');
      if (lbl) lbl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); }
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
      });
      drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) ingest(e.dataTransfer.files, versionId, refresh);
      });
    }

    if (urlIn) urlIn.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var u = urlIn.value.trim();
      if (!/^https?:\/\//i.test(u)) return;
      DB.Images.add({ versionId: versionId, url: u });
      urlIn.value = '';
      refresh();
    });
  }

  /* Compress FIRST, save locally at once, then upload in the background
     and swap the base64 for the hosted URL. If the upload never lands,
     the image still works — it is just heavy, and the page says so. */
  function ingest(files, versionId, refresh) {
    var DB = window.ChrysalisDB;
    [].slice.call(files || []).forEach(function (f) {
      if (!/^image\//.test(f.type)) return;
      var fr = new FileReader();
      fr.onload = function () {
        DB.compressImageDataUrl(String(fr.result), 1280, 0.74).then(function (small) {
          var rec = DB.Images.add({ versionId: versionId, url: small });
          refresh();
          if (window.PhotoStore && window.PhotoStore.upload) {
            window.PhotoStore.upload(small, function (hosted) {
              if (!hosted) return;
              DB.Images.update(rec.id, { url: hosted });
              refresh();
            });
          }
        });
      };
      fr.readAsDataURL(f);
    });
  }

  // ---------- lightbox ----------
  var lb = null, lastFocus = null;

  function openLightbox(id) {
    var img = window.ChrysalisDB.Images.get(id);
    if (!img) return;
    lastFocus = document.activeElement;
    lb = document.createElement('div');
    lb.className = 'chr-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', img.caption || 'Image');
    lb.innerHTML =
      '<button class="chr-act chr-act--small chr-lb__close" type="button">Close</button>' +
      '<div><img src="' + esc(img.url) + '" alt="' + esc(img.caption || '') + '">' +
      (img.caption ? '<p class="chr-lb__cap">' + esc(img.caption) + '</p>' : '') + '</div>';
    document.body.appendChild(lb);
    var close = lb.querySelector('.chr-lb__close');
    close.focus();
    close.addEventListener('click', closeLightbox);
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', onLbKey);
  }

  function onLbKey(e) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'Tab' && lb) { e.preventDefault(); lb.querySelector('.chr-lb__close').focus(); }
  }

  function closeLightbox() {
    if (!lb) return;
    document.removeEventListener('keydown', onLbKey);
    lb.remove(); lb = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  window.ChrBoard = {
    section: section,
    wire: wire,
    open: openLightbox,
    close: closeLightbox,
    ICON: ICON
  };
})();
