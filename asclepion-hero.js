// =============================================================
// asclepion-hero.js — the night-garden hero.
//
//   window.AscHero
//
// Built to a reference recording: a full-bleed photograph, a
// floating pill nav, a huge headline revealed word by word, a
// glass card, a paragraph, and chips.
//
// =============================================================
// THE ONE INVARIANT
//
// THE HERO IS MOUNTED ONCE, AT BOOT, OUTSIDE THE RENDER HOST.
//
// All three Asclepion documents do `root.innerHTML = view()` on
// every repaint, and a repaint happens whenever the cloud pushes
// — which is to say, whenever a phone in another room saves
// something. A hero built inside that host would be destroyed and
// re-created each time, replaying its entrance at a moment nobody
// chose. mount() therefore inserts it BEFORE the render host and
// never touches it again; only setScene() and setCard() change
// anything, and both are guarded.
//
// The same rule as PalHero.mount() and VaultHero.mount(). Those
// two carry a <video> and the rule is about a 5MB re-download;
// here the hero is a still, so the cost is smaller but the
// jarringness is identical.
// =============================================================

(function (global) {
  'use strict';

  var docEl = document.documentElement;

  var hero = null, headEl = null, noteEl = null, cardEl = null, chipsEl = null;
  var cfg = null;
  var raf = 0, heroH = 1;
  var shownKey = null;

  // 719, not 720. It must match the stylesheet exactly — at 720
  // the script takes its phone path while the CSS is still laying
  // out for desktop, and the two disagree about how far the plate
  // is allowed to travel.
  var mqNarrow = global.matchMedia ? global.matchMedia('(max-width: 719px)') : null;
  var mqMotion = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function narrow() { return !!(mqNarrow && mqNarrow.matches); }
  function reduced() { return !!(mqMotion && mqMotion.matches); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ------------------------------------------------------------
  // THE HEADLINE
  //
  // One span per word, carrying --i (its index in the line) and
  // --l (the line's index). The CSS turns those two numbers into
  // a stagger; keeping the arithmetic in CSS means the reveal
  // costs no JavaScript at all once the markup exists.
  //
  // The trailing space goes INSIDE the mask, or the words run
  // together when the spans become inline-block.
  // ------------------------------------------------------------
  function headlineHtml(lines) {
    return (lines || []).map(function (line, l) {
      var words = String(line).split(/\s+/).filter(Boolean);
      return '<span class="asc-hero__line">' + words.map(function (w, i) {
        return '<span class="asc-hero__w" style="--i:' + i + ';--l:' + l + '">' +
          esc(w) + '</span>' + (i < words.length - 1 ? ' ' : '');
      }).join('') + '</span>';
    }).join('');
  }

  // The paragraph accepts *asterisks* as italics, so the copy can
  // carry its own emphasis without every caller hand-writing
  // markup. Escaped first — this is user-facing copy, not markup.
  function noteHtml(text) {
    return esc(text).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  // ------------------------------------------------------------
  // BUILD
  // ------------------------------------------------------------
  function build() {
    var full = cfg.variant !== 'band';
    hero = document.createElement('header');
    hero.className = 'asc-hero ' + (full ? 'asc-hero--full' : 'asc-hero--band');
    if (cfg.tint) hero.setAttribute('data-tint', cfg.tint);

    hero.innerHTML =
      '<div class="asc-hero__stage" aria-hidden="true"></div>' +
      '<div class="asc-hero__veil" aria-hidden="true"></div>' +
      '<div class="asc-hero__in">' +
        '<p class="asc-label asc-label--tint asc-hero__eyebrow" id="ascHeroEyebrow"></p>' +
        '<h1 class="asc-hero__head" id="ascHeroHead"></h1>' +
        '<p class="asc-hero__note" id="ascHeroNote"></p>' +
      '</div>' +
      (full ? '<div class="asc-hero__rule" aria-hidden="true"></div>' : '');

    headEl = hero.querySelector('#ascHeroHead');
    noteEl = hero.querySelector('#ascHeroNote');
    return hero;
  }

  function buildCard() {
    cardEl = document.createElement('button');
    cardEl.type = 'button';
    cardEl.className = 'asc-hero__card';
    cardEl.id = 'ascHeroCard';
    cardEl.hidden = true;
    hero.appendChild(cardEl);
  }

  // Rebuilt rather than built once, because on a fresh device the
  // routines these come from do not exist yet at mount — seeding
  // waits for the cloud to have spoken. Guarded on the labels, so
  // calling it every render is free and a repaint cannot restart
  // the chips' own stagger.
  var shownChips = '';
  function setChips(chips) {
    var key = (chips || []).map(function (c) { return c.label; }).join('|');
    if (key === shownChips) return;
    shownChips = key;
    if (chipsEl && chipsEl.parentNode) chipsEl.parentNode.removeChild(chipsEl);
    chipsEl = null;
    buildChips(chips);
  }

  function buildChips(chips) {
    if (!chips || !chips.length) return;
    chipsEl = document.createElement('div');
    chipsEl.className = 'asc-hero__chips';
    chipsEl.innerHTML =
      '<span class="asc-hero__chips-mark" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8.4"/>' +
        '<path d="M12 3.6v2M12 18.4v2M3.6 12h2M18.4 12h2"/></svg>' +
      '</span>' +
      chips.map(function (c, i) {
        return '<button type="button" class="asc-hero__chip" style="--c:' + i + '" ' +
          'data-chip="' + i + '">' + esc(c.label) + '</button>';
      }).join('');
    chipsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-chip]');
      if (!b) return;
      var c = chips[Number(b.getAttribute('data-chip'))];
      if (c && typeof c.onClick === 'function') c.onClick();
    });
    hero.appendChild(chipsEl);
  }

  // ------------------------------------------------------------
  // SCENE
  //
  // Guarded by `key`. A repaint calls this with the key it already
  // showed and gets nothing; only a genuine route change re-arms
  // the reveal. Without the guard a cloud pull restarts the whole
  // entrance, which is the single most jarring thing this page
  // could do to someone reading it.
  // ------------------------------------------------------------
  function setScene(scene) {
    if (!hero || !scene) return;
    if (scene.key && scene.key === shownKey) return;
    shownKey = scene.key || null;

    var eb = hero.querySelector('#ascHeroEyebrow');
    if (eb) eb.textContent = scene.eyebrow || '';
    if (headEl) headEl.innerHTML = headlineHtml(scene.lines);
    if (noteEl) noteEl.innerHTML = noteHtml(scene.note || '');
    if (scene.tint) hero.setAttribute('data-tint', scene.tint);

    // The card and the chips wait for the headline to finish, and
    // the wait is computed from the REAL word count rather than
    // guessed at in CSS — a two-word headline should not leave the
    // card hanging for a second and a half.
    var words = headEl ? headEl.querySelectorAll('.asc-hero__w').length : 0;
    var lines = (scene.lines || []).length;
    var last = words ? (words - 1) * 55 + Math.max(0, lines - 1) * 90 + 220 + 700 : 500;
    hero.style.setProperty('--asc-hero-late', (last - 260) + 'ms');
    hero.style.setProperty('--asc-hero-later', last + 'ms');

    replay();
  }

  function replay() {
    if (!hero) return;
    if (reduced()) { hero.classList.add('is-in'); return; }
    hero.classList.remove('is-in');
    // Two frames, not one: the first lets the class removal land,
    // the second starts the transition from the reset state
    // instead of from wherever it happened to be mid-flight.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (hero) hero.classList.add('is-in'); });
    });
  }

  // ------------------------------------------------------------
  // THE CARD
  //
  // Content, not decoration: Today's Word, or — if a routine is
  // half-finished — the way back into it. Passing null hides it.
  // ------------------------------------------------------------
  function setCard(card) {
    if (!cardEl) return;
    if (!card) { cardEl.hidden = true; cardEl.onclick = null; return; }
    cardEl.hidden = false;
    cardEl.innerHTML =
      (card.mark ? '<span class="asc-hero__card-mark">' + card.mark + '</span>' : '') +
      '<span class="asc-hero__card-body">' +
        (card.eyebrow ? '<span class="asc-label asc-label--tint">' + esc(card.eyebrow) + '</span>' : '') +
        '<p class="asc-hero__card-title">' + esc(card.title || '') + '</p>' +
        (card.note ? '<p class="asc-hero__card-note">' + esc(card.note) + '</p>' : '') +
        (card.action ? '<span class="asc-hero__card-cta">' + esc(card.action) + ' &rarr;</span>' : '') +
      '</span>';
    cardEl.onclick = typeof card.onClick === 'function' ? card.onClick : null;
  }

  // ------------------------------------------------------------
  // THE SCRUB
  //
  // ONE rAF-throttled passive listener, writing two custom
  // properties on <html>. Every parallax plane is then pure CSS
  // calc() against them — no layout is read per frame and no
  // element is touched by JavaScript while scrolling.
  //
  //   --asc-hero-p   scrollY / heroH, clamped 0..1
  //   --asc-hero-h   the hero's height in px (written by measure)
  // ------------------------------------------------------------
  function measure() {
    heroH = Math.max(1, hero ? hero.offsetHeight : 1);
    docEl.style.setProperty('--asc-hero-h', heroH + 'px');
  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var y = global.scrollY || global.pageYOffset || 0;
      var p = Math.max(0, Math.min(1, y / heroH));
      docEl.style.setProperty('--asc-hero-p', p.toFixed(4));
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

    anchor.parentNode.insertBefore(build(), anchor);
    if (cfg.variant !== 'band') {
      buildCard();
      setChips(cfg.chips);
    }

    measure();
    onScroll();   // paint frame 0 rather than wait for a first scroll

    global.addEventListener('scroll', onScroll, { passive: true });
    global.addEventListener('resize', function () { measure(); onScroll(); }, { passive: true });

    // A web font landing after first paint changes the headline's
    // height, and with it the hero's. Re-measure when it does, or
    // every parallax ratio is computed against a stale number.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { measure(); onScroll(); }).catch(function () {});
    }

    if (cfg.scene) setScene(cfg.scene);
    else requestAnimationFrame(function () { hero.classList.add('is-in'); });

    return hero;
  }

  global.AscHero = {
    mount: mount,
    setScene: setScene,
    setChips: setChips,
    setCard: setCard,
    measure: measure,
    replay: replay,
    el: function () { return hero; },
    narrow: narrow,
    reduced: reduced
  };
})(window);
