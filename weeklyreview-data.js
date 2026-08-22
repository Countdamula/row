// =============================================================
// weeklyreview-data.js — the Sunday review.
//
// Prefix `wr:`, riding the `goals` row (see main-sync.js). It gets no
// row of its own because weeklyreview.html has to mount `goals`
// anyway — it reads `routine:` and `today:` — so a fourth row would
// buy nothing and cost a fourth Realtime channel.
//
// ─────────────────────────────────────────────────────────────
// THE SNAPSHOT IS LIVE UNTIL IT IS FINISHED, THEN FROZEN FOREVER.
//
// While a review is open its numbers are recomputed from the live
// sources on every render. The instant completedAt is set they are
// written into the record and never recomputed again.
//
// Without that, last month's review silently rewrites itself as its
// sources age out — pal:levels trims at 730 entries and today:log
// does the same — and a review whose numbers change after you wrote
// your conclusions underneath them is worse than no review.
// ─────────────────────────────────────────────────────────────
//
// IT WRITES BACK EXACTLY ONE THING: a line into fs:evidence, tagged
// source:'weeklyreview'. That single write is what makes "everything
// connects to it" true in both directions, and keeping it to one
// write keeps the blast radius small. Everything else it touches —
// pal:levels, pal:sessions, today:log, routine:log — is READ ONLY.
// =============================================================

