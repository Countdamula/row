// glass-theme.js
//
// The JS half of glass-theme.css — a reusable "dark glass" page-theme
// toolkit, extracted from fitnessstudio.html (that page is the reference
// implementation; its own working code is untouched and does not include
// this file — see glass-theme.css's own header comment on why this is a
// clean parallel extract rather than a rip-and-replace refactor of
// already-shipped code).
//
// Same "shared UI utility, owns no data of its own" precedent as this
// app's topbar.js/sync.js/photo-store.js — every function here is
// callback-driven: the calling page's own -data.js still owns every
// localStorage key. Nothing in this file ever calls localStorage or
// Supabase directly.
//
// fitnessstudio.html genuinely uses GlassTheme.wireMovableSections() for
// its own new "everything on the page is moveable" feature (its own
// #fsSectionsWrap, using this file's .gt-section/.gt-section-drag CSS
// classes) — that part is dogfooded, not just written-and-never-run.
// wireHero()/wireGlareCard()/autosize()/wireInlineEdit() are also
// available here for a NEW page to use directly; fitnessstudio.html's own
// hero/glare cards predate this file and keep their own already-verified
// bespoke copies rather than being retrofitted mid-flight.
//
// REQUIRES: SortableJS (https://cdn.jsdelivr.net/npm/sortablejs@1.15.2)
// already loaded on the page before wireMovableSections() is called, if
// you use that one function. Every other helper here has zero
// dependencies beyond the DOM.

