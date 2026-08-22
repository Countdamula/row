// =============================================================
// main-hero.js — the cinematic layer for Main.
//
// Shared by index.html (Today + Self-Care), futureself.html and
// weeklyreview.html. Built to the motion of the reference recording:
// an overscaled backdrop that settles then drifts, a glowing ring
// that scales in then rotates forever, a serif headline that arrives
// WORD BY WORD out of line masks, a note column that follows it, six
// column hairlines, and a left rail of dashes. Then the silk ribbon
// from the reference photo, redrawn as SVG, with the day's effort
// medallion struck on it.
//
// ─────────────────────────────────────────────────────────────
// THIS IS A FORK OF palaestra-hero.js, NOT A SHARED MODULE.
//
// The two heroes reproduce the same devices for two different
// aesthetics, and their CSS cannot be shared: every layer that reads
// --pal-hero-p lives in palaestra-theme.css, and Main needs a
// different palette, ground, ribbon and type. A "shared" hero would
// be shared JS bolted to two separate stylesheets, and a page that
// loaded both would have them fight over the same three custom
// properties. Same fork-and-own precedent as kdp-velvet.js and
// vault-hero.js.
//
// If you fix something here, look at palaestra-hero.js — the same bug
// is probably in it. And vice versa.
// ─────────────────────────────────────────────────────────────
//
// THE ONE INVARIANT, and everything below is shaped by it:
// A <video> IS NEVER CREATED BY A RENDERER. These pages do
// host.innerHTML = … on every repaint, so a <video> inside one would
// be a brand-new element every time — re-downloading a 7.5 MB file
// several times a minute. mount() therefore injects the hero ONCE,
// at boot, before anything renders, and it lives OUTSIDE every render
// host so no repaint can reach it.
//
// A PHONE NEVER DOWNLOADS THE CLIP. Under (max-width:719px) or
// prefers-reduced-motion the src is not merely hidden but removed and
// load()ed, and the poster is the whole backdrop.
//
// THE GROUND is mounted here too, for the same reason: .mn-ground is
// three fixed gradient planes that the parallax moves at three
// depths, and a renderer would rebuild them several times a minute.
//
// THE TWO PARALLAX TRANSITIONS. The brief supplied a React + GSAP
// ScrollTrigger + Lenis component. Neither library is loaded, and
// neither is needed. What the component actually specifies is four
// layers at yPercent 70 / 55 / 40 / 10, ease "none", scrub 0, from
// start "0% 0%" to end "100% 0%" — i.e. a strictly linear ramp across
// the trigger's own height. That is two clamped divisions, computed
// in the ONE rAF this file already runs and written as two custom
// properties the stylesheet reads. Lenis is deliberately not
// reproduced: its only job is smoothing document scroll, and taking
// that over would fight topbar.js's fixed launcher and this page's
// own fixed bars.
//
//   A  hero -> ribbon   --mn-hero-p, across the hero's own height
//   B  ribbon -> page   --mn-join-p, across the ribbon's traverse
//
// USAGE
//   MainHero.mount({ variant:'full'|'band', dateText, scenes, onScene,
//                    medal:{ lead, main, level, chosen, onClick } })
//   MainHero.setScene({ eyebrow, lines:[…], note, index, key })
//   MainHero.setMedal({ lead, main, level, chosen, onClick })
// =============================================================

