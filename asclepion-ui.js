// =============================================================
// asclepion-ui.js — the pieces all three Asclepion documents
// need, so they live here once instead of three times.
//
//   window.AscUI
//
// Nothing in here knows about the data layer. It builds strings
// and moves DOM; asclepion-data.js decides what is true.
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
  // THE SEVEN MARKS
  //
  // One drawn vocabulary — circles, arcs and lines — varied the
  // way votive markers vary, so the seven read as a set rather
  // than as a toolbar. Deliberately NOT emoji: emoji in this room
  // would undo the whole typographic argument, and every AI
  // dashboard on earth already has them.
  //
  // Thin strokes (1.1) because everything else here is thin.
  // ------------------------------------------------------------
  var MARKS = {
    // ripples rising from a still point
    breath: '<circle cx="12" cy="16.4" r="2"/><path d="M6.6 12.6a7.6 7.6 0 0 1 10.8 0"/><path d="M3.4 8.8a12.1 12.1 0 0 1 17.2 0"/>',
    // a page with a spine, and one line written on it
    journal: '<circle cx="12" cy="12" r="8.4"/><path d="M12 3.6v16.8"/><path d="M12.9 8.4h4.4"/>',
    // the midline, with points on it and beside it
    eft: '<path d="M12 2.8v18.4"/><circle cx="12" cy="6" r="1.25"/><circle cx="12" cy="10.5" r="1.25"/><circle cx="12" cy="15" r="1.25"/><circle cx="7.2" cy="12.8" r="1.25"/><circle cx="16.8" cy="12.8" r="1.25"/>',
    // a ring with the light turned inward
    medit: '<circle cx="12" cy="12" r="8.4"/><path d="M15.2 7.4a5.7 5.7 0 1 0 0 9.2 6.6 6.6 0 0 1 0-9.2z" fill="currentColor" stroke="none"/>',
    // a body arched, inside its own circle
    yoga: '<circle cx="12" cy="12" r="8.4"/><path d="M7 15.2c2.6-4.6 7.4-4.6 10 0"/><circle cx="12" cy="8.6" r="1.3"/>',
    // radiance
    energy: '<circle cx="12" cy="12" r="3.4"/><path d="M12 1.9v3.4M12 18.7v3.4M1.9 12h3.4M18.7 12h3.4M4.8 4.8l2.4 2.4M16.8 16.8l2.4 2.4M19.2 4.8l-2.4 2.4M7.2 16.8l-2.4 2.4"/>',
    // spoken, and travelling
    affirm: '<circle cx="9.2" cy="12" r="6.2"/><path d="M17.2 8.6a6 6 0 0 1 0 6.8"/><path d="M20.3 6.3a10 10 0 0 1 0 11.4"/>',
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
    if (introAt < 0) return { cls: '', style: '' };
    var elapsed = Date.now() - introAt;
    if (elapsed >= INTRO_RUN) return { cls: '', style: '' };
    return { cls: ' is-intro', style: ' style="--t:' + (-Math.round(elapsed)) + 'ms"' };
  }
  // The per-element stagger. Returns the style attribute for the
  // nth revealed thing.
  function stagger(i, step) {
    return ' style="--d:' + Math.round(i * (step || 80)) + 'ms"';
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

  // ------------------------------------------------------------
  // §COMPOSITION MODE
  //
  // A distraction-free writing surface over the night garden.
  //
  // THE RULE THAT MATTERS: it does NOT own a saver. The caller
  // passes the autosave the journal already uses, so there is
  // exactly one write path to Asc.saveEntry and no way for the two
  // surfaces to disagree about what you wrote — or, worse, for one
  // to overwrite the other on close.
  //
  // The state is a class on <html>, not on the overlay. That is
  // what removes topbar.js's launcher, which is fixed at z-index
  // 2600 — well above this layer — and would otherwise sit on the
  // first line of your text.
  //
  // Config:
  //   { sections:[{label, body, lines:[]}], where, saver,
  //     onInput(sections), onClose(sections), example }
  // ------------------------------------------------------------
  var composeEl = null, composeCfg = null, composeOpen = false;
  var composeReturn = null, composeScrollY = 0;

  function buildCompose() {
    if (composeEl) return composeEl;
    composeEl = document.createElement('div');
    composeEl.className = 'asc-compose';
    composeEl.id = 'ascCompose';
    composeEl.setAttribute('role', 'dialog');
    composeEl.setAttribute('aria-modal', 'true');
    composeEl.setAttribute('aria-label', 'Composition mode');
    composeEl.hidden = true;
    composeEl.innerHTML =
      '<div class="asc-compose__stage" aria-hidden="true"></div>' +
      '<div class="asc-compose__veil" aria-hidden="true"></div>' +
      '<div class="asc-compose__bar">' +
        '<p class="asc-compose__where" id="ascComposeWhere"></p>' +
        '<p class="asc-compose__count" id="ascComposeCount"></p>' +
        '<button type="button" class="asc-btn asc-btn--ghost asc-btn--sm" id="ascComposeExit">Done · Esc</button>' +
      '</div>' +
      '<div class="asc-compose__page"><div class="asc-compose__col" id="ascComposeCol"></div></div>';
    document.body.appendChild(composeEl);
    composeEl.querySelector('#ascComposeExit').addEventListener('click', closeCompose);
    return composeEl;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && composeOpen) { e.preventDefault(); closeCompose(); }
  });

  function composeAutosize(el) {
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 64) + 'px';
  }

  function composeWords() {
    if (!composeCfg) return 0;
    var text = composeCfg.sections.map(function (s) {
      return [s.body].concat(s.lines || []).filter(Boolean).join(' ');
    }).join(' ').trim();
    return text ? text.split(/\s+/).length : 0;
  }

  function paintCount() {
    var el = document.getElementById('ascComposeCount');
    if (!el) return;
    var n = composeWords();
    el.textContent = n === 1 ? '1 word' : n + ' words';
  }

  function openCompose(cfg) {
    buildCompose();
    composeCfg = cfg || { sections: [] };
    composeReturn = document.activeElement;
    composeScrollY = global.scrollY || 0;

    document.getElementById('ascComposeWhere').textContent = composeCfg.where || '';

    var col = document.getElementById('ascComposeCol');
    // The journals are SECTIONED, so composition mode is a stack
    // of labelled fields rather than the single textarea the
    // precedent uses. Same measure, same behaviour per field.
    col.innerHTML =
      (composeCfg.example ? composeCfg.example : '') +
      composeCfg.sections.map(function (s, i) {
        if (s.lines && s.lines.length) {
          return '<div class="asc-compose__sec">' +
            '<span class="asc-compose__label">' + esc(s.label) + '</span>' +
            s.lines.map(function (line, n) {
              return '<div class="asc-compose__line"><span class="asc-compose__n">' + (n + 1) + '</span>' +
                '<textarea class="asc-compose__ed" rows="1" data-sec="' + i + '" data-line="' + n + '">' +
                esc(line) + '</textarea></div>';
            }).join('') +
          '</div>';
        }
        return '<div class="asc-compose__sec">' +
          '<span class="asc-compose__label">' + esc(s.label) + '</span>' +
          '<textarea class="asc-compose__ed" rows="3" data-sec="' + i + '">' + esc(s.body || '') + '</textarea>' +
        '</div>';
      }).join('');

    Array.prototype.forEach.call(col.querySelectorAll('.asc-compose__ed'), function (el) {
      composeAutosize(el);
      el.addEventListener('input', function () {
        var si = Number(el.getAttribute('data-sec'));
        var li = el.getAttribute('data-line');
        if (li === null) composeCfg.sections[si].body = el.value;
        else composeCfg.sections[si].lines[Number(li)] = el.value;
        composeAutosize(el);
        paintCount();
        if (composeCfg.onInput) composeCfg.onInput(composeCfg.sections);
      });
      // Leaving a field commits it. The debounce is still running
      // underneath; this just makes the common case immediate.
      el.addEventListener('blur', function () {
        if (composeCfg && composeCfg.saver) composeCfg.saver();
      });
    });

    paintCount();
    composeEl.hidden = false;
    composeOpen = true;
    document.documentElement.classList.add('asc-composing');

    // After the fade has started, so the caret lands without a jump.
    requestAnimationFrame(function () {
      var first = col.querySelector('.asc-compose__ed');
      if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
    });
  }

  // The exit ORDER is load-bearing and is the precedent's, verbatim:
  // flush first so leaving can never lose a keystroke, then clear
  // the flag, unlock the scroll, hide, hand the text back, and only
  // then restore where the reader was and what they were on.
  function closeCompose() {
    if (!composeOpen) return;
    if (composeCfg && composeCfg.saver) composeCfg.saver();
    composeOpen = false;
    document.documentElement.classList.remove('asc-composing');
    if (composeEl) composeEl.hidden = true;
    var sections = composeCfg ? composeCfg.sections : null;
    var onClose = composeCfg ? composeCfg.onClose : null;
    composeCfg = null;
    if (onClose) onClose(sections);
    global.scrollTo(0, composeScrollY);
    if (composeReturn && document.contains(composeReturn) && composeReturn.focus) {
      try { composeReturn.focus({ preventScroll: true }); } catch (e) {}
    }
    composeReturn = null;
  }

  function isComposing() { return composeOpen; }

  global.AscUI = {
    esc: esc, escLines: escLines, attr: attr,
    MARKS: MARKS, mark: mark, heart: heart,
    introArrive: introArrive, introReset: introReset, introAttrs: introAttrs, stagger: stagger,
    toast: toast,
    openSheet: openSheet, closeSheet: closeSheet, sheetOpen: sheetOpen, sheetEl: sheetEl, bindSheet: bindSheet,
    go: go,
    plural: plural, spell: spell, mins: mins, clock: clock, dateLabel: dateLabel, linkOrAdd: linkOrAdd,
    delegate: delegate,
    isPhone: isPhone, reducedMotion: reducedMotion, safeToRepaint: safeToRepaint,
    openCompose: openCompose, closeCompose: closeCompose, isComposing: isComposing
  };
})(window);
