// =============================================================
// larder-ui.js — window.LarUI
//
// The shared vocabulary of The Larder: escaping, marks, the one
// sheet, the delegated-event helper, the entrance clock, and the
// small formatters. Everything here is used by every view; a
// helper used by exactly one view belongs in that view.
//
// This is asclepion-ui.js's structure with the formatters this
// page actually needs — a page that is almost entirely numbers
// needs number formatters, not prose ones. Where the Asclepion
// spells counts as words ("five ways to breathe") because it is
// not a dashboard, The Larder does the opposite: it IS an
// instrument, and 118 g of protein is a measurement, not a
// sentence.
// =============================================================

(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // ESCAPING
  //
  // Every view is a string builder dumped into innerHTML, so this
  // is not optional and there is no second path. A food called
  // `<script>` is a food you are allowed to name.
  // ------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escLines(s) { return esc(s).replace(/\n/g, '<br>'); }
  function attr(s) { return esc(s); }

  // ------------------------------------------------------------
  // MARKS — inline SVG, deliberately not emoji.
  //
  // Emoji render differently on every device, cannot take the
  // route tint, and turn a quiet page into a sticker album. These
  // are drawn from the larder's own world: the scale, the jar,
  // the shelf, the tally.
  // ------------------------------------------------------------
  var MARKS = {
    // A balance beam — the page's recurring idea of "on target".
    scale: '<path d="M12 3v18M5 21h14M12 6 4 10m8-4 8 4M4 10a3 3 0 0 0 6 0m4 0a3 3 0 0 0 6 0"/>',
    jar: '<path d="M8 3h8v2l-1 2h-6L8 5zM7 7h10a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1zM6 13h12"/>',
    shelf: '<path d="M3 8h18M3 16h18M6 8v8m12-8v8"/>',
    drop: '<path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z"/>',
    flame: '<path d="M12 3c1 4-3 5-3 8a3 3 0 0 0 6 0c0-1-.5-2-.5-2 2 1 3.5 3 3.5 5a6 6 0 0 1-12 0c0-4 4-6 6-11z"/>',
    leaf: '<path d="M4 20C4 11 10 5 20 4c0 10-6 16-15 16zM4 20c4-4 7-6 11-8"/>',
    basket: '<path d="M4 9h16l-1.5 10a2 2 0 0 1-2 2H7.5a2 2 0 0 1-2-2zM9 9 7 3m8 6 2-6M9 13v4m6-4v4"/>',
    book: '<path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z"/>',
    calendar: '<path d="M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M9 3v4m6-4v4"/>',
    chart: '<path d="M4 20V10m5 10V4m5 16v-7m5 7V8"/>',
    heart: '<path d="M12 20s-7-4.5-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5c0 5-7 9.5-7 9.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 13 4 4 10-10"/>',
    dots: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>'
  };
  function mark(name, cls) {
    var d = MARKS[name] || MARKS.jar;
    return '<svg class="lar-mark' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.4" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  function heart(on) {
    return '<svg class="lar-heart' + (on ? ' is-on' : '') + '" viewBox="0 0 24 24" ' +
      'fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.4" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + MARKS.heart + '</svg>';
  }

  // ------------------------------------------------------------
  // §INTRO — an entrance that survives a repaint.
  //
  // introAt lives in this closure and NOT in the DOM, because the
  // DOM is destroyed on every render. A cloud pull re-creates
  // every element, and an entrance written as a plain CSS
  // animation would replay from zero every time a phone in
  // another room logged a snack.
  //
  // introAttrs() hands back a NEGATIVE --t, which every
  // animation-delay adds to itself, so a repaint resumes the
  // entrance mid-flight instead of restarting it. Past INTRO_RUN
  // it returns nothing at all and costs nothing.
  // ------------------------------------------------------------
  var INTRO_RUN = 2400;
  var introAt = -1;

  function introArrive() { introAt = Date.now(); }
  function introReset() { introAt = -1; }
  function introAttrs() {
    if (introAt < 0) return { cls: '', style: '' };
    var elapsed = Date.now() - introAt;
    if (elapsed >= INTRO_RUN) return { cls: '', style: '' };
    return { cls: ' is-intro', style: ' style="--t:' + (-Math.round(elapsed)) + 'ms"' };
  }
  /** The per-element stagger: the style attribute for the nth revealed thing. */
  function stagger(i, step) {
    return ' style="--d:' + Math.round(i * (step || 70)) + 'ms"';
  }

  // ------------------------------------------------------------
  // TOAST
  // ------------------------------------------------------------
  var toastTimer = null;
  function toast(message) {
    var el = document.getElementById('larToast');
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
  // and locks the body. The old Nutrition page had three separate
  // modal elements with three separate open/close paths; this is
  // one, and every detail view goes through it.
  //
  // '.lar-sheetbg' must stay registered in topbar.js's
  // MODAL_SELECTORS or the body-scroll lock never applies on a
  // phone and the page behind scrolls under the sheet.
  // ------------------------------------------------------------
  var lastFocus = null;

  function sheetEl() { return document.getElementById('larSheet'); }
  function sheetBg() { return document.getElementById('larSheetBg'); }
  function sheetOpen() { var b = sheetBg(); return !!b && b.classList.contains('is-on'); }

  function openSheet(html, opts) {
    var bg = sheetBg(), el = sheetEl();
    if (!bg || !el) return;
    opts = opts || {};
    lastFocus = document.activeElement;
    el.innerHTML = html;
    if (opts.tint) bg.setAttribute('data-tint', opts.tint); else bg.removeAttribute('data-tint');
    bg.classList.add('is-on');
    document.body.classList.add('lar-locked');
    var first = el.querySelector('[data-autofocus]') ||
                el.querySelector('button, [href], input, textarea, select');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  }
  function closeSheet() {
    var bg = sheetBg(), el = sheetEl();
    if (!bg || !bg.classList.contains('is-on')) return;
    bg.classList.remove('is-on');
    document.body.classList.remove('lar-locked');
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
  // This page logs food and then gets put in a pocket, so that is
  // not a theoretical risk here.
  // ------------------------------------------------------------
  function go(url) {
    if (global.LocalStoreIDB && typeof global.LocalStoreIDB.navigate === 'function') {
      global.LocalStoreIDB.navigate(url);
      return;
    }
    location.href = url;
  }

  // ------------------------------------------------------------
  // NUMBERS
  //
  // This page is mostly numerals, and they are set in a mono face
  // with tabular figures so a column of them lines up and a
  // changing value does not shift its neighbours. These helpers
  // exist so no view invents its own rounding.
  // ------------------------------------------------------------

  /** 1420 -> "1,420". Whole numbers only; macros are not measured in halves. */
  function num(n) {
    n = Math.round(Number(n) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  /** One decimal, but only when it earns it: 6 -> "6", 6.5 -> "6.5". */
  function dec(n) {
    n = Number(n) || 0;
    return (Math.round(n * 10) / 10).toString();
  }
  /** A macro with its unit: "118g". */
  function grams(n) { return num(n) + 'g'; }
  /** Whole percent, clamped at a sane ceiling so a bad entry cannot blow the layout. */
  function pct(value, target) {
    if (!target) return 0;
    return Math.max(0, Math.min(999, Math.round((Number(value) || 0) / target * 100)));
  }

  // ------------------------------------------------------------
  // WATER — stored in millilitres, shown in whatever you asked for.
  //
  // ml is the canonical unit because pal:days already stored it
  // that way and one canonical unit beats two. The display unit
  // is a preference, so every conversion goes through here rather
  // than being written out at each call site with its own idea of
  // how many millilitres are in a fluid ounce.
  //
  // US fluid ounce: 29.5735 ml. Rounded on display, never on
  // storage — rounding on the way in makes eight taps of "+8 oz"
  // add up to something that is not eight times eight.
  // ------------------------------------------------------------
  var ML_PER_OZ = 29.5735;
  function mlToUnit(ml, unit) {
    ml = Number(ml) || 0;
    return unit === 'ml' ? ml : ml / ML_PER_OZ;
  }
  function unitToMl(amount, unit) {
    amount = Number(amount) || 0;
    return unit === 'ml' ? amount : amount * ML_PER_OZ;
  }
  /** "64 oz" / "1,900 ml" — the display string, rounded once, at the end. */
  function water(ml, unit) {
    return num(mlToUnit(ml, unit)) + ' ' + (unit === 'ml' ? 'ml' : 'oz');
  }

  // ------------------------------------------------------------
  // DATES
  // ------------------------------------------------------------
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  /** "Today" / "Tomorrow" / "Mon 8 Sep" — relative where it helps, absolute where it does not. */
  function dateLabel(iso) {
    var t = todayISO();
    if (iso === t) return 'Today';
    if (iso === addDays(t, 1)) return 'Tomorrow';
    if (iso === addDays(t, -1)) return 'Yesterday';
    var d = new Date(iso + 'T00:00:00');
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
  }
  function plural(n, one, many) {
    return (Number(n) === 1) ? one : (many || one + 's');
  }

  /**
   * A unit, agreeing with its amount. "3 pieces", but "170 g".
   *
   * Mass and volume units are already plural-invariant and adding
   * an s to them is simply wrong; countable ones are not. The
   * distinction is a closed list rather than a rule because there
   * is no rule — it is just which units are nouns.
   */
  var COUNTABLE = { piece: 'pieces', serving: 'servings', cup: 'cups' };
  function unitLabel(unit, amount) {
    if (Number(amount) === 1) return unit;
    return COUNTABLE[unit] || unit;
  }

  // ------------------------------------------------------------
  // EVENTS — one delegated listener per host, dispatched through
  // a map.
  //
  // Nine screens' worth of individually-bound handlers is nine
  // chances to leak one across a repaint. Markup carries
  // data-act plus its payload in data-*; nothing is closed over.
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
  // If you are typing, or a sheet is open, the cloud does not get
  // to rebuild the DOM under you. It will get its turn on the
  // next navigation.
  // ------------------------------------------------------------
  function safeToRepaint() {
    if (sheetOpen()) return false;
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    if (a && a.isContentEditable) return false;
    return true;
  }

  global.LarUI = {
    esc: esc, escLines: escLines, attr: attr,
    MARKS: MARKS, mark: mark, heart: heart,
    introArrive: introArrive, introReset: introReset,
    introAttrs: introAttrs, stagger: stagger,
    toast: toast,
    openSheet: openSheet, closeSheet: closeSheet, sheetOpen: sheetOpen,
    sheetEl: sheetEl, bindSheet: bindSheet,
    go: go,
    num: num, dec: dec, grams: grams, pct: pct,
    ML_PER_OZ: ML_PER_OZ, mlToUnit: mlToUnit, unitToMl: unitToMl, water: water,
    todayISO: todayISO, addDays: addDays, dateLabel: dateLabel,
    plural: plural, unitLabel: unitLabel,
    delegate: delegate,
    isPhone: isPhone, reducedMotion: reducedMotion, safeToRepaint: safeToRepaint
  };
})(window);
