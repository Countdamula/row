// =============================================================
// vault-hero.js — the cinematic layer for The Vault.
//
// Mounts three things that vault.html's renderers must never touch:
// THE GROUND (three fixed gradient planes), THE HERO (the clip, the
// ring, the word-by-word headline), and THE RIBBON that joins them to
// the collection.
//
// Built to the motion of the reference recording — the same one The
// Palaestra was built to, so the vocabulary is deliberately identical:
// an overscaled backdrop that settles then drifts, a ring that scales
// in then rotates forever, a headline revealed WORD BY WORD out of
// per-line overflow:hidden masks staggered by --i (word) and --l
// (line), a note column after the last word, six column hairlines, and
// a left rail of dashes.
//
// THE ONE INVARIANT, and everything below is shaped by it:
// A <video> IS NEVER CREATED BY A RENDERER. vault.html's render() does
// body.innerHTML = '' on every repaint, so a <video> inside it would be
// a brand-new element every time — re-downloading a 5 MB file several
// times a minute. mount() therefore injects the hero ONCE, at boot,
// before the first render, OUTSIDE #body and outside .sheet, so no
// repaint can reach it. Same rule, same reason, as palaestra-hero.js
// and kdp-velvet.js.
//
// THE GROUND is mounted here for the same reason: it is three fixed
// planes that the parallax moves at three depths, and a renderer would
// rebuild them several times a minute.
//
// A PHONE NEVER DOWNLOADS THE CLIP. Under (max-width:719px) or
// prefers-reduced-motion the src is not merely hidden but removed and
// load()ed, exactly as promptarium.html's stageAllowed() does, and the
// poster carries the whole backdrop.
//
// THE TWO PARALLAX TRANSITIONS. Ported from a GSAP ScrollTrigger +
// Lenis component; neither library is loaded, and neither is needed.
// What that component actually specifies is four layers at yPercent
// 70 / 55 / 40 / 10, ease "none", scrub 0, from start "0% 0%" to end
// "100% 0%" — i.e. a strictly linear ramp across the trigger's own
// height. That is two clamped divisions, computed in the ONE rAF this
// file runs, and written as two custom properties the stylesheet
// reads. Lenis is deliberately not reproduced: its only job is
// smoothing document scroll, and taking that over would fight
// .chrome's condense-on-scroll, the scroll gauge, .addfab and
// topbar.js's fixed launcher.
//
//   A  hero -> ribbon   --vt-hero-p, across the hero's own height
//   B  ribbon -> page   --vt-join-p, across the ribbon's traverse
//
// USAGE
//   VaultHero.mount({ before, shelves, onShelf, badge:{lead,main,onClick} })
//   VaultHero.setScene({ key, eyebrow, lines:[…], note, readouts, poster })
//   VaultHero.setState('synced'|'local')
// =============================================================