(function (global) {
  'use strict';

  var KEYS = {
    reviews:  'wr:reviews',
    settings: 'wr:settings'
  };

  function storeGet(k, f) {
    try { var r = localStorage.getItem(k); return r == null ? f : JSON.parse(r); }
    catch (e) { return f; }
  }
  function storeSet(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      try { global.dispatchEvent(new CustomEvent('wr:save', { detail: { key: k, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { global.dispatchEvent(new CustomEvent('wr:save', { detail: { key: k, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function s(v) { return v == null ? '' : String(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayISO() { return iso(new Date()); }
  function parseISO(str) {
    var p = String(str).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  // ------------------------------------------------------------
  // WEEKS
  //
  // Monday-first, because a review written on Sunday is about the week
  // that just ended, and a Sunday-first week would put the day you are
  // writing on at the START of the week you are reviewing.
  // ------------------------------------------------------------
  function weekStartOf(dateStr) {
    var d = parseISO(dateStr || todayISO());
    var dow = (d.getDay() + 6) % 7;       // 0 = Monday
    d.setDate(d.getDate() - dow);
    return iso(d);
  }
  function weekDates(startStr) {
    var out = [], d = parseISO(startStr), i;
    for (i = 0; i < 7; i++) { out.push(iso(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  function weekEndOf(startStr) { return weekDates(startStr)[6]; }
  /** ISO-8601 week key, e.g. 2026-W34. */
  function weekKeyOf(startStr) {
    var d = parseISO(startStr);
    var target = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3);
    var firstThursday = new Date(target.getFullYear(), 0, 4);
    var diff = target - firstThursday;
    var week = 1 + Math.round(diff / 604800000);
    return target.getFullYear() + '-W' + String(week).padStart(2, '0');
  }
  function shiftWeek(startStr, weeks) {
    var d = parseISO(startStr);
    d.setDate(d.getDate() + weeks * 7);
    return iso(d);
  }
  function prettyRange(startStr) {
    var a = parseISO(startStr), b = parseISO(weekEndOf(startStr));
    var opts = { day: 'numeric', month: 'long' };
    return a.toLocaleDateString(undefined, opts) + ' – ' + b.toLocaleDateString(undefined, opts);
  }

  // ------------------------------------------------------------
  // THE SNAPSHOT — computed from the live sources, READ ONLY.
  // ------------------------------------------------------------
  function computeSnapshot(startStr) {
    var dates = weekDates(startStr);
    var inWeek = function (d) { return dates.indexOf(d) !== -1; };

    // --- effort levels (pal:levels, owned by the Fitness Studio) ---
    var allLevels = storeGet('pal:levels', {}) || {};
    var levels = {}, counts = { high: 0, mid: 0, low: 0, unset: 0 };
    dates.forEach(function (d) {
      var v = allLevels[d];
      if (v === 'high' || v === 'mid' || v === 'low') { levels[d] = v; counts[v]++; }
      else { levels[d] = null; counts.unset++; }
    });

    // --- routines (today:log + today:routines) ---
    var todayLog = storeGet('today:log', {}) || {};
    var steps = arr(storeGet('today:routines', []));
    var morningIds = steps.filter(function (x) { return x.phase !== 'evening'; }).map(function (x) { return x.id; });
    var eveningIds = steps.filter(function (x) { return x.phase === 'evening'; }).map(function (x) { return x.id; });

    var routine = { morningDone: 0, morningTotal: 0, eveningDone: 0, eveningTotal: 0, frogDays: 0, byDay: [] };
    var ritualLog = storeGet('routine:log', {}) || {};

    dates.forEach(function (d) {
      var day = todayLog[d] || {};
      var done = day.steps || {};
      var m = morningIds.filter(function (id) { return done[id]; }).length;
      var e = eveningIds.filter(function (id) { return done[id]; }).length;
      var frog = !!(ritualLog[d] && ritualLog[d].frog);
      routine.morningDone += m;
      routine.eveningDone += e;
      routine.morningTotal += morningIds.length;
      routine.eveningTotal += eveningIds.length;
      if (frog) routine.frogDays++;
      routine.byDay.push({ date: d, morning: m, evening: e, frog: frog, level: levels[d] });
    });

    // --- workouts (pal:sessions) ---
    var sessions = arr(storeGet('pal:sessions', []))
      .filter(function (x) { return x && inWeek(x.date) && x.status === 'done'; })
      .map(function (x) {
        return {
          date: s(x.date), name: s(x.name), type: s(x.type), level: s(x.level),
          durationMin: x.elapsedSec ? Math.round(x.elapsedSec / 60) : 0
        };
      })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    // --- evidence (fs:evidence) ---
    var evidence = arr(storeGet('fs:evidence', []))
      .filter(function (x) { return x && inWeek(x.date); })
      .map(function (x) { return { id: s(x.id), date: s(x.date), text: s(x.text) }; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    return {
      levels: levels, levelCounts: counts,
      routine: routine, workouts: sessions, evidence: evidence,
      computedAt: Date.now()
    };
  }

  // ------------------------------------------------------------
  // REVIEWS
  // ------------------------------------------------------------
  function reviewModel(r) {
    r = r || {};
    return {
      id: r.id || uid('wr'),
      weekStart: s(r.weekStart),
      weekEnd: s(r.weekEnd) || weekEndOf(r.weekStart),
      weekKey: s(r.weekKey) || weekKeyOf(r.weekStart),
      wins: s(r.wins),
      misses: s(r.misses),
      lessons: s(r.lessons),
      nextWeekFocus: s(r.nextWeekFocus),
      energyNote: s(r.energyNote),
      snapshot: r.snapshot && typeof r.snapshot === 'object' ? r.snapshot : null,
      completedAt: r.completedAt || null,
      createdAt: r.createdAt || Date.now(),
      updatedAt: r.updatedAt || 0
    };
  }

  function list() { return arr(storeGet(KEYS.reviews, [])).map(reviewModel); }
  function replaceAll(a) { return storeSet(KEYS.reviews, arr(a).map(reviewModel)); }
  function newestFirst() {
    return list().sort(function (a, b) { return a.weekStart < b.weekStart ? 1 : -1; });
  }
  function forWeek(startStr) {
    return list().find(function (r) { return r.weekStart === startStr; }) || null;
  }

  /** The record for a week, created on first touch. */
  function ensure(startStr) {
    var r = forWeek(startStr);
    if (r) return r;
    var all = list();
    r = reviewModel({ weekStart: startStr, weekEnd: weekEndOf(startStr), weekKey: weekKeyOf(startStr) });
    all.push(r);
    replaceAll(all);
    return r;
  }

  function update(startStr, patch) {
    var all = list(), i = all.findIndex(function (x) { return x.weekStart === startStr; });
    if (i < 0) { ensure(startStr); all = list(); i = all.findIndex(function (x) { return x.weekStart === startStr; }); }
    all[i] = reviewModel(Object.assign({}, all[i], patch, { updatedAt: Date.now() }));
    replaceAll(all);
    return all[i];
  }

  /**
   * The numbers to render for a week. A finished review returns its
   * frozen copy; an unfinished one is recomputed live.
   */
  function snapshotFor(startStr) {
    var r = forWeek(startStr);
    if (r && r.completedAt && r.snapshot) return r.snapshot;
    return computeSnapshot(startStr);
  }

  /**
   * Finish a review: freeze the snapshot, stamp completedAt, and write
   * the ONE line back into Future Self's evidence feed.
   */
  function complete(startStr, evidenceText) {
    var snap = computeSnapshot(startStr);
    var r = update(startStr, { snapshot: snap, completedAt: Date.now() });

    if (s(evidenceText).trim() && global.FutureSelfData && global.FutureSelfData.addEvidence) {
      global.FutureSelfData.addEvidence(s(evidenceText).trim(), {
        date: weekEndOf(startStr),
        source: 'weeklyreview'
      });
    }
    return r;
  }

  function reopen(startStr) { return update(startStr, { completedAt: null }); }
  function remove(startStr) {
    replaceAll(list().filter(function (x) { return x.weekStart !== startStr; }));
    return true;
  }

  function getSettings() {
    var v = storeGet(KEYS.settings, {}) || {};
    return { reviewDay: typeof v.reviewDay === 'number' ? v.reviewDay : 0 };
  }
  function saveSettings(patch) {
    var n = Object.assign({}, getSettings(), patch);
    storeSet(KEYS.settings, n); return n;
  }

  global.WeeklyReviewData = {
    KEYS: KEYS, uid: uid, todayISO: todayISO,
    weekStartOf: weekStartOf, weekEndOf: weekEndOf, weekDates: weekDates,
    weekKeyOf: weekKeyOf, shiftWeek: shiftWeek, prettyRange: prettyRange,
    computeSnapshot: computeSnapshot, snapshotFor: snapshotFor,
    list: list, newestFirst: newestFirst, forWeek: forWeek,
    ensure: ensure, update: update, complete: complete, reopen: reopen, remove: remove,
    getSettings: getSettings, saveSettings: saveSettings
  };
})(window);
