// =============================================================
// today-ui.js — Main.
//
// Main stopped being the routine on 2026-08-26 and became the place
// you arrive. Six bands:
//
//   the running head   title, greeting, search, settings
//   QUICK LAUNCH       eight engraved plates
//   TODAY              what is already true today, and where to act
//   DAILY ROUTINE      today's checklist, folded to the hour you are in
//   CONTINUE           what you were last actually working on
//   EXPLORE            the index — every destination, quietly
//
// The routine itself is drawn by routine-ui.js, in its compact
// density; the full editor, the Beliefs database and the record moved
// to routine.html. Data is today-data.js. Styling is main-theme.css.
// The hero and the medallion are still main-hero.js, unchanged.
//
// FIVE RULES THIS FILE IS BUILT AROUND
//
// 1. A RE-RENDER MUST NOT SCROLL. Every repaint here can be triggered
//    by a cloud pull at a moment nobody chose — another device saving
//    something. Nothing below calls scrollTo, and every renderer
//    writes into a fixed host so the page keeps its position.
//
// 2. A WRITE FOLLOWED BY A NAVIGATION LOSES THE WRITE. localStorage is
//    IndexedDB underneath now and its writes commit asynchronously, so
//    leaving the document in the same tick drops them. Every link out
//    of this page goes through go(), which uses
//    LocalStoreIDB.navigate().
//
// 3. THE CLOCK NEVER RE-RENDERS. The minute tick updates two text
//    nodes and toggles one class. It does not read the database, and
//    it does not redraw a section — a ticking clock that parses the
//    whole store on every tick is how one of these pages starts to
//    crawl on a phone.
//
// 4. MAIN READS OTHER APPS. IT NEVER OWNS THEM. The Fitness and
//    Nutrition rows below read window.Pal and window.Lar directly.
//    Main mounts exactly two Supabase rows, `goals` and `palaestra`;
//    it does NOT mount the Larder's, so what it shows is whatever this
//    device last pulled while The Larder was open. That is the correct
//    trade — sync.js replaces a row's entire data column, so a page
//    that reads a row it has not pulled must never be in a position to
//    push it. When the numbers are not there the row says so.
//
// 5. NOTHING DERIVED MAY PENALISE A LEVEL. The progress meter counts
//    against the steps required at TODAY's level, so a Low day is
//    measured as a Low day and can reach 100%.
// =============================================================

