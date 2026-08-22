// =============================================================
// weeklyreview-ui.js — the Sunday review.
//
// One week at a time, navigable backwards. The top half is what
// happened, read from the live sources; the bottom half is what you
// make of it, which is the only part you type.
//
// The numbers come first on purpose. A review that opens with a blank
// "how did the week go?" box gets answered from mood; one that opens
// with five effort levels, four workouts and eleven pieces of
// evidence gets answered from the week.
// =============================================================

(function (global) {
  'use strict';

  var W = null;
  var weekStart = null;
  var saveTimers = {};

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function byId(id) { return document.getElementById(id); }
  function debounce(k, fn, ms) { clearTimeout(saveTimers[k]); saveTimers[k] = setTimeout(fn, ms == null ? 600 : ms); }
  function flushSaves() { Object.keys(saveTimers).forEach(function (k) { clearTimeout(saveTimers[k]); }); saveTimers = {}; }
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
    t._t = setTimeout(function () { t.className = 'mn-toast'; }, bad ? 5000 : 2400);
  }
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // ------------------------------------------------------------
  // THE WEEK
  // ------------------------------------------------------------
  function renderHeader() {
    var r = W.forWeek(weekStart);
    var done = !!(r && r.completedAt);
    var isThis = weekStart === W.weekStartOf(W.todayISO());

    byId('wrHeader').innerHTML =
      '<div class="mn-section__head">' +
        '<h2 class="mn-plate mn-plate--lg">' + esc(W.weekKeyOf(weekStart)) + '</h2>' +
        '<div class="mn-section__aside">' +
          '<button type="button" class="mn-btn mn-btn--sm mn-btn--icon" data-act="prev-week" aria-label="Previous week">&#8249;</button>' +
          '<span class="mn-label">' + esc(W.prettyRange(weekStart)) + '</span>' +
          '<button type="button" class="mn-btn mn-btn--sm mn-btn--icon" data-act="next-week" aria-label="Next week"' +
            (isThis ? ' disabled' : '') + '>&#8250;</button>' +
          (done ? '<span class="bs-tag is-accent">Finished</span>' : '') +
        '</div>' +
      '</div><hr class="mn-rule">';

    if (global.MainHero) {
      global.MainHero.setMedal({
        lead: done ? 'Finished' : 'This week',
        main: W.weekKeyOf(weekStart).replace(/^\d+-/, ''),
        level: done ? 'high' : 'mid',
        chosen: done,
        rim: W.prettyRange(weekStart),
        label: 'Week ' + W.weekKeyOf(weekStart),
        onClick: function () {
          var el = byId('wrWrite');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  function renderWeek() {
    var snap = W.snapshotFor(weekStart);
    var r = W.forWeek(weekStart);
    var frozen = !!(r && r.completedAt);
    var c = snap.levelCounts;
    var rt = snap.routine;
    var mPct = rt.morningTotal ? Math.round(rt.morningDone / rt.morningTotal * 100) : 0;
    var ePct = rt.eveningTotal ? Math.round(rt.eveningDone / rt.eveningTotal * 100) : 0;

    byId('wrWeek').innerHTML =
      '<div class="mn-grid3" style="margin-bottom:var(--mn-5)">' +
        tile(c.high + c.mid + c.low, 'Days answered', c.unset ? c.unset + ' left blank' : 'All seven') +
        tile(mPct + '%', 'Morning kept', rt.morningDone + ' of ' + rt.morningTotal) +
        tile(snap.workouts.length, 'Workouts', rt.frogDays + ' frog day' + (rt.frogDays === 1 ? '' : 's')) +
      '</div>' +

      '<div class="wr-week">' + rt.byDay.map(function (d, i) {
        var lvl = d.level || 'none';
        return '<div class="wr-day" data-level="' + esc(lvl) + '">' +
          '<span class="wr-day__dow">' + DOW[i] + '</span>' +
          '<span class="wr-day__level">' + (d.level ? d.level.toUpperCase() : '—') + '</span>' +
          '<span class="wr-day__bars">' +
            '<span class="wr-day__bar" title="Morning">' + (d.morning || 0) + '</span>' +
            '<span class="wr-day__bar" title="Evening">' + (d.evening || 0) + '</span>' +
          '</span>' +
          (d.frog ? '<span class="wr-day__frog" title="Frog started">&#9679;</span>' : '<span class="wr-day__frog is-off"></span>') +
        '</div>';
      }).join('') + '</div>' +

      '<div class="mn-grid2" style="margin-top:var(--mn-5)">' +
        '<div class="mn-card">' +
          '<p class="mn-plate mn-plate--sm" style="margin-bottom:16px">Workouts</p>' +
          (snap.workouts.length
            ? '<ul class="fs-list">' + snap.workouts.map(function (w) {
                return '<li>' + esc(w.name || w.type || 'Session') +
                  (w.level ? ' <span class="bs-tag">' + esc(w.level.toUpperCase()) + '</span>' : '') +
                  (w.durationMin ? ' <span class="mn-label">' + w.durationMin + ' min</span>' : '') + '</li>';
              }).join('') + '</ul>'
            : '<p class="mn-small">Nothing logged in the Fitness Studio this week.</p>') +
        '</div>' +
        '<div class="mn-card">' +
          '<p class="mn-plate mn-plate--sm" style="margin-bottom:16px">Evidence</p>' +
          (snap.evidence.length
            ? '<ul class="fs-list fs-list--warm">' + snap.evidence.map(function (e) {
                return '<li>' + esc(e.text) + '</li>';
              }).join('') + '</ul>'
            : '<p class="mn-small">Nothing logged in Future Self this week.</p>') +
        '</div>' +
      '</div>' +

      (frozen
        ? '<p class="mn-small" style="margin-top:16px">These numbers were frozen when the review was finished, so they cannot drift as the sources age out.</p>'
        : '<p class="mn-small" style="margin-top:16px">Live. They will be frozen when you finish the review.</p>');
  }

  function tile(v, label, note) {
    return '<div class="mn-card">' +
      '<div class="mn-fig mn-fig--lg">' + esc(v) + '</div>' +
      '<p class="mn-label" style="margin-top:10px">' + esc(label) + '</p>' +
      (note ? '<p class="mn-small" style="margin-top:4px">' + esc(note) + '</p>' : '') +
      '</div>';
  }

  // ------------------------------------------------------------
  // WHAT YOU MAKE OF IT
  // ------------------------------------------------------------
  var WRITE_FIELDS = [
    ['wins', 'What went well', 'The things worth repeating.'],
    ['misses', 'What did not', 'Without the flogging. Just what happened.'],
    ['lessons', 'What I learned', ''],
    ['energyNote', 'How the week felt', 'Energy, sleep, mood — the context the numbers do not carry.'],
    ['nextWeekFocus', 'Next week, one thing', 'One. Not five.']
  ];

  function renderWrite() {
    var r = W.ensure(weekStart);
    var done = !!r.completedAt;

    byId('wrWrite').innerHTML =
      '<div class="mn-section__head">' +
        '<h2 class="mn-plate mn-plate--lg">The review</h2>' +
        '<div class="mn-section__aside">' +
          (done
            ? '<span class="mn-label mn-label--gold">Finished ' + esc(new Date(r.completedAt).toLocaleDateString()) + '</span>' +
              '<button type="button" class="mn-btn mn-btn--sm mn-btn--ghost" data-act="reopen">Reopen</button>'
            : '') +
        '</div>' +
      '</div><hr class="mn-rule">' +
      '<div class="mn-stack">' + WRITE_FIELDS.map(function (f) {
        return '<div class="mn-field">' +
          '<label class="mn-label" for="wr_' + f[0] + '">' + esc(f[1]) + '</label>' +
          (f[2] ? '<p class="mn-small" style="margin:-2px 0 4px">' + esc(f[2]) + '</p>' : '') +
          '<textarea class="mn-textarea" id="wr_' + f[0] + '" data-act="write" data-f="' + f[0] + '" rows="3"' +
            (done ? ' readonly' : '') + '>' + esc(r[f[0]]) + '</textarea>' +
          '</div>';
      }).join('') + '</div>' +

      (done
        ? ''
        : '<div class="mn-card mn-card--raised" style="margin-top:var(--mn-5)">' +
            '<p class="mn-plate mn-plate--sm">One line of evidence</p>' +
            '<p class="mn-small" style="margin-top:8px">The single thing this week proved about the person you are becoming. It goes into Future Self&rsquo;s evidence feed — the only thing this page writes anywhere else.</p>' +
            '<textarea class="mn-textarea" id="wrEvidence" rows="2" style="margin-top:14px" placeholder="This week I&hellip;"></textarea>' +
            '<div class="mn-row" style="margin-top:16px">' +
              '<button type="button" class="mn-btn mn-btn--primary" data-act="finish">Finish the week</button>' +
            '</div>' +
          '</div>');
  }

  function renderPast() {
    var all = W.newestFirst().filter(function (r) { return r.weekStart !== weekStart && r.completedAt; });
    byId('wrPast').innerHTML =
      '<div class="mn-section__head"><h2 class="mn-plate mn-plate--lg">Earlier weeks</h2></div><hr class="mn-rule">' +
      (all.length
        ? '<div class="mn-stack--tight" style="display:flex;flex-direction:column">' + all.slice(0, 20).map(function (r) {
            return '<button type="button" class="bs-card" data-act="open-week" data-week="' + esc(r.weekStart) + '" style="text-align:left;cursor:pointer">' +
              '<div class="mn-row mn-row--between">' +
                '<span class="bs-card-title">' + esc(r.weekKey) + '</span>' +
                '<span class="mn-label">' + esc(W.prettyRange(r.weekStart)) + '</span>' +
              '</div>' +
              (r.nextWeekFocus ? '<div class="bs-card-body">' + esc(r.nextWeekFocus) + '</div>' : '') +
            '</button>';
          }).join('') + '</div>'
        : '<div class="mn-empty">No finished reviews yet.</div>');
  }

  // ------------------------------------------------------------
  // EVENTS
  // ------------------------------------------------------------
  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    switch (el.getAttribute('data-act')) {
      case 'prev-week': weekStart = W.shiftWeek(weekStart, -1); renderAll(); break;
      case 'next-week': {
        var next = W.shiftWeek(weekStart, 1);
        if (next > W.weekStartOf(W.todayISO())) break;
        weekStart = next; renderAll(); break;
      }
      case 'open-week': weekStart = el.getAttribute('data-week'); renderAll(); break;
      case 'go': e.preventDefault(); go(el.getAttribute('data-href')); break;
      case 'reopen': {
        if (!confirm('Reopen this week? Its numbers go back to being live and will move as the sources change.')) break;
        W.reopen(weekStart); renderAll(); toast('Reopened'); break;
      }
      case 'finish': {
        flushSaves();
        // Flush the text fields first — the debounce would otherwise
        // still be pending when the record is frozen.
        WRITE_FIELDS.forEach(function (f) {
          var n = byId('wr_' + f[0]);
          if (n) { var p = {}; p[f[0]] = n.value; W.update(weekStart, p); }
        });
        var ev = byId('wrEvidence');
        W.complete(weekStart, ev ? ev.value : '');
        renderAll();
        toast('Week finished — the numbers are frozen');
        break;
      }
    }
  }

  function onInput(e) {
    var el = e.target.closest('[data-act="write"]');
    if (!el) return;
    var f = el.getAttribute('data-f');
    debounce('w' + f, function () { var p = {}; p[f] = el.value; W.update(weekStart, p); });
  }

  function renderAll() {
    renderHeader();
    renderWeek();
    renderWrite();
    renderPast();
    if (global.MainHero) global.MainHero.measure();
  }

  function boot() {
    W = global.WeeklyReviewData;
    if (!W) return;
    weekStart = W.weekStartOf(W.todayISO());
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    global.addEventListener('pagehide', flushSaves);

    if (global.MainHero) {
      global.MainHero.setScene({
        key: 'weeklyreview', index: 0,
        eyebrow: 'Sunday',
        lines: ['Look at', 'the week', 'you actually had'],
        note: 'The numbers first, then what you make of them. Everything on this dashboard reports in here.'
      });
    }
    renderAll();
  }

  global.WeeklyReviewUI = { boot: boot, renderAll: renderAll, go: go };
})(window);
