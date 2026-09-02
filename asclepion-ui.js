// =============================================================
// asclepion-ui.js — the shared pieces of The Asclepion.
//
//   window.AscUI
//
// Nothing in here knows about the data layer. It builds strings
// and moves DOM; asclepion-data.js decides what is true.
//
// It existed because there were three documents. There is one
// now, and it stays a separate file for the older reason: this is
// generic machinery — escaping, marks, a sheet, a toast — and
// asclepion.html is the studio. Mixing the two makes both harder
// to read.
//
// Composition mode went with the journals on 2026-09-01. It was a
// distraction-free writing surface, and there is nothing left on
// this page long enough to write.
// =============================================================

(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // ESCAPING
  //
  // Every view in this app is a string builder dumped into
  // innerHTML, and almost every string in it is content the user
  // typed. esc() is not optional politeness — an unescaped
  // journal entry containing a < is a broken page, and one
  // containing a <script> is worse.
  // ------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // For text that should keep its paragraph breaks when it lands
  // in HTML. Escapes first, then re-introduces only <br>.
  function escLines(s) {
    return esc(s).replace(/\n/g, '<br>');
  }
  function attr(s) { return esc(s); }

  // ------------------------------------------------------------
  // THE SIX MARKS
  //
  // One drawn vocabulary — circles, arcs and lines — varied the
  // way votive markers vary, so the six read as a set rather
  // than as a toolbar. Deliberately NOT emoji: emoji in this room
  // would undo the whole typographic argument, and every AI
  // dashboard on earth already has them.
  //
  // Thin strokes (1.1) because everything else here is thin.
  // ------------------------------------------------------------
  var MARKS = {
    // ripples rising from a still point
    breath: '<circle cx="12" cy="16.4" r="2"/><path d="M6.6 12.6a7.6 7.6 0 0 1 10.8 0"/><path d="M3.4 8.8a12.1 12.1 0 0 1 17.2 0"/>',
    // the midline, with points on it and beside it
    eft: '<path d="M12 2.8v18.4"/><circle cx="12" cy="6" r="1.25"/><circle cx="12" cy="10.5" r="1.25"/><circle cx="12" cy="15" r="1.25"/><circle cx="7.2" cy="12.8" r="1.25"/><circle cx="16.8" cy="12.8" r="1.25"/>',
    // a ring with the light turned inward
    medit: '<circle cx="12" cy="12" r="8.4"/><path d="M15.2 7.4a5.7 5.7 0 1 0 0 9.2 6.6 6.6 0 0 1 0-9.2z" fill="currentColor" stroke="none"/>',
    // a body arched, inside its own circle
    yoga: '<circle cx="12" cy="12" r="8.4"/><path d="M7 15.2c2.6-4.6 7.4-4.6 10 0"/><circle cx="12" cy="8.6" r="1.3"/>',
    // radiance
    energy: '<circle cx="12" cy="12" r="3.4"/><path d="M12 1.9v3.4M12 18.7v3.4M1.9 12h3.4M18.7 12h3.4M4.8 4.8l2.4 2.4M16.8 16.8l2.4 2.4M19.2 4.8l-2.4 2.4M7.2 16.8l-2.4 2.4"/>',
    // a mark made by hand: a stroke crossing the ring, not
    // concentric with it. The only one of the six that is not
    // symmetrical, because it is the only group you write.
    mine: '<circle cx="12" cy="12" r="8.4"/><path d="M7.6 15.6 16.4 8"/>',
    // kept
    heart: '<path d="M12 20.4S3.6 15.2 3.6 9.4A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.4 2.6c0 5.8-8.4 11-8.4 11z"/>',
    // the way back
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    play: '<path d="M8.5 5.6 18 12l-9.5 6.4z"/>'
  };

  function mark(name, size) {
    var d = MARKS[name];
    if (!d) return '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '') + '>' + d + '</svg>';
  }

  // ------------------------------------------------------------
  // THE HEART
  //
  // One builder, so the favourite control is identical everywhere
  // and a new screen cannot invent a seventh slightly-different
  // one. `data-fav` carries everything the delegated handler
  // needs; nothing has to be closed over.
  // ------------------------------------------------------------
  function heart(kind, id, on, shelf, label) {
    var name = label || 'this';
    return '<button type="button" class="asc-heart' + (on ? ' is-on' : '') + '"' +
      ' data-act="fav" data-fav-kind="' + attr(kind) + '" data-fav-id="' + attr(id) + '"' +
      (shelf ? ' data-fav-shelf="' + attr(shelf) + '"' : '') +
      ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
      ' aria-label="' + attr((on ? 'Remove ' : 'Keep ') + name) + '">' +
      mark('heart') + '</button>';
  }

  // ------------------------------------------------------------
  // §INTRO — the clock that lets a repaint RESUME.
  //
  // introAt lives HERE, in a closure, not in the DOM — which is
  // the entire point. A cloud pull re-creates every element on
  // the page; if the elapsed time lived in an attribute it would
  // be destroyed with them and the entrance would replay from
  // zero. Held out here, a re-created element can be told how far
  // through the animation it already is.
  //
  // arrive() is called by NAVIGATION only. A repaint calls
  // attrs() and gets a negative --t; past the run it gets nothing
  // at all, so a page that has been open for a minute costs no
  // animation work whatsoever.
  // ------------------------------------------------------------
  var INTRO_RUN = 2400;
  var introAt = -1;

  function introArrive() { introAt = Date.now(); }
  function introReset() { introAt = -1; }
  function introAttrs() {
    if (introAt < 0) return { cls: '', style: '', t: 0 };
    var elapsed = Date.now() - introAt;
    if (elapsed >= INTRO_RUN) return { cls: '', style: '', t: 0 };
    // A NEGATIVE delay, not a smaller one. A cloud pull re-creates
    // the whole list; without this the entrance restarts from zero
    // every time a phone in another room saves something. Feeding
    // the animation the time it has already run resumes it mid-way
    // instead.
    var t = -Math.round(elapsed);
    return { cls: ' is-intro', style: ' style="--t:' + t + 'ms"', t: t };
  }
  // The per-element stagger. Returns the style attribute for the
  // nth revealed thing.
  function stagger(i, step) {
    return ' style="--d:' + Math.round(i * (step || 80)) + 'ms"';
  }

  // The reveal, split into a class part and a style part.
  //
  // These used to be one call each and the caller pasted both into
  // the same tag — which quietly emits TWO style attributes, and
  // the browser keeps only the first. Split by what they produce
  // instead of by what they mean, so a row can carry its position
  // in the stagger AND the intro's resume offset in one attribute.
  function rvlClass() { return 'asc-rvl' + introAttrs().cls; }
  function rvlStyle(i) {
    var t = introAttrs().t;
    return ' style="--i:' + Math.round(i || 0) + (t ? ';--t:' + t + 'ms' : '') + '"';
  }

  // ------------------------------------------------------------
  // TOAST
  // ------------------------------------------------------------
  var toastTimer = null;
  function toast(message) {
    var el = document.getElementById('ascToast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2600);
  }

  // ------------------------------------------------------------
  // SHEET — the one layer-2 surface.
  //
  // Remembers what had focus, restores it on close, traps Escape,
  // and locks the body. A page with a modal that loses your place
  // in the list behind it is a page you stop opening modals on.
  // ------------------------------------------------------------
  var lastFocus = null;
  function sheetEl() { return document.getElementById('ascSheet'); }
  function sheetBg() { return document.getElementById('ascSheetBg'); }
  function sheetOpen() { var b = sheetBg(); return !!b && b.classList.contains('is-on'); }

  function openSheet(html, opts) {
    var bg = sheetBg(), el = sheetEl();
    if (!bg || !el) return;
    opts = opts || {};
    lastFocus = document.activeElement;
    el.innerHTML = html;
    if (opts.tint) bg.setAttribute('data-tint', opts.tint); else bg.removeAttribute('data-tint');
    bg.classList.add('is-on');
    document.body.classList.add('asc-locked');
    var first = el.querySelector('[data-autofocus]') || el.querySelector('button, [href], input, textarea, select');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  }
  function closeSheet() {
    var bg = sheetBg(), el = sheetEl();
    if (!bg || !bg.classList.contains('is-on')) return;
    bg.classList.remove('is-on');
    document.body.classList.remove('asc-locked');
    if (el) el.innerHTML = '';
    if (lastFocus && document.contains(lastFocus)) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
    lastFocus = null;
  }

  function bindSheet() {
    var bg = sheetBg();
    if (!bg) return;
    bg.addEventListener('click', function (e) {
      if (e.target === bg || (e.target.closest && e.target.closest('[data-act="sheet-close"]'))) closeSheet();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheetOpen()) { e.preventDefault(); closeSheet(); }
    });
  }

  // ------------------------------------------------------------
  // NAVIGATION
  //
  // Never location.href directly. local-store-idb.js commits
  // writes asynchronously, so leaving the document in the same
  // tick as a write silently loses it — the deterministic fix is
  // to hand the navigation to the shim and let it flush first.
  // ------------------------------------------------------------
  function go(url) {
    if (global.LocalStoreIDB && typeof global.LocalStoreIDB.navigate === 'function') {
      global.LocalStoreIDB.navigate(url);
      return;
    }
    location.href = url;
  }

  // ------------------------------------------------------------
  // SMALL FORMATTERS
  // ------------------------------------------------------------
  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : (many || one + 's'));
  }
  // Counts are spelled out up to ten. "Five ways to breathe" is a
  // sentence; "5 ways to breathe" is a metric, and this page is
  // not a dashboard.
  var WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
               'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
               'eighteen', 'nineteen', 'twenty'];
  function spell(n) { return (n >= 0 && n <= 20) ? WORDS[n] : String(n); }

  function mins(n) {
    if (!n) return '';
    if (n < 60) return n + ' min';
    var h = Math.floor(n / 60), m = n % 60;
    return h + 'h' + (m ? ' ' + m + 'm' : '');
  }
  // A duration in seconds, as m:ss. Used by the pacer and the
  // technique cards.
  function clock(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }
  function dateLabel(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return '';
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' });
  }

  // A link that is not there yet. Yoga and meditation records ship
  // described but unlinked on purpose (a seeded library of
  // invented URLs is a library that breaks the first time you
  // trust it), so "no link yet" is a normal state with its own
  // affordance rather than an error.
  function linkOrAdd(url, verb) {
    if (url) {
      return '<a class="asc-btn asc-btn--primary asc-btn--sm" href="' + attr(url) +
        '" target="_blank" rel="noopener noreferrer">' + esc(verb || 'Open') + '</a>';
    }
    return '<button type="button" class="asc-btn asc-btn--sm" data-act="add-link">Add link</button>';
  }

  // ------------------------------------------------------------
  // DELEGATION
  //
  // One click listener per host element, dispatching on data-act
  // through a map. Seven screens' worth of individually-bound
  // handlers is seven chances to leak one across a repaint.
  // ------------------------------------------------------------
  function delegate(host, actions) {
    if (!host) return;
    host.addEventListener('click', function (e) {
      var hit = e.target.closest('[data-act]');
      if (!hit || !host.contains(hit)) return;
      var fn = actions[hit.getAttribute('data-act')];
      if (!fn) return;
      e.preventDefault();
      fn(hit, e);
    });
  }

  // Is this a phone? 719, matching the stylesheet exactly. At 720
  // the two disagree and the page lays out one way while the
  // script behaves the other.
  var phoneQuery = global.matchMedia ? global.matchMedia('(max-width: 719px)') : null;
  function isPhone() { return !!(phoneQuery && phoneQuery.matches); }

  // Does the reader want us to stop moving things?
  var motionQuery = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }

  // ------------------------------------------------------------
  // A REPAINT MUST NOT STEAL YOUR PLACE
  //
  // The guard every "someone else changed something" path runs
  // through: if you are typing, or a sheet is open, the cloud
  // does not get to rebuild the DOM under you. It will get its
  // turn on the next navigation.
  // ------------------------------------------------------------
  function safeToRepaint() {
    if (sheetOpen()) return false;
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    if (a && a.isContentEditable) return false;
    return true;
  }

  global.AscUI = {
    esc: esc, escLines: escLines, attr: attr,
    MARKS: MARKS, mark: mark, heart: heart,
    introArrive: introArrive, introReset: introReset, introAttrs: introAttrs,
    stagger: stagger, rvlClass: rvlClass, rvlStyle: rvlStyle,
    toast: toast,
    openSheet: openSheet, closeSheet: closeSheet, sheetOpen: sheetOpen, sheetEl: sheetEl, bindSheet: bindSheet,
    go: go,
    plural: plural, spell: spell, mins: mins, clock: clock, dateLabel: dateLabel, linkOrAdd: linkOrAdd,
    delegate: delegate,
    isPhone: isPhone, reducedMotion: reducedMotion, safeToRepaint: safeToRepaint
  };
})(window);