(function (global) {
  'use strict';

  var SRC    = 'images_by_admin/vault/hero.mp4';
  var POSTER = 'images_by_admin/vault/hero-poster.jpg';

  // 719, matching vault-hero.css's phone breakpoint exactly. At 720 this
  // would say "phone" while the stylesheet said "desktop", and a
  // desktop-sized hero would render poster-only.
  var mqNarrow = global.matchMedia('(max-width: 719px)');
  var mqMotion = global.matchMedia('(prefers-reduced-motion: reduce)');

  var hero = null, vid = null, ribbonEl = null, badgeEl = null, railEl = null;
  var copyEl = null, eyebrowEl = null, headEl = null, noteEl = null, readoutsEl = null;
  var clockEl = null, stateEl = null;
  var cfg = {}, badgeHandler = null, raf = 0, clockTimer = 0;

  // The reveal is re-armed on a SHELF CHANGE and never on a repaint. A
  // cloud pull re-runs render() and would otherwise restart the intro at
  // random, which is the trap intro animations always fall into here.
  var shownKey = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function reduced() { return mqMotion.matches; }

  // ------------------------------------------------------------
  // THE BACKDROP
  //
  // stageAllowed() is deliberately NOT a function of which shelf is
  // open or whether the hero is on screen — a clip that is dropped and
  // re-fetched as you move around costs far more than one that stays.
  // ------------------------------------------------------------
  function stageAllowed() { return !mqNarrow.matches && !mqMotion.matches; }

  function mountStage() {
    if (!vid) return;
    if (!stageAllowed()) {
      hero.classList.remove('is-live');
      if (vid.getAttribute('src')) {
        try { vid.pause(); } catch (e) {}
        vid.removeAttribute('src');
        vid.load();                 // actually release it, not just hide it
      }
      return;
    }
    if (!vid.getAttribute('src')) {
      vid.addEventListener('playing', function () { hero.classList.add('is-live'); });
      vid.addEventListener('error',   function () { hero.classList.remove('is-live'); });
      vid.preload = 'auto';
      vid.src = SRC;
    }
    vid.play().catch(function () {});
  }
  function resumeStage() {
    if (vid && vid.getAttribute('src') && vid.paused) vid.play().catch(function () {});
  }

  // ------------------------------------------------------------
  // THE GROUND
  //
  // Three planes: a near-black field, a cool streak band high in the
  // frame, and a warm wash with the horizon line low in it. All the
  // drawing is in vault-hero.css; this only puts them on the page,
  // once, as body's first child — fixed and z-index:-1, so it sits
  // under everything without ever becoming a containing block for
  // anything topbar.js injects.
  // ------------------------------------------------------------
  function mountGround() {
    if (document.querySelector('.vt-ground')) return;
    var g = document.createElement('div');
    g.className = 'vt-ground';
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML =
      '<div class="vt-ground__field"></div>' +
      '<div class="vt-ground__cool"></div>' +
      '<div class="vt-ground__warm"></div>';
    document.body.insertBefore(g, document.body.firstChild);
  }

  // ------------------------------------------------------------
  // THE RIBBON
  //
  // Redrawn rather than cropped from the reference photo: there the
  // band is ~925x140 inside a 1024px screenshot, with the badge baked
  // in and a jet behind it. Three stacked beziers with their own
  // gradients, each drifting at its own rate, plus two rim-light
  // strokes — which is what actually reads as silk against black.
  // preserveAspectRatio="none" so it stretches to any width.
  //
  // Each band is wrapped in a depth <g>: the band itself owns an
  // endless translateX drift, so the parallax needs its own element or
  // the two transforms would clobber each other.
  // ------------------------------------------------------------
  function ribbonSvg() {
    return '' +
    '<svg class="vt-ribbon__svg" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<linearGradient id="vtRibA" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"   stop-color="#0D0A07"/>' +
          '<stop offset=".38" stop-color="#33240F"/>' +
          '<stop offset=".62" stop-color="#1D150C"/>' +
          '<stop offset="1"   stop-color="#0D0A07"/>' +
        '</linearGradient>' +
        '<linearGradient id="vtRibB" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"   stop-color="#0A0705"/>' +
          '<stop offset=".3"  stop-color="#251A0D"/>' +
          '<stop offset=".55" stop-color="#4A2E17"/>' +
          '<stop offset=".8"  stop-color="#17100A"/>' +
          '<stop offset="1"   stop-color="#0A0705"/>' +
        '</linearGradient>' +
        '<linearGradient id="vtRibC" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"   stop-color="#080605"/>' +
          '<stop offset=".5"  stop-color="#2B1E10"/>' +
          '<stop offset="1"   stop-color="#080605"/>' +
        '</linearGradient>' +
        // The rim light carries the palette: cream, then a hot gilt
        // core, falling off through the one cold ash note.
        '<linearGradient id="vtRibRim" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"    stop-color="#E8D6B0" stop-opacity="0"/>' +
          '<stop offset=".26"  stop-color="#E8D6B0" stop-opacity=".32"/>' +
          '<stop offset=".5"   stop-color="#FFF3D8" stop-opacity=".62"/>' +
          '<stop offset=".72"  stop-color="#B8853F" stop-opacity=".34"/>' +
          '<stop offset=".88"  stop-color="#7E9A93" stop-opacity=".16"/>' +
          '<stop offset="1"    stop-color="#E8D6B0" stop-opacity="0"/>' +
        '</linearGradient>' +
      '</defs>' +

      // back band — widest, softest
      '<g class="vt-ribbon__depth vt-ribbon__depth--a">' +
      '<g class="vt-ribbon__band vt-ribbon__band--a">' +
        '<path fill="url(#vtRibA)" opacity=".55" d="' +
          'M-120,96 C 180,18 380,150 700,84 C 1020,18 1240,142 1560,66 ' +
          'L1560,116 C 1240,190 1020,66 700,132 C 380,196 180,66 -120,146 Z"/>' +
      '</g></g>' +

      // middle band — the one the badge rides on
      '<g class="vt-ribbon__depth vt-ribbon__depth--b">' +
      '<g class="vt-ribbon__band vt-ribbon__band--b">' +
        '<path fill="url(#vtRibB)" d="' +
          'M-120,112 C 200,44 420,160 720,92 C 1020,26 1260,132 1560,80 ' +
          'L1560,132 C 1260,182 1020,78 720,144 C 420,210 200,96 -120,164 Z"/>' +
        '<path fill="none" stroke="url(#vtRibRim)" stroke-width="1.25" d="' +
          'M-120,112 C 200,44 420,160 720,92 C 1020,26 1260,132 1560,80"/>' +
      '</g></g>' +

      // front band — thinnest, catches the most light
      '<g class="vt-ribbon__depth vt-ribbon__depth--c">' +
      '<g class="vt-ribbon__band vt-ribbon__band--c">' +
        '<path fill="url(#vtRibC)" opacity=".85" d="' +
          'M-120,134 C 240,72 460,178 760,116 C 1060,56 1280,150 1560,104 ' +
          'L1560,138 C 1280,182 1060,92 760,150 C 460,208 240,110 -120,168 Z"/>' +
        '<path fill="none" stroke="url(#vtRibRim)" stroke-width=".9" opacity=".7" d="' +
          'M-120,134 C 240,72 460,178 760,116 C 1060,56 1280,150 1560,104"/>' +
      '</g></g>' +
    '</svg>';
  }

  function buildRibbon(badge) {
    var wrap = document.createElement('div');
    wrap.className = 'vt-ribbon';
    wrap.innerHTML = ribbonSvg() +
      '<button type="button" class="vt-badge" id="vtBadge">' +
        '<span class="vt-badge__lead"></span>' +
        '<span class="vt-badge__main"></span>' +
      '</button>';
    ribbonEl = wrap;
    badgeEl = wrap.querySelector('#vtBadge');
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
    badgeEl.querySelector('.vt-badge__lead').textContent = b.lead || '';
    badgeEl.querySelector('.vt-badge__main').textContent = b.main || '';
    badgeEl.setAttribute('aria-label', ((b.lead || '') + ' ' + (b.main || '')).trim());
    badgeEl.hidden = !(b.main || b.lead);
    if (typeof b.onClick === 'function') badgeHandler = b.onClick;
  }

  // ------------------------------------------------------------
  // THE HEADLINE
  //
  // One <span class="line"> per line, each an overflow:hidden mask, and
  // one <span class="w"> per word inside it. --i is the word's index
  // within the line and --l the line's index; the stylesheet turns the
  // pair into a delay, so words print left-to-right and top-to-bottom.
  // The trailing space is inside the mask, not between masks, or the
  // words would run together.
  // ------------------------------------------------------------
  function headlineHtml(lines) {
    return (lines || []).map(function (line, l) {
      var words = String(line).split(/\s+/).filter(Boolean);
      return '<span class="vt-hero__line">' + words.map(function (w, i) {
        return '<span class="vt-hero__w" style="--i:' + i + ';--l:' + l + '">' +
          esc(w) + '</span>' + (i < words.length - 1 ? ' ' : '');
      }).join('') + '</span>';
    }).join('');
  }

  // ------------------------------------------------------------
  // THE HERO
  // ------------------------------------------------------------
  function build() {
    var el = document.createElement('header');
    el.className = 'vt-hero';
    el.id = 'vtHero';
    el.style.setProperty('--vt-hero-poster', 'url("' + POSTER + '")');

    el.innerHTML =
      '<div class="vt-hero__stage">' +
        '<video class="vt-hero__vid" id="vtHeroVid" muted loop playsinline preload="none" ' +
          'poster="' + POSTER + '" disablepictureinpicture disableremoteplayback aria-hidden="true"></video>' +
      '</div>' +
      '<div class="vt-hero__l2" aria-hidden="true">' +
        '<div class="vt-hero__ringglow"></div>' +
        '<div class="vt-hero__ring"></div>' +
      '</div>' +
      '<div class="vt-hero__veil" aria-hidden="true"></div>' +
      '<div class="vt-hero__cols" aria-hidden="true"></div>' +
      '<nav class="vt-hero__rail" id="vtHeroRail" aria-label="Shelf position"></nav>' +
      '<div class="vt-hero__in">' +
        // No wordmark: .chrome already prints "Vault" over this corner
        // and topbar.js fixes its launcher above that, so a third one
        // would be two too many. The clock and the sync state take the
        // right-hand slot the reference gives its own top row.
        '<div class="vt-hero__top">' +
          '<p class="vt-hero__clock" id="vtHeroClock">00:00:00</p>' +
          '<p class="vt-hero__state" id="vtHeroState">Local</p>' +
        '</div>' +
        '<div class="vt-hero__copy">' +
          '<div>' +
            '<p class="vt-hero__eyebrow" id="vtHeroEyebrow"></p>' +
            '<h1 class="vt-hero__head" id="vtHeroHead"></h1>' +
          '</div>' +
          '<div class="vt-hero__side">' +
            '<p class="vt-hero__note" id="vtHeroNote"></p>' +
            '<div class="vt-hero__readouts" id="vtHeroReadouts"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="vt-hero__scroll" aria-hidden="true">Scroll</div>';

    hero       = el;
    vid        = el.querySelector('#vtHeroVid');
    railEl     = el.querySelector('#vtHeroRail');
    copyEl     = el.querySelector('.vt-hero__copy');
    eyebrowEl  = el.querySelector('#vtHeroEyebrow');
    headEl     = el.querySelector('#vtHeroHead');
    noteEl     = el.querySelector('#vtHeroNote');
    readoutsEl = el.querySelector('#vtHeroReadouts');
    clockEl    = el.querySelector('#vtHeroClock');
    stateEl    = el.querySelector('#vtHeroState');
    return el;
  }

  // One dash per shelf, the current one lit. Built once; only
  // aria-current moves after that.
  function buildRail(shelves) {
    if (!railEl) return;
    railEl.innerHTML = '';
    (shelves || []).forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'vt-hero__dash';
      b.dataset.key = s.key;
      b.setAttribute('aria-label', s.label);
      b.title = s.label;
      b.addEventListener('click', function () {
        if (typeof cfg.onShelf === 'function') cfg.onShelf(s.key);
      });
      railEl.appendChild(b);
    });
  }

  // ------------------------------------------------------------
  // THE SCENE — everything that changes when a shelf changes.
  // ------------------------------------------------------------
  function setScene(scene) {
    if (!hero) return;
    scene = scene || {};

    if (eyebrowEl) eyebrowEl.textContent = scene.eyebrow || '';
    if (headEl)    headEl.innerHTML = headlineHtml(scene.lines || []);
    if (noteEl)    noteEl.textContent = scene.note || '';
    if (readoutsEl) {
      readoutsEl.innerHTML = (scene.readouts || []).map(function (r) {
        return '<span class="vt-readout"><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></span>';
      }).join('');
    }
    if (railEl && scene.key) {
      railEl.querySelectorAll('.vt-hero__dash').forEach(function (d) {
        d.setAttribute('aria-current', d.dataset.key === scene.key ? 'true' : 'false');
      });
    }

    // Re-arm the reveal ONLY when the shelf actually changed. render()
    // runs again on every cloud pull, and replaying the intro then is
    // the trap this guard exists for.
    if (scene.key && scene.key !== shownKey) {
      shownKey = scene.key;
      hero.classList.remove('is-in');
      // Two frames: one for the class removal to land, one to start the
      // transition from the reset state rather than from mid-flight.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { hero.classList.add('is-in'); });
      });
    }
  }

  function setState(mode) {
    if (stateEl) stateEl.textContent = mode === 'synced' ? 'Synced' : 'Local';
  }

  // The clock is the one thing on this page that ticks. It reads no
  // storage and touches no layout — just a text node once a second.
  function startClock() {
    if (clockTimer || !clockEl) return;
    var paint = function () {
      var d = new Date();
      clockEl.textContent =
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0') + ':' +
        String(d.getSeconds()).padStart(2, '0');
    };
    paint();
    clockTimer = setInterval(paint, 1000);
  }

  // ------------------------------------------------------------
  // THE TWO PARALLAX TRANSITIONS
  //
  // One passive listener, rAF-throttled, writing two custom properties
  // onto <html> so the hero, the ribbon and the ground can all read
  // them. Both are linear ramps — the reference spec's ease "none" and
  // scrub 0, which is exactly what a plain division gives.
  //
  //   A  --vt-hero-p  the hero's own height, start "0% 0%" to end
  //                   "100% 0%". The hero sits at the top of the
  //                   document, so that range is exactly scrollY/heroH.
  //
  //   B  --vt-join-p  the ribbon's traverse: 0 when its top reaches the
  //                   viewport bottom, 1 when its bottom leaves the
  //                   viewport top. The spec's literal range would not
  //                   begin until the ribbon hit the top of the screen,
  //                   by which point the join it covers is over.
  //
  // heroH is read on resize and on demand, never inside the handler.
  // The ribbon's rect IS read per frame — one getBoundingClientRect on
  // an element with no layout-affecting animation is a read from the
  // frame's already-clean tree, and it is the only way to track an
  // element whose position depends on what the renderer just drew.
  // ------------------------------------------------------------
  var heroH = 1;
  var docEl = document.documentElement;

  function measure() {
    heroH = Math.max(1, hero ? hero.offsetHeight : 1);
    docEl.style.setProperty('--vt-hero-h', heroH + 'px');
  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var y = global.scrollY || global.pageYOffset || 0;
      var p = Math.max(0, Math.min(1, y / heroH));
      docEl.style.setProperty('--vt-hero-p', p.toFixed(4));

      if (ribbonEl) {
        var r = ribbonEl.getBoundingClientRect();
        var vh = global.innerHeight || docEl.clientHeight || 1;
        var span = vh + r.height;
        var jp = Math.max(0, Math.min(1, (vh - r.top) / span));
        docEl.style.setProperty('--vt-join-p', jp.toFixed(4));
      }
    });
  }

  // ------------------------------------------------------------
  // MOUNT
  // ------------------------------------------------------------
  function mount(options) {
    cfg = options || {};
    var anchor = cfg.before;
    if (typeof anchor === 'string') anchor = document.querySelector(anchor);
    if (!anchor || !anchor.parentNode) return null;

    mountGround();

    var parent = anchor.parentNode;
    parent.insertBefore(build(), anchor);
    parent.insertBefore(buildRibbon(cfg.badge), anchor);

    buildRail(cfg.shelves);
    startClock();
    measure();
    mountStage();
    onScroll();                       // paint frame 0 rather than wait for a scroll

    global.addEventListener('scroll', onScroll, { passive: true });
    global.addEventListener('resize', function () { measure(); onScroll(); });

    // A tab that comes back to the foreground finds a paused <video>.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) resumeStage();
    });

    // Rotating a phone, or turning Reduce Motion on or off, has to be
    // able to both drop the clip and bring it back.
    var onMq = function () { mountStage(); measure(); onScroll(); };
    if (mqNarrow.addEventListener) {
      mqNarrow.addEventListener('change', onMq);
      mqMotion.addEventListener('change', onMq);
    } else if (mqNarrow.addListener) {          // Safari < 14
      mqNarrow.addListener(onMq);
      mqMotion.addListener(onMq);
    }

    return hero;
  }

  global.VaultHero = {
    mount: mount,
    setScene: setScene,
    setBadge: setBadge,
    setState: setState,
    measure: measure,
    reduced: reduced,
    el: function () { return hero; },
  };
})(window);
