/* =============================================================================
   THE VELVET GRIMOIRE — the shared cinematic layer
   -----------------------------------------------------------------------------
   Extracted from kdp.html so every page of the dashboard can wear it. Pairs
   with kdp-velvet.css. Load AFTER kdp-nav.js and BEFORE the page's own script.

   WHAT LIVES HERE   the emblem, the wordmark, the full-screen hero, the scene
                     registry and its <video> elements, the pinned reel engine,
                     and Composition Mode.
   WHAT DOES NOT     anything that knows what a week, a book or a chapter IS.
                     Pages build their own cells and pass their own handlers.

   THE ONE INVARIANT, and everything below is shaped by it:
   A <video> MUST NEVER BE CREATED BY A RENDERER. Every view in this app does
   host.innerHTML = …, so a <video> inside one would be a brand-new element on
   every repaint — re-downloading its file and restarting from zero several
   times a minute. mountStages() therefore injects them ONCE, at boot, before
   the router first runs; and a source, once assigned, is never dropped.
   Leaving a scene pauses its element. It does not unload it.
   ========================================================================== */
(function () {
  'use strict';
  var K = window.Kdp;
  var $ = K.$, esc = K.esc, on = K.on;

  var root = document.documentElement;
  var mqNarrow = window.matchMedia('(max-width:720px)');
  var mqMotion = window.matchMedia('(prefers-reduced-motion:reduce)');

  // ---------------------------------------------------------------------------
  // THE SCENE REGISTRY
  // A scene is one backdrop: a clip, the poster that carries its first paint,
  // and where to bias the crop. All three clips are 9:16 portrait, so a
  // landscape window shows a band of each and the subject has to be aimed at.
  // The metal and the ground that go with each scene are in kdp-velvet.css,
  // under html.vg-scene-NAME.
  // ---------------------------------------------------------------------------
  var SCENES = {
    cmd:  { src: 'images_by_admin/kdp/hero.mp4',
            poster: 'images_by_admin/kdp/hero-poster.jpg', obj: '50% 35%' },
    tri:  { src: 'images_by_admin/kdp/trilogy.mp4',
            poster: 'images_by_admin/kdp/trilogy-poster.jpg', obj: '50% 40%' },
    book: { src: 'images_by_admin/kdp/book.mp4',
            poster: 'images_by_admin/kdp/book-poster.jpg', obj: '50% 42%' }
  };

  var mounted = [];        // scene names this page actually has elements for
  var scene = null;        // which one is showing
  var stageWired = false;

  /* Whether this device should ever hold a video file at all. Deliberately
     NOT a function of the route — see mountStage. */
  function mediaAllows() { return !mqNarrow.matches && !mqMotion.matches; }

  /** Inject one stage per named scene. Call ONCE, at boot, before the router. */
  function mountStages(names) {
    var hero = document.querySelector('.kd-hero');
    var heroIn = $('kdpHeroIn');
    if (!hero || !heroIn) return;
    names.forEach(function (name) {
      var s = SCENES[name];
      if (!s || mounted.indexOf(name) !== -1) return;
      var wrap = document.createElement('div');
      wrap.className = 'vg-stage';
      wrap.id = 'vgStage_' + name;
      wrap.setAttribute('data-scene', name);
      wrap.setAttribute('aria-hidden', 'true');
      wrap.style.setProperty('--vg-poster', 'url("' + s.poster + '")');
      wrap.style.setProperty('--vg-obj', s.obj);
      wrap.style.setProperty('--vg-obj-y', s.obj.split(' ')[1] || '35%');
      wrap.innerHTML =
        '<video id="vgVid_' + name + '" muted loop playsinline preload="none" ' +
          'poster="' + s.poster + '" disablepictureinpicture disableremoteplayback></video>' +
        '<div class="vg-crush"></div><div class="vg-veil"></div><div class="vg-vig"></div>';
      hero.insertBefore(wrap, heroIn);
      mounted.push(name);
    });
    wireStage();
  }

  /* The two classes are a handshake, and they sit on the <video> rather than
     on <html>: with several scenes a document-level class could not say WHICH
     element had decoded a frame, and .is-live is the only safe moment to fade
     one up. Without it you get a black flash. */
  function playScene(v, src) {
    v.classList.add('is-on');
    if (!v.getAttribute('src')) {
      v.addEventListener('playing', function () { v.classList.add('is-live'); });
      v.addEventListener('error', function () {
        // the poster is already painted underneath, so failure is invisible
        v.classList.remove('is-on', 'is-live');
      });
      v.preload = 'auto';
      v.src = src;
    }
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  function mountStage() {
    var allow = mediaAllows();
    var velvet = root.classList.contains('vg-on');

    mounted.forEach(function (name) {
      var v = $('vgVid_' + name);
      if (!v) return;

      if (!allow) {
        // A phone, or a reader who asked for less motion: never hold the file.
        v.classList.remove('is-on', 'is-live');
        if (v.getAttribute('src')) {
          try { v.pause(); } catch (e) {}
          v.removeAttribute('src');
          v.load();               // actually cancels the download
        }
        return;
      }

      if (!velvet || name !== scene) {
        // Hidden, so playing is wasted work — but the src STAYS. Dropping it
        // would re-download the file and restart from zero every time you
        // came back. See THE ONE INVARIANT at the top of this file.
        try { v.pause(); } catch (e) {}
        return;
      }
      playScene(v, SCENES[name].src);
    });

    if (composeOpen) mountCompose();
  }

  function wireStage() {
    if (stageWired) return;
    stageWired = true;
    // autoplay policy insurance: one gesture, then remove itself
    var kick = function () { mountStage(); document.removeEventListener('pointerdown', kick); };
    document.addEventListener('pointerdown', kick);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') mountStage();
    });
    var relisten = function () { mountStage(); };
    if (mqNarrow.addEventListener) {
      mqNarrow.addEventListener('change', relisten);
      mqMotion.addEventListener('change', relisten);
    }
  }

  /* Scenes that take the STRICT reading of the type reference — see §5d of
     kdp-velvet.css. A marker class rather than a per-scene selector, so
     opting a scene in is one entry here instead of duplicating forty
     selectors. The Command Center is deliberately not in this list: it keeps
     the lighter settings it was signed off with. */
  var STRICT_TYPE = ['tri', 'book'];

  /** Which backdrop, and whether the full treatment is on at all. */
  function setScene(name) {
    scene = name;
    Object.keys(SCENES).forEach(function (k) {
      root.classList.toggle('vg-scene-' + k, name === k);
    });
    root.classList.toggle('vg-type-strict', STRICT_TYPE.indexOf(name) !== -1);
  }
  function velvetOn(flag) { root.classList.toggle('vg-on', !!flag); }

  // ---------------------------------------------------------------------------
  // THE EMBLEM AND THE WORDMARK
  // ---------------------------------------------------------------------------

  /* A gothic arch — the same arch the first clip pushes toward — with an eye
     set into it, in the engraved monoline of the icon reference. Drawn as SVG
     rather than shipped as a raster, so it inherits the scene's metal through
     currentColor and can never 404. */
  var MARK =
    '<svg class="vg-mark" viewBox="0 0 48 52" fill="none" stroke="currentColor" ' +
      'stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M11 45V23c0-7.2 5.8-13 13-13s13 5.8 13 13v22"/>' +
      '<path d="M15.6 45V24c0-4.6 3.8-8.4 8.4-8.4s8.4 3.8 8.4 8.4v21" opacity=".7"/>' +
      '<path d="M16.6 27.4c2.1-2.9 4.6-4.3 7.4-4.3s5.3 1.4 7.4 4.3c-2.1 2.9-4.6 4.3-7.4 4.3s-5.3-1.4-7.4-4.3Z"/>' +
      '<circle cx="24" cy="27.4" r="2.2"/>' +
      '<circle cx="24" cy="27.4" r=".7" fill="currentColor" stroke="none"/>' +
      '<path d="M6 45h36"/>' +
      '<path d="M13.2 34.6l-2.8 1.6M34.8 34.6l2.8 1.6M12.4 39.2l-2.6 1.2M35.6 39.2l2.6 1.2" opacity=".5"/>' +
      '<path d="M24 5l1 3.2 3.2 1-3.2 1-1 3.2-1-3.2-3.2-1 3.2-1z" fill="currentColor" stroke="none" opacity=".9"/>' +
    '</svg>';

  var STAR = '<svg viewBox="0 0 12 12" aria-hidden="true">' +
    '<path d="M6 0l1.15 4.85L12 6l-4.85 1.15L6 12 4.85 7.15 0 6l4.85-1.15z" fill="currentColor"/></svg>';

  function ornRule() { return '<div class="vg-rule">' + STAR + '<i></i>' + STAR + '</div>'; }

  /* The base size was tuned for the 19 tracked capitals of "The Velvet
     Grimoire". A trilogy or book title is whatever Damian typed, so the size
     is CHOSEN by length rather than hoped for. is-w-s reproduces the original
     figure exactly, so the Command Center's hero is untouched. */
  function wordClass(s) {
    var n = String(s || '').length;
    return n <= 12 ? 'is-w-xs' : n <= 20 ? 'is-w-s' : n <= 30 ? 'is-w-m' : 'is-w-l';
  }

  /**
   * The full-screen hero. Every line of furniture in it is live data, never
   * decoration — the caller supplies the strings.
   *   word / corner / eyebrow / sub / cta / foot   what to show
   *   onGo(   )                                    the single action
   *   onFoot(key)                                  a click in the foot row
   */
  function hero(v) {
    var word = v.word || 'The Velvet Grimoire';
    var cls = wordClass(word);
    $('kdpHeroIn').innerHTML =
      '<div class="vg-corners">' +
        '<p class="vg-corner">' + (v.corner || '') + '</p>' +
      '</div>' +

      '<div class="vg-mid">' +
        ornRule() +
        '<p class="vg-eyebrow">' + esc(v.eyebrow || '') + '</p>' +
        '<div class="vg-lockup ' + cls + '">' + MARK +
          '<h1 class="vg-word ' + cls + '">' + esc(word) + '</h1>' +
        '</div>' +
        ornRule() +
        '<p class="vg-sub">' + esc(v.sub || '') + '</p>' +
        (v.cta ? '<div class="vg-cta">' +
          '<button type="button" class="kd-btn" id="vgGo">' + esc(v.cta) + '</button>' +
        '</div>' : '') +
      '</div>' +

      '<div class="vg-foot">' +
        '<div class="vg-weeks">' + (v.foot || '') + '</div>' +
        '<button type="button" class="vg-cue" id="vgCue">Scroll<i></i></button>' +
      '</div>';

    var go = $('vgGo');
    if (go && v.onGo) go.addEventListener('click', v.onGo);
    var cue = $('vgCue');
    if (cue) cue.addEventListener('click', function () {
      var reel = $('vgReel');
      var target = (reel && !reel.hidden) ? reel : document.querySelector('.kd-app');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if (v.onFoot) {
      on($('kdpHeroIn'), '[data-vgfoot]', 'click', function () {
        v.onFoot(this.dataset.vgfoot);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // THE REEL — a pinned sequence of cells
  // Progress comes from the container's own rect, so nothing has to be measured
  // per cell. Only opacity and transform are ever written.
  // Source-agnostic on purpose: the Command Center feeds it five weeks, a
  // trilogy three books, a book three acts, and the engine neither knows nor
  // cares which.
  // ---------------------------------------------------------------------------
  var CELL_SCROLL = 100;        // svh of scroll per cell
  var reelCells = [];
  var reelTicking = false, reelLastP = -1;

  function buildReel(cells, onOpen) {
    var reel = $('vgReel'), stage = $('vgReelStage');
    if (!reel || !stage) return;

    if (!cells || !cells.length) {
      // The height is inline and set per cell count, so it MUST be cleared —
      // otherwise a route with no reel inherits the last one's scroll length
      // as a screenful of blank ground.
      reel.hidden = true; reel.style.height = '';
      stage.innerHTML = ''; reelCells = []; return;
    }
    reel.hidden = false;

    stage.innerHTML = cells.map(function (c) {
      return '<article class="vg-cell" data-vgcell="' + esc(c.key) + '">' +
        '<p class="vg-cell-n">' + esc(c.numeral) + '</p>' +
        '<p class="vg-cell-k">' + esc(c.kicker) + '</p>' +
        '<h2 class="vg-cell-t">' + esc(c.title) + '</h2>' +
        '<p class="vg-cell-d">' + esc(c.copy) + '</p>' +
        '<div class="vg-cell-m">' + K.meter(c.pct, c.sealed) + '</div>' +
        '<p class="vg-cell-c">' + esc(c.count) + '</p>' +
        '<button type="button" class="kd-btn kd-btn-sm" data-vgopen="' + esc(c.key) + '">' +
          esc(c.action) + '</button>' +
      '</article>';
    }).join('');

    reelCells = Array.prototype.slice.call(stage.querySelectorAll('.vg-cell'));

    // Phones and reduced-motion readers get the cells as ordinary stacked
    // cards. The content stays reachable; only the pinning goes away.
    var flat = mqNarrow.matches || mqMotion.matches;
    reel.classList.toggle('vg-reel--flat', flat);
    reel.style.height = flat ? '' : (reelCells.length * CELL_SCROLL) + 'svh';

    on(stage, '[data-vgopen]', 'click', function (e) {
      e.stopPropagation();
      if (onOpen) onOpen(this.dataset.vgopen);
    });

    reelLastP = -1;
    reelFrame();
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function reelFrame() {
    reelTicking = false;
    var reel = $('vgReel'), stage = $('vgReelStage');
    if (!reel || reel.hidden || !reelCells.length) return;
    if (reel.classList.contains('vg-reel--flat')) return;

    var scrollable = reel.offsetHeight - stage.offsetHeight;
    if (scrollable <= 0) return;
    var p = clamp01(-reel.getBoundingClientRect().top / scrollable);
    if (Math.abs(p - reelLastP) < 0.0004) return;
    reelLastP = p;

    var n = reelCells.length;
    for (var i = 0; i < n; i++) {
      var a = i / n, b = (i + 1) / n;
      var fin = (i === 0) ? 1 : smooth(seg(p, a - 0.02, a + 0.07));
      var fout = (i === n - 1) ? 0 : smooth(seg(p, b - 0.07, b + 0.02));
      var op = Math.min(fin, 1 - fout);
      var el = reelCells[i];
      el.style.opacity = op;
      el.style.transform = 'translateY(' + ((1 - op) * 18).toFixed(1) + 'px)';
      el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
      el.setAttribute('aria-hidden', op < 0.05 ? 'true' : 'false');
    }
  }

  window.addEventListener('scroll', function () {
    if (reelTicking) return;
    reelTicking = true;
    requestAnimationFrame(reelFrame);
  }, { passive: true });
  window.addEventListener('resize', function () {
    reelLastP = -1;
    requestAnimationFrame(reelFrame);
  }, { passive: true });

  // ---------------------------------------------------------------------------
  // COMPOSITION MODE
  // A distraction-free writing surface over the Command Center's own clip.
  //
  // THE RULE THAT MATTERS: it does NOT own a saver. The caller passes the one
  // the page already uses, so there is exactly one write path to
  // D.writeDraft() and no way for two surfaces to disagree — or, worse, for
  // Index IV's word total to be counted twice.
  // ---------------------------------------------------------------------------
  var composeOpen = false;
  var composeCfg = null;
  var composeReturn = null;     // what to put focus back on
  var composeScrollY = 0;

  function composeEl() { return $('vgCompose'); }

  function buildCompose() {
    if (composeEl()) return;
    var el = document.createElement('div');
    el.className = 'vg-compose';
    el.id = 'vgCompose';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Composition mode');
    el.hidden = true;
    // The <video> is created HERE, once, and never again. See THE ONE
    // INVARIANT — this element must survive every repaint of the page beneath.
    el.innerHTML =
      '<div class="vg-compose-stage" data-scene="cmd" aria-hidden="true" ' +
        'style="--vg-poster:url(\'' + SCENES.cmd.poster + '\');--vg-obj:50% 35%;--vg-obj-y:35%">' +
        '<video id="vgVid_compose" muted loop playsinline preload="none" ' +
          'poster="' + SCENES.cmd.poster + '" disablepictureinpicture disableremoteplayback></video>' +
        '<div class="vg-compose-veil"></div>' +
      '</div>' +
      '<div class="vg-compose-bar">' +
        '<p class="vg-compose-where" id="vgComposeWhere"></p>' +
        '<p class="vg-compose-count" id="vgComposeCount"></p>' +
        '<button type="button" class="kd-btn kd-btn-sm" id="vgComposeExit">Done · Esc</button>' +
      '</div>' +
      '<div class="vg-compose-page">' +
        '<textarea class="vg-compose-ed" id="vgComposeEd" spellcheck="true"></textarea>' +
      '</div>';
    document.body.appendChild(el);

    $('vgComposeExit').addEventListener('click', function () { closeCompose(); });
    var ed = $('vgComposeEd');
    ed.addEventListener('input', function () {
      if (composeCfg && composeCfg.onInput) composeCfg.onInput(ed.value);
      var c = $('vgComposeCount');
      if (c && composeCfg && composeCfg.countLabel) c.textContent = composeCfg.countLabel(ed.value);
    });
    ed.addEventListener('blur', function () {
      if (composeCfg && composeCfg.saver) composeCfg.saver.flush();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && composeOpen) { e.preventDefault(); closeCompose(); }
    });
  }

  function mountCompose() {
    var v = $('vgVid_compose');
    if (!v) return;
    if (!mediaAllows()) {
      // Composition Mode still works here — it just is not a video. The
      // poster and the ground carry it, and nothing is fetched.
      v.classList.remove('is-on', 'is-live');
      if (v.getAttribute('src')) {
        try { v.pause(); } catch (e) {}
        v.removeAttribute('src'); v.load();
      }
      return;
    }
    if (!composeOpen) { try { v.pause(); } catch (e) {} return; }
    playScene(v, SCENES.cmd.src);
  }

  /**
   * Open it.
   *   text        what to start with
   *   where       "Index IV · Final chapter" — the only orientation on screen
   *   countLabel(v) -> string
   *   saver       THE PAGE'S saver. Not a new one. See the rule above.
   *   onInput(v)  called on every keystroke, before the saver is queued
   *   onClose()
   */
  function openCompose(cfg) {
    buildCompose();
    composeCfg = cfg;
    composeReturn = document.activeElement;
    composeScrollY = window.scrollY;

    var el = composeEl();
    $('vgComposeWhere').textContent = cfg.where || '';
    var ed = $('vgComposeEd');
    ed.value = cfg.text || '';
    ed.placeholder = cfg.placeholder || '';
    var c = $('vgComposeCount');
    if (c && cfg.countLabel) c.textContent = cfg.countLabel(ed.value);

    el.hidden = false;
    composeOpen = true;
    root.classList.add('vg-composing');   // locks body scroll
    mountCompose();
    // after the fade-in has started, so the caret lands without a jump
    requestAnimationFrame(function () { ed.focus(); });
  }

  function closeCompose() {
    if (!composeOpen) return;
    var ed = $('vgComposeEd');
    // flush BEFORE tearing anything down — leaving must never lose a keystroke
    if (composeCfg && composeCfg.saver) composeCfg.saver.flush();
    composeOpen = false;
    root.classList.remove('vg-composing');
    composeEl().hidden = true;
    mountCompose();               // pauses the clip, keeps its src
    var text = ed ? ed.value : '';
    if (composeCfg && composeCfg.onClose) composeCfg.onClose(text);
    composeCfg = null;
    window.scrollTo(0, composeScrollY);
    if (composeReturn && composeReturn.focus) composeReturn.focus();
    composeReturn = null;
  }

  // ---------------------------------------------------------------------------
  window.Velvet = {
    SCENES: SCENES,
    mountStages: mountStages,
    mountStage: mountStage,
    setScene: setScene,
    velvetOn: velvetOn,
    mediaAllows: mediaAllows,
    hero: hero,
    buildReel: buildReel,
    MARK: MARK, STAR: STAR, ornRule: ornRule, wordClass: wordClass,
    openCompose: openCompose,
    closeCompose: closeCompose,
    isComposing: function () { return composeOpen; }
  };
})();