(function (global) {
  'use strict';

  var SRC    = 'images_by_admin/main/hero.mp4';
  var POSTER = 'images_by_admin/main/hero-poster.jpg';

  // 719, matching main-theme.css's phone breakpoint EXACTLY. At 720
  // palaestra-hero.js once said "phone" while its stylesheet said
  // "desktop", and a desktop-sized hero rendered poster-only. Do not
  // change one of these two numbers on its own.
  var mqNarrow = global.matchMedia('(max-width: 719px)');
  var mqMotion = global.matchMedia('(prefers-reduced-motion: reduce)');

  var hero = null, vid = null, railEl = null, ribbonEl = null, medalEl = null;
  var cfg = {};
  var medalHandler = null;
  var raf = 0;

  // The scene currently on screen. setScene() is a no-op when the key
  // has not changed, because onApplied fires a full repaint whenever
  // ANOTHER DEVICE syncs — and replaying a full-screen entrance
  // animation because a phone in another room saved something is the
  // single most jarring thing this file could do.
  var shownScene = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function reduced() { return mqMotion.matches; }

  // ------------------------------------------------------------
  // THE BACKDROP
  //
  // stageAllowed() is deliberately NOT a function of which tab is
  // open or of whether the hero is on screen — a clip that is dropped
  // and re-fetched as you move around costs more than one that stays.
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
  // THE GROUND
  //
  // Three planes: a near-black field, a cool streak band high in the
  // frame, and a warm wash with the horizon line low in it. All the
  // drawing is in main-theme.css; this only puts them on the page,
  // once, as body's first child. Fixed and z-index:-1, so it sits
  // under everything body renders without ever becoming a containing
  // block for anything topbar.js injects.
  // ------------------------------------------------------------
  function mountGround() {
    if (document.querySelector('.mn-ground')) return;
    var g = document.createElement('div');
    g.className = 'mn-ground';
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML =
      '<div class="mn-ground__field"></div>' +
      '<div class="mn-ground__cool"></div>' +
      '<div class="mn-ground__warm"></div>';
    document.body.insertBefore(g, document.body.firstChild);
  }

  // ------------------------------------------------------------
  // THE RIBBON
  //
  // Redrawn rather than cropped from the reference photo: there the
  // band is baked into a screenshot with its badge and a subject
  // behind it. Three stacked beziers with their own gradients, each
  // drifting at its own rate, plus two rim-light strokes — which is
  // what actually reads as silk against black. preserveAspectRatio
  // "none" so it stretches to any width.
  //
  // The gradients run through Main's own umber/copper rather than
  // Palaestra's stone: black silk still has to be lit by the room
  // it is in.
  // ------------------------------------------------------------
  function ribbonSvg() {
    return '' +
    '<svg class="mn-ribbon__svg" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<linearGradient id="mnRibA" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"   stop-color="#100B07"/>' +
          '<stop offset=".38" stop-color="#332415"/>' +
          '<stop offset=".62" stop-color="#1E150D"/>' +
          '<stop offset="1"   stop-color="#100B07"/>' +
        '</linearGradient>' +
        '<linearGradient id="mnRibB" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"   stop-color="#0D0906"/>' +
          '<stop offset=".3"  stop-color="#261A0F"/>' +
          '<stop offset=".55" stop-color="#4A311A"/>' +
          '<stop offset=".8"  stop-color="#18110A"/>' +
          '<stop offset="1"   stop-color="#0D0906"/>' +
        '</linearGradient>' +
        '<linearGradient id="mnRibC" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"   stop-color="#0A0705"/>' +
          '<stop offset=".5"  stop-color="#2B1D11"/>' +
          '<stop offset="1"   stop-color="#0A0705"/>' +
        '</linearGradient>' +
        '<linearGradient id="mnRibRim" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0"    stop-color="#E8DCC4" stop-opacity="0"/>' +
          '<stop offset=".28"  stop-color="#E8DCC4" stop-opacity=".32"/>' +
          '<stop offset=".5"   stop-color="#FFF1D6" stop-opacity=".62"/>' +
          '<stop offset=".72"  stop-color="#D9A961" stop-opacity=".34"/>' +
          '<stop offset="1"    stop-color="#E8DCC4" stop-opacity="0"/>' +
        '</linearGradient>' +
      '</defs>' +

      // back band — widest, softest
      '<g class="mn-ribbon__depth mn-ribbon__depth--a">' +
      '<g class="mn-ribbon__band mn-ribbon__band--a">' +
        '<path fill="url(#mnRibA)" opacity=".55" d="' +
          'M-120,96 C 180,18 380,150 700,84 C 1020,18 1240,142 1560,66 ' +
          'L1560,116 C 1240,190 1020,66 700,132 C 380,196 180,66 -120,146 Z"/>' +
      '</g></g>' +

      // middle band — the one the medallion rides on
      '<g class="mn-ribbon__depth mn-ribbon__depth--b">' +
      '<g class="mn-ribbon__band mn-ribbon__band--b">' +
        '<path fill="url(#mnRibB)" d="' +
          'M-120,112 C 200,44 420,160 720,92 C 1020,26 1260,132 1560,80 ' +
          'L1560,132 C 1260,182 1020,78 720,144 C 420,210 200,96 -120,164 Z"/>' +
        '<path fill="none" stroke="url(#mnRibRim)" stroke-width="1.25" d="' +
          'M-120,112 C 200,44 420,160 720,92 C 1020,26 1260,132 1560,80"/>' +
      '</g></g>' +

      // front band — thinnest, catches the most light.
      // Each band is wrapped in a depth <g>: the band itself owns an
      // endless translateX drift, so the parallax needs its own
      // element or the two transforms would clobber each other.
      '<g class="mn-ribbon__depth mn-ribbon__depth--c">' +
      '<g class="mn-ribbon__band mn-ribbon__band--c">' +
        '<path fill="url(#mnRibC)" opacity=".85" d="' +
          'M-120,134 C 240,72 460,178 760,116 C 1060,56 1280,150 1560,104 ' +
          'L1560,138 C 1280,182 1060,92 760,150 C 460,208 240,110 -120,168 Z"/>' +
        '<path fill="none" stroke="url(#mnRibRim)" stroke-width=".9" opacity=".7" d="' +
          'M-120,134 C 240,72 460,178 760,116 C 1060,56 1280,150 1560,104"/>' +
      '</g></g>' +
    '</svg>';
  }

  // ------------------------------------------------------------
  // THE MEDALLION
  //
  // The page's signature element and the day's one decision, struck
  // as a medal in the middle of the ribbon so it cannot be scrolled
  // past. The rim carries a line of engraved text on a real circular
  // textPath rather than letter-spaced absolute positioning, which
  // is the only way it stays true at every viewport width.
  //
  // Its three states are TEMPERATURES, not a quality ladder — see
  // main-theme.css. LOW is cool because it is conserving, not
  // because it is lesser.
  // ------------------------------------------------------------
  function medalSvg() {
    return '' +
    '<svg class="mn-medal__rim" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<defs>' +
        // A half-circle over the TOP of the rim, drawn left to right,
        // so the engraved line reads the right way up. A full circle
        // would carry the second half of the text upside down along
        // the bottom, which is why this is an arc and not a ring.
        '<path id="mnMedalArc" fill="none" d="M 8,50 A 42,42 0 0,1 92,50"/>' +
      '</defs>' +
      '<text><textPath href="#mnMedalArc" startOffset="50%" text-anchor="middle" class="mn-medal__rimtext"></textPath></text>' +
    '</svg>';
  }

  function buildRibbon(medal) {
    var wrap = document.createElement('div');
    wrap.className = 'mn-ribbon';
    wrap.innerHTML = ribbonSvg() +
      '<button type="button" class="mn-medal" id="mnMedal" data-chosen="false">' +
        medalSvg() +
        '<span class="mn-medal__face">' +
          '<span class="mn-medal__lead"></span>' +
          '<span class="mn-medal__main"></span>' +
        '</span>' +
      '</button>';
    ribbonEl = wrap;
    medalEl = wrap.querySelector('#mnMedal');
    medalEl.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof medalHandler === 'function') medalHandler();
    });
    setMedal(medal || { lead: '', main: '' });
    return wrap;
  }

  function setMedal(m) {
    if (!medalEl) return;
    m = m || {};
    medalEl.querySelector('.mn-medal__lead').textContent = m.lead || '';
    medalEl.querySelector('.mn-medal__main').textContent = m.main || '';

    var rim = medalEl.querySelector('.mn-medal__rimtext');
    if (rim) rim.textContent = m.rim || '';

    if (m.level) medalEl.setAttribute('data-level', m.level);
    else medalEl.removeAttribute('data-level');
    medalEl.setAttribute('data-chosen', m.chosen ? 'true' : 'false');

    medalEl.setAttribute('aria-label', m.label ||
      ((m.lead || '') + ' ' + (m.main || '')).trim());
    medalEl.hidden = !(m.main || m.lead);
    if (typeof m.onClick === 'function') medalHandler = m.onClick;
  }

  // ------------------------------------------------------------
  // THE HERO
  // ------------------------------------------------------------
  function build() {
    var el = document.createElement('header');
    el.className = 'mn-hero mn-hero--' + (cfg.variant === 'band' ? 'band' : 'full');
    el.id = 'mnHero';
    // The poster does double duty: it is also the stage's background
    // image, so it is the backdrop even when the video never loads.
    el.style.setProperty('--mn-hero-poster', 'url("' + POSTER + '")');

    el.innerHTML =
      '<div class="mn-hero__stage">' +
        '<video class="mn-hero__vid" id="mnHeroVid" muted loop playsinline preload="none" ' +
          'poster="' + POSTER + '" disablepictureinpicture disableremoteplayback aria-hidden="true"></video>' +
      '</div>' +
      '<div class="mn-hero__tint" aria-hidden="true"></div>' +
      '<div class="mn-hero__l2" aria-hidden="true">' +
        '<div class="mn-hero__ringglow"></div>' +
        '<div class="mn-hero__ring"></div>' +
      '</div>' +
      '<div class="mn-hero__veil" aria-hidden="true"></div>' +
      '<div class="mn-hero__cols" aria-hidden="true"></div>' +
      (cfg.scenes && cfg.scenes.length > 1
        ? '<nav class="mn-hero__rail" id="mnHeroRail" aria-label="Section"></nav>' : '') +
      '<div class="mn-hero__in">' +
        // No wordmark. topbar.js already fixes a launcher pill over
        // this exact corner and two of them is one too many. The date
        // takes the right-hand slot the reference gives its grid icon.
        '<div class="mn-hero__top">' +
          (cfg.dateText ? '<p class="mn-hero__date" id="mnHeroDate">' + esc(cfg.dateText) + '</p>' : '') +
        '</div>' +
        '<div class="mn-hero__copy">' +
          '<div>' +
            '<p class="mn-hero__eyebrow" id="mnHeroEyebrow"></p>' +
            '<h1 class="mn-hero__head" id="mnHeroHead"></h1>' +
          '</div>' +
          '<p class="mn-hero__note" id="mnHeroNote"></p>' +
        '</div>' +
      '</div>' +
      (cfg.variant === 'band' ? '' : '<div class="mn-hero__scroll" aria-hidden="true">Scroll</div>');

    hero = el;
    vid = el.querySelector('#mnHeroVid');
    railEl = el.querySelector('#mnHeroRail');
    return el;
  }

  function buildRail() {
    if (!railEl || !cfg.scenes) return;
    railEl.innerHTML = cfg.scenes.map(function (s, i) {
      return '<button type="button" class="mn-hero__dash" data-rail="' + i + '" ' +
             'aria-label="' + esc(s.label || s.key || ('Section ' + (i + 1))) + '"></button>';
    }).join('');
    railEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rail]');
      if (!b || typeof cfg.onScene !== 'function') return;
      cfg.onScene(cfg.scenes[parseInt(b.getAttribute('data-rail'), 10)]);
    });
  }

  // ------------------------------------------------------------
  // THE WORD REVEAL
  //
  // Each line is its own overflow:hidden mask and each word its own
  // inline-block, so a word rises out of nothing rather than sliding
  // across the backdrop — which is what makes the reference's reveal
  // read as printing rather than as motion. The stagger is two custom
  // properties, --i (word within the headline) and --l (line), so the
  // CSS owns the timing and this owns only the order.
  // ------------------------------------------------------------
  function headHtml(lines) {
    var idx = 0;
    return (lines || []).map(function (line, l) {
      var words = String(line).split(/\s+/).filter(Boolean);
      return '<span class="mn-hero__line">' + words.map(function (w) {
        return '<span class="mn-hero__w" style="--i:' + (idx++) + ';--l:' + l + '">' +
               esc(w) + '</span>';
      }).join(' ') + '</span>';
    }).join('');
  }

  /**
   * Swap the hero's copy and replay the entrance.
   *
   * GUARDED BY scene.key. A cloud pull fires onApplied, which fires a
   * repaint, which would otherwise call this and restart a
   * full-screen entrance because another device saved something.
   * Pass `force: true` only for a deliberate re-run.
   */
  function setScene(scene) {
    if (!hero) return;
    scene = scene || {};

    var key = scene.key != null ? String(scene.key) : null;
    if (!scene.force && key !== null && key === shownScene) return;
    if (key !== null) shownScene = key;

    var eyebrow = hero.querySelector('#mnHeroEyebrow');
    var head = hero.querySelector('#mnHeroHead');
    var note = hero.querySelector('#mnHeroNote');

    if (eyebrow) eyebrow.textContent = scene.eyebrow || '';
    if (head) head.innerHTML = headHtml(scene.lines);
    if (note) note.textContent = scene.note || '';

    // The note must always land after the LAST word, whatever the
    // headline's shape — so its delay is computed from the split, not
    // guessed at in the stylesheet.
    var total = head ? head.querySelectorAll('.mn-hero__w').length : 0;
    var lineCount = (scene.lines || []).length;
    var last = total ? (total - 1) * 55 + (lineCount - 1) * 90 + 220 + 620 : 400;
    hero.style.setProperty('--mn-note-delay', (last + 60) + 'ms');

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
  // THE TWO SCRUB RANGES
  //
  // One passive listener, rAF-throttled, writing two custom
  // properties onto <html> so the hero, the ribbon, the ground and
  // the page's first section can all read them. Both are linear
  // ramps — the spec's ease "none" and scrub 0, which is what a plain
  // division gives.
  //
  //   A  --mn-hero-p   the hero's own height, start "0% 0%" to end
  //                    "100% 0%". The hero sits at the top of the
  //                    document, so that range is exactly
  //                    scrollY / heroH.
  //
  //   B  --mn-join-p   the ribbon's traverse: 0 when its top reaches
  //                    the viewport bottom, 1 when its bottom leaves
  //                    the viewport top. The spec's literal range
  //                    would not start until the ribbon hit the top
  //                    of the screen, by which point the join it is
  //                    meant to cover is already over.
  //
  // heroH is read on resize and on demand, never inside the handler.
  // The ribbon's rect IS read per frame — one getBoundingClientRect
  // on an element with no layout-affecting animation is a read from
  // the frame's already-clean tree, and it is the only way to track
  // an element whose position depends on what was rendered below it.
  // ------------------------------------------------------------
  var heroH = 1;
  var docEl = document.documentElement;

  function measure() {
    heroH = Math.max(1, hero ? hero.offsetHeight : 1);
    docEl.style.setProperty('--mn-hero-h', heroH + 'px');
  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var y = global.scrollY || global.pageYOffset || 0;
      var p = Math.max(0, Math.min(1, y / heroH));
      docEl.style.setProperty('--mn-hero-p', p.toFixed(4));

      if (ribbonEl) {
        var r = ribbonEl.getBoundingClientRect();
        var vh = global.innerHeight || docEl.clientHeight || 1;
        var span = vh + r.height;
        var jp = Math.max(0, Math.min(1, (vh - r.top) / span));
        docEl.style.setProperty('--mn-join-p', jp.toFixed(4));
      }
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

    document.documentElement.classList.add('mn-root');
    document.body.classList.add('mn');

    mountGround();
    parent.insertBefore(build(), anchor);
    buildRail();
    if (cfg.medal !== false) parent.insertBefore(buildRibbon(cfg.medal), anchor);

    mountStage();
    measure();
    onScroll();                          // paint frame 0 rather than wait for a scroll

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

  global.MainHero = {
    mount: mount,
    // Call after a render: new content changes the page's height, and
    // so where the ribbon sits relative to the viewport.
    // Re-measuring on a repaint is correct; re-SCENING on one is not.
    measure: function () { measure(); onScroll(); },
    setScene: setScene,
    setMedal: setMedal,
    replay: replay,
    el: function () { return hero; },
    height: function () { return heroH; }
  };
})(window);
