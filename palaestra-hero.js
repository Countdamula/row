// =============================================================
// palaestra-hero.js — the cinematic layer for The Palaestra.
//
// Shared by palaestra.html (a full-height hero) and
// palaestra-workout.html (a shorter band of the same thing, so sets
// stay reachable mid-workout). Built to the motion of the reference
// recording: an overscaled backdrop that settles then drifts, a
// glowing ring that scales in then rotates forever, a serif headline
// that arrives WORD BY WORD out of line masks, a note column that
// follows it, six column hairlines, and a left rail of dashes.
// Then the ribbon from the reference photo, redrawn as SVG, with its
// badge as the page's primary action.
//
// THE ONE INVARIANT, and everything below is shaped by it:
// A <video> IS NEVER CREATED BY A RENDERER. Both pages do
// host.innerHTML = … on every repaint, so a <video> inside one would
// be a brand-new element every time — re-downloading a 4.3 MB file
// several times a minute. mount() therefore injects the hero ONCE,
// at boot, before the router first runs, and it lives OUTSIDE
// #palRoot / #palLog so no render can reach it. Same rule, same
// reason, as kdp-velvet.js's own header comment.
//
// A PHONE NEVER DOWNLOADS THE CLIP. Under (max-width:720px) or
// prefers-reduced-motion the src is not merely hidden but removed and
// load()ed, exactly as promptarium.html's stageAllowed() does, and
// the poster is the whole backdrop.
//
// USAGE
//   PalHero.mount({ variant:'full'|'band', mark, dateText, routes, onRoute,
//                   badge:{ lead, main, onClick } })
//   PalHero.setScene({ eyebrow, lines:[…], note, index })
//   PalHero.setBadge({ lead, main, onClick })
// =============================================================