(function (global) {
  'use strict';

  var T = null;                 // window.TodayData, resolved at boot
  var R = null;                 // window.RoutineUI
  var N = null;                 // window.MainNav
  var saveTimers = {};

  // Which phases are unfolded. Seeded from the clock; once the reader
  // opens or shuts one by hand the clock stops moving it under them.
  var openPhases = {};
  var foldTouched = false;
  var lastAutoPhase = null;

  var searchIndex = -1;         // keyboard position in the search list

  function d() { return T.todayISO(); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function byId(id) { return document.getElementById(id); }

  /** Debounced write. 400ms — long enough not to thrash IndexedDB on
      every keystroke, short enough that a quick tab-away still lands. */
  // Each entry is { t, fn }, not a bare timer id, because flushSaves() has to be
  // able to RUN a pending write rather than only cancel it.
  function debounce(k, fn, ms) {
    if (saveTimers[k]) clearTimeout(saveTimers[k].t);
    saveTimers[k] = {
      fn: fn,
      t: setTimeout(function () { delete saveTimers[k]; fn(); }, ms == null ? 400 : ms)
    };
  }
  // Run the pending writes. This used to clearTimeout() them and stop there,
  // which SILENTLY DROPPED every edit made in the last 400ms before the call —
  // and the two callers are go() and pagehide, i.e. exactly the moment you stop
  // typing and click away. Same shape as palaestra-data.js's autosave flush
  // sweep and kdp-nav.js's saver.flush(), both of which always ran the callback.
  function flushSaves() {
    var pending = saveTimers;
    saveTimers = {};
    Object.keys(pending).forEach(function (k) {
      clearTimeout(pending[k].t);
      try { pending[k].fn(); } catch (e) {}
    });
  }

  /** Leave the page without losing a write that has not committed. */
  function go(href) {
    flushSaves();
    if (global.LocalStoreIDB && global.LocalStoreIDB.navigate) global.LocalStoreIDB.navigate(href);
    else global.location.href = href;
  }

  function toast(msg, bad) {
    var t = byId('mnToast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'mn-toast is-on' + (bad ? ' mn-toast--bad' : '');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.className = 'mn-toast' + (bad ? ' mn-toast--bad' : ''); }, bad ? 5000 : 2400);
  }

  function prettyDate(iso) {
    var p = String(iso).split('-');
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return dt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function hhmm(dt) {
    return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
  }
  function greeting(dt) {
    var h = dt.getHours();
    if (h < 5) return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  // ============================================================
  // THE RUNNING HEAD
  //
  // A book's running head, not a toolbar: the title on the left, the
  // hour on the right, one hairline under it. The full date stays on
  // the hero ribbon directly above — printing it twice, eight
  // centimetres apart, would be the page not trusting itself.
  // ============================================================
  function renderClock() {
    var now = new Date();
    var g = byId('mnGreet');
    var c = byId('mnClock');
    if (g) g.textContent = greeting(now);
    if (c) c.textContent = hhmm(now);
  }

  // ============================================================
  // QUICK LAUNCH
  // ============================================================
  function renderQuick() {
    var host = byId('mnQuick');
    if (!host || !N) return;
    var pages = N.quickLaunch(T.getSettings().quickLaunch);

    host.innerHTML = pages.map(function (p) {
      return '<button type="button" class="mn-plate-card" data-act="go" data-href="' + esc(p.href) + '">' +
        '<span class="mn-plate-card__ico">' + N.icon(p.icon) + '</span>' +
        '<span class="mn-plate-card__name">' + esc(p.name) + '</span>' +
        '<span class="mn-plate-card__sub">' + esc(p.sub) + '</span>' +
      '</button>';
    }).join('');
  }

  // ============================================================
  // TODAY
  //
  // A call sheet: what is on for today, what is already true about it,
  // and one way in per line. Five rows, and only two of them carry a
  // live number — a row that cannot know something says so rather than
  // showing a zero that reads like a fact.
  // ============================================================
  function rowHtml(o) {
    return '<div class="mn-call' + (o.done ? ' is-done' : '') + '">' +
      '<span class="mn-call__label">' + esc(o.label) + '</span>' +
      '<span class="mn-call__status' + (o.quiet ? ' is-quiet' : '') + '">' + (o.statusHtml || esc(o.status)) + '</span>' +
      '<span class="mn-call__leader" aria-hidden="true"></span>' +
      '<button type="button" class="mn-call__go" data-act="go" data-href="' + esc(o.href) + '">' +
        esc(o.action) + ' <span aria-hidden="true">&rarr;</span></button>' +
    '</div>';
  }

  /** The Fitness Studio's answer for today. window.Pal is already
      loaded here for pal:levels, so this costs nothing extra. */
  function workoutRow() {
    var P = global.Pal;
    if (!P || !P.dayStatus) {
      return { label: 'Workout', status: 'Not loaded', quiet: true, href: 'palaestra.html', action: 'Open' };
    }
    var s = P.dayStatus(d());
    var name = s.planned ? s.planned.name : '';
    if (s.status === 'done') {
      return { label: 'Workout', status: (name || 'Session') + ' · done', done: true, href: 'palaestra.html', action: 'Review' };
    }
    if (s.status === 'rest') {
      return { label: 'Workout', status: 'Rest day', quiet: true, href: 'palaestra.html', action: 'Open' };
    }
    if (s.planned) {
      return { label: 'Workout', status: name, href: 'palaestra-workout.html', action: 'Start' };
    }
    return { label: 'Workout', status: 'Nothing scheduled', quiet: true, href: 'palaestra.html', action: 'Plan' };
  }

  /**
   * The Larder's answer for today.
   *
   * READ-ONLY, AND NOT SYNCED HERE. Main never mounts the `nutrition`
   * or `larderlog` rows and never calls Lar's seed or its two
   * migrations — see rule 4 in this file's header. So these numbers
   * are as fresh as the last time The Larder itself was open on this
   * device, and when there is nothing to read the row says "Nothing
   * logged yet" rather than "0 kcal", which would be a claim.
   */
  function nutritionRow() {
    var L = global.Lar;
    if (!L || !L.totalsFor) {
      return { label: 'Nutrition', status: 'Not loaded', quiet: true, href: 'larder.html', action: 'Open' };
    }
    var t, g, day, logged;
    try {
      t = L.totalsFor(d());
      g = L.getTargets();
      day = L.getDay(d());
      logged = L.logFor(d()).length || !!(day && day.legacy);
    } catch (e) {
      return { label: 'Nutrition', status: 'Not loaded', quiet: true, href: 'larder.html', action: 'Open' };
    }
    if (!logged) {
      return { label: 'Nutrition', status: 'Nothing logged yet', quiet: true, href: 'larder.html', action: 'Log' };
    }
    var water = day && day.water ? (Math.round((day.water / 100)) / 10) + ' L' : null;
    var parts = [
      '<b class="mn-num">' + fmtInt(t.kcal) + '</b> / ' + fmtInt(g.kcal) + ' kcal',
      '<b class="mn-num">' + fmtInt(t.protein) + '</b> g protein'
    ];
    if (water) parts.push('<span class="mn-num">' + water + '</span> water');
    return {
      label: 'Nutrition', statusHtml: parts.join(' <span class="mn-mid">·</span> '),
      done: t.kcal >= g.kcal * 0.9 && t.protein >= g.protein * 0.9,
      href: 'larder.html', action: 'Log'
    };
  }
  function fmtInt(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function renderToday() {
    var host = byId('mnToday');
    if (!host) return;

    var rows = [
      workoutRow(),
      nutritionRow(),
      { label: 'Self-care', status: 'Breath, journal, meditation', quiet: true, href: 'asclepion.html#/routines', action: 'Open' },
      { label: 'Writing', status: 'The Velvet Grimoire', quiet: true, href: 'kdp.html', action: 'Open' },
      { label: 'Evening journal', status: 'Written in the Asclepion', quiet: true, href: 'asclepion-journal.html', action: 'Open' }
    ];
    host.innerHTML = rows.map(rowHtml).join('');
  }

  // ============================================================
  // DAILY ROUTINE
  //
  // Three leaves. The one the clock is in lies open; the other two are
  // shut, and show only their name and their count. That is the whole
  // point of the fold: at eight in the morning the wind-down is not
  // information, it is clutter, and at ten at night the mirror
  // exercise is a reproach.
  // ============================================================
  function renderRoutineHead() {
    var host = byId('mnRoutineHead');
    if (!host) return;
    var date = d();
    var level = T.getLevel(date);
    var chosen = T.hasLevel(date);
    var prog = T.overallProgress(date, level);

    // Eight pips, and they carry the meaning the recitation boxes
    // already established on this page: struck gold is done, unstruck
    // sage is still to come. Not a progress bar, and never a traffic
    // light — Low is not a failed High.
    var filled = Math.round((prog.pct / 100) * 8);
    var pips = '';
    for (var i = 0; i < 8; i++) pips += '<span class="mn-pip' + (i < filled ? ' is-on' : '') + '"></span>';

    var pills = T.LEVEL_KEYS.map(function (k) {
      var c = T.LEVEL_COPY[k];
      var on = k === level;
      return '<button type="button" class="mn-pill" data-act="set-level" data-level="' + k + '"' +
        ' data-level-key="' + k + '" aria-pressed="' + (on ? 'true' : 'false') + '"' +
        ' data-chosen="' + (on && chosen ? 'true' : 'false') + '">' +
        '<span class="mn-pill__name">' + esc(c.name) + '</span>' +
        '<span class="mn-pill__title">' + esc(c.title) + '</span>' +
      '</button>';
    }).join('');

    var counts = T.PHASES.map(function (p) {
      var r = T.phaseProgress(date, p, level);
      return '<span class="mn-count' + (p === currentAuto() ? ' is-now' : '') + '">' +
        esc(T.PHASE_LABEL[p]) + ' <b>' + r.done + '/' + r.total + '</b></span>';
    }).join('');

    host.innerHTML =
      '<div class="mn-effort">' + pills + '</div>' +
      '<div class="mn-meter">' +
        '<span class="mn-meter__pips" aria-hidden="true">' + pips + '</span>' +
        '<span class="mn-meter__pct">' + prog.pct + '%</span>' +
        '<span class="mn-meter__counts">' + counts + '</span>' +
      '</div>' +
      (chosen ? '' :
        '<p class="mn-small mn-label--cool" style="margin-top:12px">Today’s effort has not been chosen — ' +
        'everything below is showing the High version until you pick one.</p>');

    renderMedal();
  }

  function renderMedal() {
    if (!global.MainHero || !global.MainHero.setMedal) return;
    var date = d();
    var level = T.getLevel(date);
    var chosen = T.hasLevel(date);
    var c = T.LEVEL_COPY[level];
    global.MainHero.setMedal({
      lead: chosen ? 'Today' : 'Pick one',
      main: c.name,
      level: level,
      chosen: chosen,
      rim: prettyDate(date),
      label: chosen
        ? 'Today’s effort level is ' + c.name + '. Change it.'
        : 'Choose today’s effort level. Currently showing ' + c.name + '.',
      onClick: function () {
        var el = byId('mnRoutineSection');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function currentAuto() {
    try { return T.currentPhase(); } catch (e) { return 'morning'; }
  }

  /** The three leaves, shell only. Bodies are filled per phase. */
  function renderLeaves() {
    var host = byId('mnLeaves');
    if (!host) return;
    host.innerHTML = T.PHASES.map(function (p) {
      return '<section class="mn-leaf" data-phase="' + p + '">' +
        '<button type="button" class="mn-leaf__tab" data-act="fold" data-phase="' + p + '"' +
          ' aria-expanded="false" aria-controls="mnPhase_' + p + '">' +
          '<span class="mn-leaf__mark" aria-hidden="true"></span>' +
          '<span class="mn-leaf__name">' + esc(T.PHASE_LABEL[p]) + '</span>' +
          '<span class="mn-leaf__now">Now</span>' +
          '<span class="mn-leaf__rule" aria-hidden="true"></span>' +
          '<span class="mn-leaf__count" data-count="' + p + '"></span>' +
        '</button>' +
        '<div class="mn-leaf__body" id="mnPhase_' + p + '"></div>' +
      '</section>';
    }).join('');
    T.PHASES.forEach(renderPhase);
    applyFold();
  }

  function renderPhase(phase) {
    var host = byId('mnPhase_' + phase);
    if (!host) return;
    // NOT editable. Adding, reordering and rewriting steps is what
    // routine.html is for, and "Manage" at the head of this section is
    // the way there. An empty Day phase is the one exception, and it
    // handles itself — emptyPhaseHtml() offers its suggestions and a
    // "Write your own" regardless of this flag, because a part of the
    // day with no steps and no way in is a dead end.
    host.innerHTML = R.phaseHtml(phase, { compact: true, editable: false });

    var level = T.getLevel();
    var p = T.phaseProgress(d(), phase, level);
    var badge = document.querySelector('[data-count="' + phase + '"]');
    if (badge) badge.innerHTML = p.done + ' <span class="mn-mid">/</span> ' + p.total;
  }

  /** Class toggles only. No render, no storage read beyond the clock. */
  function applyFold() {
    var now = currentAuto();
    T.PHASES.forEach(function (p) {
      var leaf = document.querySelector('.mn-leaf[data-phase="' + p + '"]');
      if (!leaf) return;
      var open = !!openPhases[p];
      leaf.classList.toggle('is-open', open);
      leaf.classList.toggle('is-now', p === now);
      var tab = leaf.querySelector('.mn-leaf__tab');
      if (tab) tab.setAttribute('aria-expanded', open ? 'true' : 'false');
      var body = leaf.querySelector('.mn-leaf__body');
      if (body) body.hidden = !open;
    });
  }

  /**
   * The minute tick. Two text nodes and, when the hour has crossed a
   * boundary, one set of class toggles. It never renders and never
   * reads the routine — see rule 3.
   */
  function tick() {
    renderClock();
    var now = currentAuto();
    if (now === lastAutoPhase) return;
    lastAutoPhase = now;
    if (!foldTouched) {
      openPhases = {};
      openPhases[now] = true;
    }
    applyFold();
  }

  // ============================================================
  // CONTINUE
  //
  // Written by topbar.js, on every page, and only for a visit where
  // something in that app's own storage actually changed — see the
  // recorder's comment there. Reading it here is deliberately dumb:
  // if the file is missing or malformed the section simply says so.
  //
  // `recent:` is local-only and matches no synced prefix, so this is
  // what you were doing ON THIS DEVICE. That is the only version of
  // the question that has an honest answer.
  // ============================================================
  function recentList() {
    try {
      var raw = JSON.parse(localStorage.getItem('recent:log') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }

  function ago(ts) {
    var mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 10) return hrs + 'h ago';
    var then = new Date(ts);
    var days = Math.round((new Date(new Date().toDateString()) - new Date(then.toDateString())) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return then.toLocaleDateString(undefined, { weekday: 'long' });
    return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function renderContinue() {
    var host = byId('mnContinue');
    if (!host || !N) return;

    var rows = recentList()
      .filter(function (r) { return r && r.href && r.href.indexOf('index.html') !== 0; })
      .slice(0, 5);

    if (!rows.length) {
      host.innerHTML = '<p class="mn-small mn-empty--inline">Nothing yet. A page appears here once you have ' +
        'changed something on it — opening one and leaving again does not count.</p>';
      return;
    }

    host.innerHTML = rows.map(function (r) {
      var page = N.byHref(r.href);
      var name = (page && page.name) || r.title || r.href;
      var sub = N.routeLabel(r.href, r.hash) || r.sub || '';
      return '<button type="button" class="mn-resume" data-act="go" data-href="' + esc(r.href + (r.hash ? '#' + r.hash.replace(/^#/, '') : '')) + '">' +
        '<span class="mn-resume__ribbon" aria-hidden="true"></span>' +
        '<span class="mn-resume__name">' + esc(name) + '</span>' +
        (sub ? '<span class="mn-resume__sub">' + esc(sub) + '</span>' : '') +
        '<span class="mn-resume__leader" aria-hidden="true"></span>' +
        '<span class="mn-resume__at">' + esc(ago(r.at || 0)) + '</span>' +
      '</button>';
    }).join('');
  }

  // ============================================================
  // EXPLORE — the back-of-book index. Links, rules, nothing else.
  // ============================================================
  function renderExplore() {
    var host = byId('mnExplore');
    if (!host || !N) return;
    host.innerHTML = N.GROUPS.map(function (g) {
      var items = N.group(g.key);
      if (!items.length) return '';
      return '<div class="mn-index">' +
        '<h3 class="mn-plate mn-plate--sm">' + esc(g.label) + '</h3>' +
        '<hr class="mn-rule mn-rule--tight">' +
        '<ul class="mn-index__list">' + items.map(function (p) {
          return '<li><button type="button" class="mn-index__link" data-act="go" data-href="' + esc(p.href) + '">' +
            esc(p.name) + '</button></li>';
        }).join('') + '</ul>' +
      '</div>';
    }).join('');
  }

  // ============================================================
  // SEARCH
  //
  // Destinations only — pages and their own sections. It does not read
  // any other app's records; see main-nav.js's search() for why.
  // ============================================================
  function renderSearch() {
    var input = byId('mnSearch');
    var out = byId('mnSearchOut');
    if (!input || !out || !N) return;
    var q = input.value.trim();
    var hits = N.search(q, 8);

    // Today's own steps are on this page, so they belong in its search.
    if (q) {
      var lower = q.toLowerCase();
      T.Routines.list().forEach(function (s) {
        if (s.title.toLowerCase().indexOf(lower) === -1) return;
        hits.push({ href: '#routine', title: s.title, sub: T.PHASE_LABEL[s.phase] + ' routine', icon: 'sun', phase: s.phase });
      });
      hits = hits.slice(0, 8);
    }

    searchIndex = hits.length ? 0 : -1;
    if (!q) { out.hidden = true; out.innerHTML = ''; return; }

    out.hidden = false;
    out.innerHTML = hits.length
      ? hits.map(function (h, i) {
          return '<button type="button" class="mn-hit' + (i === 0 ? ' is-on' : '') + '" role="option"' +
            ' data-act="hit" data-href="' + esc(h.href) + '"' + (h.phase ? ' data-phase="' + h.phase + '"' : '') + '>' +
            '<span class="mn-hit__ico">' + N.icon(h.icon) + '</span>' +
            '<span class="mn-hit__title">' + esc(h.title) + '</span>' +
            '<span class="mn-hit__sub">' + esc(h.sub || '') + '</span>' +
          '</button>';
        }).join('')
      : '<p class="mn-hit__none">Nothing here by that name.</p>';
  }

  function moveSearch(delta) {
    var out = byId('mnSearchOut');
    if (!out || out.hidden) return;
    var hits = out.querySelectorAll('.mn-hit');
    if (!hits.length) return;
    searchIndex = (searchIndex + delta + hits.length) % hits.length;
    Array.prototype.forEach.call(hits, function (h, i) { h.classList.toggle('is-on', i === searchIndex); });
    hits[searchIndex].scrollIntoView({ block: 'nearest' });
  }
  function takeSearch() {
    var out = byId('mnSearchOut');
    if (!out || out.hidden) return;
    var hit = out.querySelectorAll('.mn-hit')[searchIndex];
    if (hit) hit.click();
  }
  function closeSearch() {
    var out = byId('mnSearchOut');
    if (out) { out.hidden = true; out.innerHTML = ''; }
    searchIndex = -1;
  }

  // ============================================================
  // SETTINGS
  // ============================================================
  function openSettings() {
    var sch = T.getSchedule();
    var chosen = T.getSettings().quickLaunch;
    var active = N.quickLaunch(chosen).map(function (p) { return p.id; });

    var bg = byId('mnSheetBg'), sheet = byId('mnSheet');
    if (!bg || !sheet) return;
    sheet.innerHTML =
      '<div class="mn-sheet__head">' +
        '<h3 class="mn-plate mn-plate--md">Settings</h3>' +
        '<button type="button" class="bs-modal-close" data-act="close-sheet" aria-label="Close">&#10005;</button>' +
      '</div>' +

      '<p class="mn-label">The shape of the day</p>' +
      '<p class="mn-small" style="margin-bottom:10px">Each part of the routine counts forward from its own time. ' +
        'These also decide which part of it lies open when you arrive.</p>' +
      '<div class="mn-grid3">' +
        T.PHASES.map(function (p) {
          return '<div class="mn-field"><label class="mn-label" for="set_' + p + '">' + esc(T.PHASE_START_LABEL[p]) + '</label>' +
            '<input type="time" class="mn-input" id="set_' + p + '" data-act="set-anchor" data-phase="' + p + '" value="' + esc(T.phaseStart(p)) + '"></div>';
        }).join('') +
      '</div>' +

      '<p class="mn-label" style="margin-top:24px">Quick Launch</p>' +
      '<p class="mn-small" style="margin-bottom:10px">Pick up to eight. They appear in the order you see here.</p>' +
      '<div class="mn-picker">' + N.PAGES.map(function (p) {
        var on = active.indexOf(p.id) !== -1;
        return '<label class="mn-picker__row' + (on ? ' is-on' : '') + '">' +
          '<input type="checkbox" class="mn-check" data-act="pick" data-pid="' + p.id + '"' + (on ? ' checked' : '') + '>' +
          '<span class="mn-picker__name">' + esc(p.name) + '</span>' +
          '<span class="mn-picker__sub">' + esc(p.sub) + '</span>' +
        '</label>';
      }).join('') + '</div>' +

      '<p class="mn-label" style="margin-top:24px">Continue</p>' +
      '<p class="mn-small" style="margin-bottom:10px">Kept on this device only — it is never synced, and it never leaves it.</p>' +
      '<button type="button" class="mn-btn" data-act="clear-recent">Clear the list</button>' +

      '<p class="mn-label" style="margin-top:24px">Backup</p>' +
      '<p class="mn-small" style="margin-bottom:10px">Downloads everything Main and the Fitness Studio hold, as one JSON file.</p>' +
      '<button type="button" class="mn-btn" data-act="download">Download a copy</button>' +

      '<div class="mn-sheet__actions">' +
        '<button type="button" class="mn-btn" data-act="go" data-href="routine.html" style="margin-right:auto">Edit the routine</button>' +
        '<button type="button" class="mn-btn mn-btn--primary" data-act="close-sheet">Done</button>' +
      '</div>';

    bg.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    var bg = byId('mnSheetBg');
    if (!bg) return;
    bg.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function togglePick(id, on) {
    var cur = N.quickLaunch(T.getSettings().quickLaunch).map(function (p) { return p.id; });
    var i = cur.indexOf(id);
    if (on && i === -1) {
      if (cur.length >= 8) { toast('Eight is the limit. Take one off first.', true); return false; }
      cur.push(id);
    } else if (!on && i !== -1) {
      cur.splice(i, 1);
    }
    T.saveSettings({ quickLaunch: cur });
    renderQuick();
    return true;
  }

  // ============================================================
  // RENDER + WIRE
  // ============================================================
  function renderAll() {
    renderClock();
    renderQuick();
    renderToday();
    renderRoutineHead();
    renderLeaves();
    renderContinue();
    renderExplore();
    if (global.MainHero) global.MainHero.measure();
  }

  /** What routine-ui.js asks for when it has changed something. */
  function rerender(what) {
    if (what === 'progress') { renderRoutineHead(); return; }
    if (what === 'record') { return; }          // the record lives on routine.html
    if (what.indexOf('phase:') === 0) {
      var phase = what.slice(6);
      renderPhase(phase);
      // A step can appear in a phase that was empty a moment ago, so
      // the fold state has to be re-applied to the new markup.
      applyFold();
      return;
    }
  }

  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');

    // Main's own actions first, then the routine's. The two tables are
    // disjoint; anything not claimed here is offered to RoutineUI.
    switch (act) {
      case 'go':
        e.preventDefault();
        go(el.getAttribute('data-href'));
        return;

      case 'hit': {
        e.preventDefault();
        var href = el.getAttribute('data-href');
        closeSearch();
        var input = byId('mnSearch');
        if (input) input.value = '';
        if (href === '#routine') {
          // A step of today's own routine: open its leaf and go to it
          // rather than leaving the page.
          var phase = el.getAttribute('data-phase');
          foldTouched = true;
          openPhases[phase] = true;
          applyFold();
          var sec = byId('mnRoutineSection');
          if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        go(href);
        return;
      }

      case 'set-level': {
        var lvl = el.getAttribute('data-level');
        T.setLevel(d(), lvl);
        renderRoutineHead();
        T.PHASES.forEach(renderPhase);
        applyFold();
        toast(T.LEVEL_COPY[lvl].name + ' · ' + T.LEVEL_COPY[lvl].title);
        return;
      }

      case 'fold': {
        var p = el.getAttribute('data-phase');
        foldTouched = true;
        openPhases[p] = !openPhases[p];
        applyFold();
        return;
      }

      case 'settings': openSettings(); return;
      case 'clear-recent':
        try { localStorage.removeItem('recent:log'); } catch (er) {}
        renderContinue();
        toast('Continue cleared');
        return;
      case 'download':
        if (global.MainSync && global.MainSync.download) global.MainSync.download(['goals', 'palaestra']);
        return;
      case 'close-sheet': closeSheet(); return;
    }

    if (R.onClick(e)) return;
  }

  function onInput(e) {
    if (e.target && e.target.id === 'mnSearch') { renderSearch(); return; }
    R.onInput(e);
  }

  function onChange(e) {
    var el = e.target.closest('[data-act]');
    if (el) {
      var act = el.getAttribute('data-act');
      if (act === 'set-anchor') {
        T.savePhaseStart(el.getAttribute('data-phase'), el.value);
        renderPhase(el.getAttribute('data-phase'));
        renderRoutineHead();
        lastAutoPhase = null;   // the boundaries moved; let tick() re-decide
        tick();
        return;
      }
      if (act === 'pick') {
        if (!togglePick(el.getAttribute('data-pid'), el.checked)) el.checked = !el.checked;
        el.closest('.mn-picker__row').classList.toggle('is-on', el.checked);
        return;
      }
    }
    R.onChange(e);
  }

  // The hero's copy. main-hero.js builds the frontispiece empty and
  // fills it from here, once — setScene is guarded by key, so a cloud
  // repaint cannot replay a full-screen entrance.
  //
  // The words did not change when Main became a hub, because the thing
  // they describe did not: the effort level is still the one decision
  // the whole page hangs off, it is still made before anything else,
  // and it still sets the workout, the meditation and the shape of the
  // routine below.
  var SCENE = {
    key: 'today',
    eyebrow: 'The morning call sheet',
    lines: ['Decide what', 'you are capable', 'of today'],
    note: 'One answer, before anything else. It sets the workout, the meditation, and how much of yourself the day is allowed to ask for.'
  };

  function boot() {
    T = global.TodayData;
    R = global.RoutineUI;
    N = global.MainNav;
    if (!T || !R || !N) return;

    if (global.MainHero && global.MainHero.setScene) global.MainHero.setScene(SCENE);

    R.configure({ toast: toast, go: go, debounce: debounce, rerender: rerender });

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);

    document.addEventListener('keydown', function (e) {
      var input = byId('mnSearch');
      var inSearch = document.activeElement === input;

      if (e.key === 'Escape') {
        if (inSearch) { input.value = ''; closeSearch(); input.blur(); return; }
        closeSheet();
        R.closeSheet();
        return;
      }
      if (inSearch) {
        if (e.key === 'ArrowDown') { e.preventDefault(); moveSearch(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveSearch(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); takeSearch(); }
        return;
      }
      // `/` and Ctrl-K reach the field from anywhere that is not
      // already a field — typing a slash into a note must stay a slash.
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
      if (!typing && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
        e.preventDefault();
        if (input) { input.focus(); input.select(); }
      }
    });

    document.addEventListener('click', function (e) {
      var out = byId('mnSearchOut');
      if (out && !out.hidden && !e.target.closest('.mn-head__search')) closeSearch();
    });

    var bg = byId('mnSheetBg');
    if (bg) bg.addEventListener('mousedown', function (e) { if (e.target === bg) { closeSheet(); R.closeSheet(); } });

    // A write that has not committed must not be lost to a navigation.
    global.addEventListener('pagehide', flushSaves);

    // The clock decides the opening fold. From here the reader can
    // override it and the tick stops interfering.
    lastAutoPhase = currentAuto();
    openPhases[lastAutoPhase] = true;

    renderAll();
    setInterval(tick, 60000);
  }

  global.TodayUI = {
    boot: boot,
    renderAll: renderAll,
    renderPhase: renderPhase,
    go: go,
    toast: toast
  };
})(window);