(function (global) {
  'use strict';

  function autosize(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  // Same contenteditable-commit-on-blur/Enter, revert-on-Escape pattern
  // this app's other hero-bearing pages already use (business.html,
  // businessdash.html, aitech.html, fitnessstudio.html's own copy).
  function wireInlineEdit(el, onCommit, opts) {
    if (!el) return;
    opts = opts || {};
    var original = el.textContent;
    el.addEventListener('focus', function () { original = el.textContent; });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); el.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); el.textContent = original; el.blur(); }
    });
    el.addEventListener('blur', function () {
      var val = el.textContent.trim();
      if (!val && opts.allowEmpty === false) { el.textContent = original; return; }
      if (val === original) return;
      onCommit(val);
    });
  }

  function hexToRgbTriplet(hex, fallback) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return fallback || '255,59,74';
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
  }

  // Same canvas-downscale-before-storage recipe every cover photo in
  // this app already uses (businessdash-data.js, aitech-data.js,
  // fitnessstudio-data.js, etc.) — centralized here so a brand-new page
  // doesn't need its own copy just to use GlassTheme.wireHero() below.
  // Existing pages' own per-file copies are untouched; this is additive,
  // not a replacement for them.
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 900; quality = quality == null ? 0.8 : quality;
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL('image/jpeg', quality)); } catch (e) { resolve(dataUrl); }
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  // Cursor-tracked glare + gentle perspective tilt (the "GlareCard"
  // look) for any element with the .gt-glare-card class — purely a
  // pointermove/pointerleave overlay, touches no existing content
  // inside the card. Skipped for touch input so it can't fight
  // scrolling. Call once per card after it's in the DOM.
  function wireGlareCard(card) {
    if (!card || card.__gtGlareWired) return;
    card.__gtGlareWired = true;
    card.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--gt-glare-x', (px * 100) + '%');
      card.style.setProperty('--gt-glare-y', (py * 100) + '%');
      var rx = (px - 0.5) * 10;
      var ry = (0.5 - py) * 8;
      card.style.transform = 'perspective(900px) translateY(-4px) rotateX(' + ry + 'deg) rotateY(' + rx + 'deg)';
      card.classList.add('gt-glare-active');
    });
    card.addEventListener('pointerleave', function () {
      card.style.transform = '';
      card.classList.remove('gt-glare-active');
    });
  }

  // Wires a full cover-photo hero (.gt-hero markup from glass-theme.css)
  // end to end: upload/compress/optional PhotoStore hand-off, Change/
  // Remove tools, empty-state abstract fallback, inline-editable eyebrow/
  // subtext/CTA label, an autosizing title textarea, and a CTA click
  // target. The caller supplies element refs and two plain functions
  // (getRecord/saveRecord) — this never touches localStorage itself.
  //
  // opts = {
  //   eyebrowEl, titleEl, subtextEl, ctaLabelEl, ctaEl, coverBgEl,
  //   mediaAbstractEl, mediaImgEl, choiceEl, toolsEl, fileInputEl,
  //   addBtn, changeBtn, removeBtn,
  //   getRecord: function() -> {eyebrow, title, subtext, ctaLabel, photo},
  //   saveRecord: function(patch) -> same shape, saved,
  //   onCtaClick: function() (optional — e.g. scroll to a section),
  //   maxDim, quality (optional, default 1100/0.78)
  // }
  function wireHero(opts) {
    function renderPhoto(record) {
      if (!opts.mediaImgEl) return;
      if (record.photo) {
        opts.mediaImgEl.src = record.photo; opts.mediaImgEl.style.display = 'block';
        if (opts.choiceEl) opts.choiceEl.style.display = 'none';
        if (opts.toolsEl) opts.toolsEl.style.display = 'flex';
        if (opts.mediaAbstractEl) opts.mediaAbstractEl.style.display = 'none';
      } else {
        opts.mediaImgEl.style.display = 'none'; opts.mediaImgEl.src = '';
        if (opts.choiceEl) opts.choiceEl.style.display = 'flex';
        if (opts.toolsEl) opts.toolsEl.style.display = 'none';
        if (opts.mediaAbstractEl) opts.mediaAbstractEl.style.display = 'block';
      }
      if (opts.coverBgEl) opts.coverBgEl.style.backgroundImage = record.photo ? 'url("' + record.photo + '")' : 'none';
    }
    function render() {
      var record = opts.getRecord();
      if (opts.eyebrowEl) opts.eyebrowEl.textContent = record.eyebrow || '';
      if (opts.titleEl) { opts.titleEl.value = record.title || ''; autosize(opts.titleEl); }
      if (opts.subtextEl) opts.subtextEl.textContent = record.subtext || '';
      if (opts.ctaLabelEl) opts.ctaLabelEl.textContent = record.ctaLabel || '';
      renderPhoto(record);
    }
    function openFilePicker() {
      if (!opts.fileInputEl) return;
      opts.fileInputEl.value = '';
      opts.fileInputEl.click();
    }
    function handleFile() {
      var file = opts.fileInputEl.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          compressImageDataUrl(String(reader.result), opts.maxDim || 1100, opts.quality == null ? 0.78 : opts.quality).then(function (compressed) {
            renderPhoto(opts.saveRecord({ photo: compressed }));
            if (global.PhotoStore) {
              global.PhotoStore.upload(compressed, function (url) { renderPhoto(opts.saveRecord({ photo: url })); });
            }
          }).catch(function (err) { alert('Could not process that photo: ' + (err && err.message ? err.message : err)); });
        } catch (err) {
          alert('Could not process that photo: ' + (err && err.message ? err.message : err));
        }
      };
      reader.onerror = function () { alert('Could not read that file.'); };
      reader.readAsDataURL(file);
    }
    if (opts.eyebrowEl) wireInlineEdit(opts.eyebrowEl, function (v) { opts.saveRecord({ eyebrow: v }); }, { allowEmpty: true });
    if (opts.subtextEl) wireInlineEdit(opts.subtextEl, function (v) { opts.saveRecord({ subtext: v }); }, { allowEmpty: true });
    if (opts.ctaLabelEl) wireInlineEdit(opts.ctaLabelEl, function (v) { opts.saveRecord({ ctaLabel: v }); }, { allowEmpty: false });
    if (opts.titleEl) {
      opts.titleEl.addEventListener('input', function () { autosize(opts.titleEl); });
      opts.titleEl.addEventListener('blur', function () { opts.saveRecord({ title: opts.titleEl.value.trim() }); });
    }
    if (opts.addBtn) opts.addBtn.addEventListener('click', openFilePicker);
    if (opts.changeBtn) opts.changeBtn.addEventListener('click', function (e) { e.stopPropagation(); openFilePicker(); });
    if (opts.removeBtn) opts.removeBtn.addEventListener('click', function (e) { e.stopPropagation(); renderPhoto(opts.saveRecord({ photo: '' })); });
    if (opts.fileInputEl) opts.fileInputEl.addEventListener('change', handleFile);
    if (opts.ctaEl && opts.onCtaClick) opts.ctaEl.addEventListener('click', opts.onCtaClick);
    render();
    return { render: render };
  }

  // Wires drag-reordering onto a container of .gt-section children (a
  // thin wrapper over SortableJS — must already be loaded), persisting
  // the new order via a plain callback and applying a previously-saved
  // order on init. This is the literal "make everything on the page
  // moveable" mechanism.
  //
  // opts = {
  //   getLayout: function() -> string[] (saved key order, may be stale/
  //     incomplete — this function reconciles it against what's actually
  //     in the DOM),
  //   saveLayout: function(string[]),
  //   itemSelector (default '.gt-section'),
  //   handleSelector (default '.gt-section-drag')
  // }
  // Returns the Sortable instance, or null if SortableJS isn't loaded.
  function wireMovableSections(container, opts) {
    if (!container || !global.Sortable) return null;
    opts = opts || {};
    var itemSel = opts.itemSelector || '.gt-section';
    var handleSel = opts.handleSelector || '.gt-section-drag';

    // Apply any previously-saved order first — reconciled against the
    // sections actually present (a key with no matching DOM node is
    // ignored; a DOM node whose key isn't in the saved layout — e.g. a
    // section added to the page after the layout was last saved — is
    // appended at the end, in its current/default position, rather than
    // silently dropped).
    var saved = typeof opts.getLayout === 'function' ? (opts.getLayout() || []) : [];
    var items = Array.prototype.slice.call(container.querySelectorAll(itemSel));
    var byKey = {};
    items.forEach(function (el) { byKey[el.dataset.sectionKey] = el; });
    saved.forEach(function (key) { if (byKey[key]) container.appendChild(byKey[key]); });
    items.forEach(function (el) { if (saved.indexOf(el.dataset.sectionKey) === -1) container.appendChild(el); });

    function persist() {
      var order = Array.prototype.map.call(container.querySelectorAll(itemSel), function (el) { return el.dataset.sectionKey; });
      if (typeof opts.saveLayout === 'function') opts.saveLayout(order);
    }
    return global.Sortable.create(container, {
      handle: handleSel,
      draggable: itemSel,
      animation: 180,
      ghostClass: 'gt-section-ghost',
      chosenClass: 'gt-section-chosen',
      onEnd: persist
    });
  }

  // Fixed squiggle path/viewBox, ported verbatim from the reference
  // React component's own hand-drawn SVG (a short decorative flourish,
  // deliberately narrower than most nav labels — the original never
  // stretched it to fill the label's width either, it's a squiggle
  // *under* the text, not a full underline bar).
  var SQUIGGLY_PATH = 'M1 5.39971C7.48565 -1.08593 6.44837 -0.12827 8.33643 6.47992C8.34809 6.52075 11.6019 2.72875 12.3422 2.33912C13.8991 1.5197 16.6594 2.96924 18.3734 2.96924C21.665 2.96924 23.1972 1.69759 26.745 2.78921C29.7551 3.71539 32.6954 3.7794 35.8368 3.7794';

  // Builds a squiggly-underline nav row (.gt-squiggly-nav from
  // glass-theme.css) — a single-select list of plain <button>s where
  // exactly one carries the ".on" class plus a small glowing squiggle
  // SVG underneath it. items = [{label, active, onClick}].
  //
  // Unlike the original React component (which uses framer-motion's
  // layoutId to smoothly SLIDE the one shared squiggle element between
  // whichever item is newly selected), this rebuilds the whole nav fresh
  // every time it's called — the same pattern every other filter-chip
  // row in this app already uses (a full re-render on each click, not a
  // persisted DOM node updated in place) — so there's no previous
  // position to slide *from* in the first place. The squiggle still
  // "draws in" via its own stroke-dashoffset animation every time it
  // (re)appears, which is the one piece of the original's motion that
  // *does* carry over faithfully.
  function buildSquigglyNav(items) {
    var nav = document.createElement('div');
    nav.className = 'gt-squiggly-nav';
    (items || []).forEach(function (it) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gt-squiggly-item' + (it.active ? ' on' : '');
      btn.textContent = it.label;
      if (it.active) {
        var svgNS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'gt-squiggly-underline');
        svg.setAttribute('width', '37');
        svg.setAttribute('height', '8');
        svg.setAttribute('viewBox', '0 0 37 8');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', SQUIGGLY_PATH);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
        btn.appendChild(svg);
      }
      if (typeof it.onClick === 'function') btn.addEventListener('click', it.onClick);
      nav.appendChild(btn);
    });
    return nav;
  }

  global.GlassTheme = {
    autosize: autosize,
    wireInlineEdit: wireInlineEdit,
    hexToRgbTriplet: hexToRgbTriplet,
    compressImageDataUrl: compressImageDataUrl,
    wireGlareCard: wireGlareCard,
    wireHero: wireHero,
    wireMovableSections: wireMovableSections,
    buildSquigglyNav: buildSquigglyNav
  };
})(window);