(function (global) {
  'use strict';

  var SRC    = 'images_by_admin/palaestra/hero.mp4';
  var POSTER = 'images_by_admin/palaestra/hero-poster.jpg';

  var mqNarrow = global.matchMedia('(max-width: 720px)');
  var mqMotion = global.matchMedia('(prefers-reduced-motion: reduce)');

  var hero = null, vid = null, copyEl = null, railEl = null, ribbonEl = null, badgeEl = null;
  var routebar = null;
  var cfg = {};
  var badgeHandler = null;
  var raf = 0;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function reduced() { return mqMotion.matches; }

  // ------------------------------------------------------------
  // THE BACKDROP
  //
  // stageAllowed() is deliberately NOT a function of the route or of
  // whether the hero is on screen — a clip that is dropped and
  // re-fetched as you move around costs more than one that stays.
  // ------------------------------------------------------------
  function stageAllowed() { return !mqNarrow.matches && !mqMotion.matches; }

  function mountStage() {
    if (!vid) return;
    if (!stageAllowed()) {
      hero.classList.remove('is-live');
      if (vid.getAttribute('src')) {
        try { vid.pause(); } catch (e) {}
        vid.removeAttribute('src');
        vid.load();                       // actually release it, not just hide it
      }
      return;
    }
    if (!vid.getAttribute('src')) {
      vid.addEventListener('playing', function () { hero.classList.add('is-live'); });
      vid.addEventListener('error', function () { hero.classList.remove('is-live'); });
      vid.preload = 'auto';
      vid.src = SRC;
    }
    vid.play().catch(function () {});
  }
  function resumeStage() {
    if (vid && vid.getAttribute('src') && vid.paused) vid.play().catch(function () {});
  }

  // ------------------------------------------------------------
  // THE RIBBON
  //
  // Redrawn rather than cropped from the reference photo: there the
  // band is ~925×140 inside a 1024px screenshot, with the badge baked
  // in and a jet behind it. Three stacked beziers with their own
  // gradients, each drifting at its own rate, plus two rim-light
  // strokes — which is what actually reads as silk against black.
  // preserveAspectRatio="none" so it stretches to any width.
  // ------------------------------------------------------------
  function ribbonSvg() {
    return '' +
    '<svg class="pal-ribbon__svg" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<linearGradient id="palRibA" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"   stop-color="#14120F"/>' +
          '<stop offset=".38" stop-color="#3A322A"/>' +
          '<stop offset=".62" stop-color="#221D18"/>' +
          '<stop offset="1"   stop-color="#14120F"/>' +
        '</linearGradient>' +
        '<linearGradient id="palRibB" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"   stop-color="#100E0C"/>' +
          '<stop offset=".3"  stop-color="#2A241D"/>' +
          '<stop offset=".55" stop-color="#4A3E31"/>' +
          '<stop offset=".8"  stop-color="#1B1712"/>' +
          '<stop offset="1"   stop-color="#100E0C"/>' +
        '</linearGradient>' +
        '<linearGradient id="palRibC" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"   stop-color="#0C0B09"/>' +
          '<stop offset=".5"  stop-color="#2E2720"/>' +
          '<stop offset="1"   stop-color="#0C0B09"/>' +
        '</linearGradient>' +
        '<linearGradient id="palRibRim" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"    stop-color="#EADFC9" stop-opacity="0"/>' +
          '<stop offset=".28"  stop-color="#EADFC9" stop-opacity=".34"/>' +
          '<stop offset=".5"   stop-color="#FFF4E0" stop-opacity=".6"/>' +
          '<stop offset=".72"  stop-color="#E3A462" stop-opacity=".3"/>' +
          '<stop offset="1"    stop-color="#EADFC9" stop-opacity="0"/>' +
        '</linearGradient>' +
      '</defs>' +

      // back band — widest, softest
      '<g class="pal-ribbon__band pal-ribbon__band--a">' +
        '<path fill="url(#palRibA)" opacity=".55" d="' +
          'M-120,96 C 180,18 380,150 700,84 C 1020,18 1240,142 1560,66 ' +
          'L1560,116 C 1240,190 1020,66 700,132 C 380,196 180,66 -120,146 Z"/>' +
      '</g>' +

      // middle band — the one the badge rides on
      '<g class="pal-ribbon__band pal-ribbon__band--b">' +
        '<path fill="url(#palRibB)" d="' +
          'M-120,112 C 200,44 420,160 720,92 C 1020,26 1260,132 1560,80 ' +
          'L1560,132 C 1260,182 1020,78 720,144 C 420,210 200,96 -120,164 Z"/>' +
        '<path fill="none" stroke="url(#palRibRim)" stroke-width="1.25" d="' +
          'M-120,112 C 200,44 420,160 720,92 C 1020,26 1260,132 1560,80"/>' +
      '</g>' +

      // front band — thinnest, catches the most light
      '<g class="pal-ribbon__band pal-ribbon__band--c">' +
        '<path fill="url(#palRibC)" opacity=".85" d="' +
          'M-120,134 C 240,72 460,178 760,116 C 1060,56 1280,150 1560,104 ' +
          'L1560,138 C 1280,182 1060,92 760,150 C 460,208 240,110 -120,168 Z"/>' +
        '<path fill="none" stroke="url(#palRibRim)" stroke-width=".9" opacity=".7" d="' +
          'M-120,134 C 240,72 460,178 760,116 C 1060,56 1280,150 1560,104"/>' +
      '</g>' +
    '</svg>';
  }

  function buildRibbon(badge) {
    var wrap = document.createElement('div');
    wrap.className = 'pal-ribbon';
    wrap.innerHTML = ribbonSvg() +
      '<button type="button" class="pal-badge2" id="palBadge">' +
        '<span class="pal-badge2__lead"></span>' +
        '<span class="pal-badge2__main"></span>' +
      '</button>';
    ribbonEl = wrap;
    badgeEl = wrap.querySelector('#palBadge');
    badgeEl.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof badgeHandler === 'function') badgeHandler();
    });
    setBadge(badge || { lead: '', main: '' });
    return wrap;
  }

  function setBadge(b) {
    if (!badgeEl) return;
    b = b || {};
    badgeEl.querySelector('.pal-badge2__lead').textContent = b.lead || '';
    badgeEl.querySelector('.pal-badge2__main').textContent = b.main || '';
    badgeEl.setAttribute('aria-label', ((b.lead || '') + ' ' + (b.main || '')).trim());
    badgeEl.hidden = !(b.main || b.lead);
    if (typeof b.onClick === 'function') badgeHandler = b.onClick;
  }

  // ------------------------------------------------------------
  // THE HERO
  // ------------------------------------------------------------
  function build() {
    var el = document.createElement('header');
    el.className = 'pal-hero pal-hero--' + (cfg.variant === 'band' ? 'band' : 'full');
    el.id = 'palHero';
    el.style.setProperty('--pal-hero-poster', 'url("' + POSTER + '")');

    el.innerHTML =
      '<div class="pal-hero__stage">' +
        '<video class="pal-hero__vid" id="palHeroVid" muted loop playsinline preload="none" ' +
          'poster="' + POSTER + '" disablepictureinpicture disableremoteplayback aria-hidden="true"></video>' +
      '</div>' +
      '<div class="pal-hero__ringglow" aria-hidden="true"></div>' +
      '<div class="pal-hero__ring" aria-hidden="true"></div>' +
      '<div class="pal-hero__veil" aria-hidden="true"></div>' +
      '<div class="pal-hero__cols" aria-hidden="true"></div>' +
      (cfg.routes && cfg.routes.length
        ? '<nav class="pal-hero__rail" id="palHeroRail" aria-label="Section position"></nav>' : '') +
      '<div class="pal-hero__in">' +
        // No wordmark here: topbar.js already fixes a launcher pill reading
        // "The Palaestra" over this exact corner, and two of them is one too
        // many. The date takes the right-hand slot the reference gives its
        // grid icon.
        '<div class="pal-hero__top">' +
          (cfg.dateText ? '<p class="pal-hero__date" id="palHeroDate">' + esc(cfg.dateText) + '</p>' : '') +
        '</div>' +
        '<div class="pal-hero__copy">' +
          '<div>' +
            '<p class="pal-hero__eyebrow" id="palHeroEyebrow"></p>' +
            '<h1 class="pal-hero__head" id="palHeroHead"></h1>' +
          '</div>' +
          '<p class="pal-hero__note" id="palHeroNote"></p>' +
        '</div>' +
      '</div>' +
      (cfg.variant === 'band' ? '' : '<div class="pal-hero__scroll" aria-hidden="true">Scroll</div>');

    hero = el;
    vid = el.querySelector('#palHeroVid');
    copyEl = el.querySelector('.pal-hero__copy');
    railEl = el.querySelector('#palHeroRail');
    return el;
  }

  function buildRail() {
    if (!railEl || !cfg.routes) return;
    railEl.innerHTML = cfg.routes.map(function (r, i) {
      return '<button type="button" class="pal-hero__dash" data-rail="' + i + '" ' +
             'aria-label="' + esc(r.label) + '"></button>';
    }).join('');
    railEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rail]');
      if (!b || typeof cfg.onRoute !== 'function') return;
      cfg.onRoute(cfg.routes[parseInt(b.getAttribute('data-rail'), 10)]);
    });
  }

  // ------------------------------------------------------------
  // THE WORD REVEAL
  //
  // Each line is its own overflow:hidden mask and each word its own
  // inline-block, so a word rises out of nothing rather than sliding
  // across the backdrop — which is what makes the reference's reveal
  // read as printing rather than as motion. The stagger is two custom
  // properties, --i (word within the line) and --l (line), so the CSS
  // owns the timing and this owns only the order.
  // ------------------------------------------------------------
  function headHtml(lines) {
    var idx = 0;
    return (lines || []).map(function (line, l) {
      var words = String(line).split(/\s+/).filter(Boolean);
      return '<span class="pal-hero__line">' + words.map(function (w) {
        return '<span class="pal-hero__w" style="--i:' + (idx++) + ';--l:' + l + '">' +
               esc(w) + '</span>';
      }).join(' ') + '</span>';
    }).join('');
  }

  function setScene(scene) {
    if (!hero) return;
    scene = scene || {};
    var eyebrow = hero.querySelector('#palHeroEyebrow');
    var head = hero.querySelector('#palHeroHead');
    var note = hero.querySelector('#palHeroNote');

    if (eyebrow) eyebrow.textContent = scene.eyebrow || '';
    if (head) head.innerHTML = headHtml(scene.lines);
    if (note) note.textContent = scene.note || '';

    // The note must always land after the LAST word, whatever the
    // headline's shape — so its delay is computed from the split, not
    // guessed at in the stylesheet.
    var total = head ? head.querySelectorAll('.pal-hero__w').length : 0;
    var lineCount = (scene.lines || []).length;
    var last = total ? (total - 1) * 55 + (lineCount - 1) * 90 + 220 + 620 : 400;
    hero.style.setProperty('--pal-note-delay', (last + 60) + 'ms');

    if (railEl && typeof scene.index === 'number') {
      Array.prototype.forEach.call(railEl.children, function (b, i) {
        b.setAttribute('aria-current', i === scene.index ? 'true' : 'false');
      });
    }
    replay();
  }

  // A class off, a forced reflow, the class back on. Not a re-render —
  // the <video> underneath must never be touched.
  function replay() {
    if (!hero) return;
    if (reduced()) { hero.classList.add('is-in'); return; }
    hero.classList.remove('is-in');
    void hero.offsetWidth;
    hero.classList.add('is-in');
  }

  // ------------------------------------------------------------
  // THE SCROLL-OUT
  //
  // One passive listener, rAF-throttled, writing ONE custom property.
  // The hero's height is read on resize, never inside the handler, so
  // scrolling never forces layout.
  // ------------------------------------------------------------
  var heroH = 1;
  function measure() { heroH = Math.max(1, hero ? hero.offsetHeight : 1); }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var y = global.scrollY || global.pageYOffset || 0;
      var p = Math.max(0, Math.min(1, y / heroH));
      hero.style.setProperty('--pal-hero-p', p.toFixed(4));
      if (routebar) routebar.classList.toggle('is-stuck', y > heroH - 60);
    });
  }

  // ------------------------------------------------------------
  // MOUNT
  // ------------------------------------------------------------
  function mount(options) {
    cfg = options || {};
    var anchor = cfg.before || document.querySelector('main');
    if (!anchor || !anchor.parentNode) return null;
    var parent = anchor.parentNode;

    parent.insertBefore(build(), anchor);
    buildRail();

    // The route bar is NOT moved: it is fixed, so where it sits in the
    // document is irrelevant, and relocating it would only churn the DOM.
    if (cfg.routebar) routebar = cfg.routebar;
    if (cfg.badge !== false) parent.insertBefore(buildRibbon(cfg.badge), anchor);

    mountStage();
    measure();
    // Both media queries, so rotating a tablet or turning reduced
    // motion on re-decides rather than staying wrong until a reload.
    if (mqNarrow.addEventListener) {
      mqNarrow.addEventListener('change', function () { mountStage(); measure(); });
      mqMotion.addEventListener('change', mountStage);
    }
    global.addEventListener('resize', measure, { passive: true });
    global.addEventListener('scroll', onScroll, { passive: true });

    document.addEventListener('visibilitychange', function () { if (!document.hidden) resumeStage(); });
    // Autoplay policy: some browsers refuse until the document has been
    // interacted with once. Cheap, self-removing insurance.
    document.addEventListener('pointerdown', function once() {
      document.removeEventListener('pointerdown', once);
      resumeStage();
    });

    requestAnimationFrame(function () { hero.classList.add('is-in'); });
    return hero;
  }

  global.PalHero = {
    mount: mount,
    setScene: setScene,
    setBadge: setBadge,
    replay: replay,
    el: function () { return hero; },
    height: function () { return heroH; }
  };
})(window);
