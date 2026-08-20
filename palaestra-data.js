// =============================================================
// palaestra-data.js — data layer for THE PALAESTRA
// (palaestra.html + palaestra-workout.html).
//
// The palaestra was the Greek training ground attached to the
// gymnasium — the counterpart to this app's Athenaeum. This is a
// NEW, PARALLEL fitness page, built alongside the two that already
// exist, never on top of them:
//
//   - index.html's embedded Fitness Studio tab  → `fitness:`  prefix
//   - fitnessstudio.html                        → `fitstudio:` prefix
//
// Both stay exactly as they are and stay in the nav. Everything here
// is `pal:`-prefixed, so one
//   initCloudSync({ appKey: 'palaestra', syncedPrefixes: ['pal:'] })
// call per page covers the whole namespace — no per-key wiring. The
// ONLY contact with the older pages is importPrograms() below, which
// READS `fitstudio:templates` / `fitness:templates` / `fitness:
// equipment` straight out of localStorage and never writes to them —
// the same "read another page's storage directly, never call its
// sync, never write back" precedent as fitnessstudio-data.js's own
// importExercisesFromOtherFitnessStudios() and topbar.js's
// buildLearningTopicItems().
//
// WHAT IS STORED AND WHAT IS DERIVED
// Streaks, the weekly scorecard, volume-per-muscle, step averages,
// PR history and the bodyweight progress bar are all pure functions
// over pal:sessions + pal:days + pal:body. None of them is written
// to storage. A stored copy of a computed number is how two figures
// on the same screen end up disagreeing after one is recalculated
// and the other isn't.
//
// MEDIA IS NEVER BASE64 IN A SYNCED KEY. Photos are compressed and
// then handed to PhotoStore.upload(); videos go up as a raw Blob.
// Until the hosted URL comes back the record holds an object URL
// marked sessionOnly, which is dropped on write. A base64 video in
// a `pal:` key would push a multi-megabyte string into the Supabase
// row on every save.
// =============================================================

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE
  // ============================================================
  function storeGet(key) {
    try { var raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { global.dispatchEvent(new CustomEvent('pal:save', { detail: { key: key, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { global.dispatchEvent(new CustomEvent('pal:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }
  // Reads another page's key without ever writing it. Used only by
  // importPrograms().
  function foreignGet(key) {
    try { var raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function uid(prefix) {
    return (prefix || 'pal') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function str(v, max) { return String(v == null ? '' : v).slice(0, max == null ? 400 : max); }
  function num(v, dflt) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : (dflt || 0);
  }
  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

  var KEYS = {
    settings:  'pal:settings',
    exercises: 'pal:exercises',
    templates: 'pal:templates',
    sessions:  'pal:sessions',
    schedule:  'pal:schedule',
    days:      'pal:days',
    body:      'pal:body',
    notes:     'pal:notes',
    goals:     'pal:goals',
    live:      'pal:live',
    seeded:    'pal:seeded',
    imported:  'pal:importedAt'
  };

  // ============================================================
  // DATES — all local, never UTC.
  //
  // toISOString() converts to UTC first, so at 21:00 in Berlin it
  // already reads tomorrow. A page whose whole job is "what did you
  // do today" cannot use it, and it silently mislabels which Monday
  // a week starts on. Verbatim from chrysalis-data.js, same reason.
  // ============================================================
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function localISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function today() { return localISO(new Date()); }
  function parseISO(s) {
    var d = new Date(String(s) + 'T00:00:00');
    return isNaN(d) ? null : d;
  }
  function addDays(dateStr, n) {
    var d = parseISO(dateStr); if (!d) return dateStr;
    return localISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
  }
  function mondayOf(dateStr) {
    var d = parseISO(dateStr); if (!d) return '';
    var day = (d.getDay() + 6) % 7;                 // Monday = 0
    return localISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day));
  }
  // A stable integer per calendar day, built through Date.UTC from the
  // date PARTS, so a daylight-saving shift can never make two days
  // share a number or skip one.
  function dayNumber(dateStr) {
    var p = String(dateStr || today()).split('-');
    var n = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(n) ? 0 : Math.floor(n / 86400000);
  }
  function daysBetween(a, b) { return dayNumber(b) - dayNumber(a); }

  var WEEKDAYS = [
    { key: 'mon', label: 'Monday', short: 'Mon' },
    { key: 'tue', label: 'Tuesday', short: 'Tue' },
    { key: 'wed', label: 'Wednesday', short: 'Wed' },
    { key: 'thu', label: 'Thursday', short: 'Thu' },
    { key: 'fri', label: 'Friday', short: 'Fri' },
    { key: 'sat', label: 'Saturday', short: 'Sat' },
    { key: 'sun', label: 'Sunday', short: 'Sun' }
  ];
  function weekdayKey(dateStr) {
    var d = parseISO(dateStr); if (!d) return 'mon';
    return WEEKDAYS[(d.getDay() + 6) % 7].key;
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  function prettyDate(dateStr) {
    var d = parseISO(dateStr); if (!d) return String(dateStr || '');
    return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  }
  function prettyLong(dateStr) {
    var d = parseISO(dateStr); if (!d) return String(dateStr || '');
    return WEEKDAYS[(d.getDay() + 6) % 7].label + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  // ============================================================
  // CONSTANTS
  // ============================================================
  // A workout TYPE is what you call the session. Its LANE is what the
  // calendar colours it by, so nine types collapse into four colours
  // and the month grid stays readable.
  var TYPES = [
    { key: 'Push',      lane: 'strength' },
    { key: 'Pull',      lane: 'strength' },
    { key: 'Legs',      lane: 'strength' },
    { key: 'Upper',     lane: 'strength' },
    { key: 'Lower',     lane: 'strength' },
    { key: 'Full Body', lane: 'strength' },
    { key: 'Cardio',    lane: 'cardio'   },
    { key: 'Mobility',  lane: 'mobility' },
    { key: 'Custom',    lane: 'strength' },
    { key: 'Rest',      lane: 'rest'     }
  ];
  var TYPE_KEYS = TYPES.map(function (t) { return t.key; });
  function laneOf(type) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].key === type) return TYPES[i].lane;
    return 'strength';
  }

  var MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs',
                 'Glutes', 'Core', 'Forearms', 'Calves', 'Cardio', 'Full Body'];
  var EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight',
                   'Kettlebell', 'Band', 'Bench', 'Treadmill', 'Bike', 'Rower', 'Other'];
  var REST_PRESETS = [30, 60, 90, 120, 180];

  // ============================================================
  // MEDIA
  //
  // sessionOnly means "this URL is an object URL for a file still
  // uploading" — it is stripped on write, so it never reaches storage
  // or the Supabase row. Same handling as dreamboard.html's video
  // slots.
  // ============================================================
  function mediaModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pmed'),
      kind: d.kind === 'video' ? 'video' : 'image',
      url: str(d.url, 2000),
      name: str(d.name, 160),
      sessionOnly: d.sessionOnly === true,
      addedAt: num(d.addedAt, Date.now())
    };
  }
  function cleanMedia(list) {
    return (Array.isArray(list) ? list : [])
      .map(mediaModel)
      .filter(function (m) { return m.url && !m.sessionOnly; })
      .slice(0, 24);
  }

  // ============================================================
  // MODELS — whitelists. Anything not named here is dropped on every
  // write, so a stray field can never quietly become part of a record.
  // ============================================================
  function exerciseModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pex'),
      name: str(d.name, 120),
      muscle: MUSCLES.indexOf(d.muscle) !== -1 ? d.muscle : 'Full Body',
      equipment: str(d.equipment, 60),
      sets: clamp(Math.round(num(d.sets, 3)), 1, 20),
      repMin: clamp(Math.round(num(d.repMin, 8)), 1, 200),
      repMax: clamp(Math.round(num(d.repMax, 12)), 1, 200),
      restSec: clamp(Math.round(num(d.restSec, 90)), 0, 900),
      rpe: clamp(num(d.rpe, 0), 0, 10),
      notes: str(d.notes, 1200),
      media: cleanMedia(d.media),
      trackId: str(d.trackId, 80),      // a pinned track from The Vault
      order: num(d.order, 0),
      importSource: str(d.importSource, 40),
      importSourceId: str(d.importSourceId, 80),
      createdAt: num(d.createdAt, Date.now())
    };
  }
  // A template holds REFERENCES into the exercise library plus its own
  // per-routine overrides, so editing "Dumbbell Row" once fixes it in
  // every routine that uses it — but Pull day can still call for 4 sets
  // where Upper day calls for 3.
  function templateItemModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pti'),
      exerciseId: str(d.exerciseId, 80),
      sets: d.sets == null ? null : clamp(Math.round(num(d.sets, 3)), 1, 20),
      repMin: d.repMin == null ? null : clamp(Math.round(num(d.repMin, 8)), 1, 200),
      repMax: d.repMax == null ? null : clamp(Math.round(num(d.repMax, 12)), 1, 200),
      restSec: d.restSec == null ? null : clamp(Math.round(num(d.restSec, 90)), 0, 900),
      note: str(d.note, 400)
    };
  }
  function templateModel(d) {
    d = d || {};
    return {
      id: d.id || uid('ptpl'),
      name: str(d.name, 120),
      type: TYPE_KEYS.indexOf(d.type) !== -1 ? d.type : 'Custom',
      items: (Array.isArray(d.items) ? d.items : []).map(templateItemModel).slice(0, 60),
      notes: str(d.notes, 1200),
      trackId: str(d.trackId, 80),
      order: num(d.order, 0),
      importSource: str(d.importSource, 40),
      importSourceId: str(d.importSourceId, 80),
      createdAt: num(d.createdAt, Date.now())
    };
  }
  function setModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pset'),
      weight: num(d.weight, 0),
      reps: clamp(Math.round(num(d.reps, 0)), 0, 1000),
      rpe: clamp(num(d.rpe, 0), 0, 10),
      done: d.done === true,
      at: d.at == null ? null : num(d.at, 0)
    };
  }
  // An entry is one exercise INSIDE one session. It carries a copy of
  // the name/muscle/equipment rather than only an id, so a session
  // logged in March still reads correctly after the exercise is
  // renamed or deleted from the library in June.
  function entryModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pent'),
      exerciseId: str(d.exerciseId, 80),
      name: str(d.name, 120),
      muscle: MUSCLES.indexOf(d.muscle) !== -1 ? d.muscle : 'Full Body',
      equipment: str(d.equipment, 60),
      restSec: clamp(Math.round(num(d.restSec, 90)), 0, 900),
      targetReps: str(d.targetReps, 24),
      sets: (Array.isArray(d.sets) ? d.sets : []).map(setModel).slice(0, 30),
      notes: str(d.notes, 1200),
      media: cleanMedia(d.media),
      trackId: str(d.trackId, 80),
      done: d.done === true
    };
  }
  function sessionModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pses'),
      date: str(d.date, 10) || today(),
      templateId: str(d.templateId, 80),
      name: str(d.name, 120),
      type: TYPE_KEYS.indexOf(d.type) !== -1 ? d.type : 'Custom',
      status: d.status === 'done' ? 'done' : (d.status === 'abandoned' ? 'abandoned' : 'live'),
      entries: (Array.isArray(d.entries) ? d.entries : []).map(entryModel).slice(0, 60),
      startedAt: num(d.startedAt, Date.now()),
      endedAt: d.endedAt == null ? null : num(d.endedAt, 0),
      // Elapsed seconds accumulated while the workout was actually
      // running. Wall-clock between startedAt and endedAt would count
      // the hour a session sat open on a locked phone as training time.
      elapsedSec: clamp(Math.round(num(d.elapsedSec, 0)), 0, 86400),
      cardioMin: clamp(Math.round(num(d.cardioMin, 0)), 0, 1440),
      notes: str(d.notes, 4000),
      media: cleanMedia(d.media),
      trackId: str(d.trackId, 80)
    };
  }
  function bodyModel(d) {
    d = d || {};
    function meas(v) { var n = num(v, 0); return n > 0 ? Math.round(n * 10) / 10 : 0; }
    return {
      id: d.id || uid('pbody'),
      date: str(d.date, 10) || today(),
      weight: meas(d.weight),
      waist: meas(d.waist),
      chest: meas(d.chest),
      arms: meas(d.arms),
      thighs: meas(d.thighs),
      hips: meas(d.hips),
      bodyFat: meas(d.bodyFat),
      photos: cleanMedia(d.photos),
      note: str(d.note, 1200),
      createdAt: num(d.createdAt, Date.now())
    };
  }
  function noteModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pnote'),
      date: str(d.date, 10) || today(),
      body: str(d.body, 4000),
      createdAt: num(d.createdAt, Date.now())
    };
  }
  function goalModel(d) {
    d = d || {};
    return {
      id: d.id || uid('pgoal'),
      title: str(d.title, 200),
      detail: str(d.detail, 1200),
      target: str(d.target, 80),
      due: str(d.due, 10),
      done: d.done === true,
      createdAt: num(d.createdAt, Date.now())
    };
  }
  var SETTINGS_DEFAULTS = {
    name: '', weightUnit: 'lb', lengthUnit: 'in',
    stepGoal: 10000, waterGoalMl: 3000,
    weeklyWorkoutGoal: 4, weeklyCardioGoal: 2,
    trackMacros: false, kcalGoal: 0, proteinGoal: 0, carbGoal: 0, fatGoal: 0,
    startWeight: 0, goalWeight: 0
  };
  function settingsModel(d) {
    d = d || {};
    return {
      name: str(d.name, 60),
      weightUnit: d.weightUnit === 'kg' ? 'kg' : 'lb',
      lengthUnit: d.lengthUnit === 'cm' ? 'cm' : 'in',
      stepGoal: clamp(Math.round(num(d.stepGoal, 10000)), 100, 200000),
      waterGoalMl: clamp(Math.round(num(d.waterGoalMl, 3000)), 100, 20000),
      weeklyWorkoutGoal: clamp(Math.round(num(d.weeklyWorkoutGoal, 4)), 1, 14),
      weeklyCardioGoal: clamp(Math.round(num(d.weeklyCardioGoal, 2)), 0, 14),
      trackMacros: d.trackMacros === true,
      kcalGoal: clamp(Math.round(num(d.kcalGoal, 0)), 0, 20000),
      proteinGoal: clamp(Math.round(num(d.proteinGoal, 0)), 0, 2000),
      carbGoal: clamp(Math.round(num(d.carbGoal, 0)), 0, 2000),
      fatGoal: clamp(Math.round(num(d.fatGoal, 0)), 0, 2000),
      startWeight: Math.round(num(d.startWeight, 0) * 10) / 10,
      goalWeight: Math.round(num(d.goalWeight, 0) * 10) / 10
    };
  }

  // ============================================================
  // GENERIC COLLECTION CRUD — same shape every -data.js in this app
  // uses (fitnessstudio-data.js's makeCollection).
  // ============================================================
  function makeCollection(key, model) {
    function list() { var v = storeGet(key); return Array.isArray(v) ? v : []; }
    function get(id) {
      var all = list();
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    }
    function add(data) { var rec = model(data); var all = list(); all.push(rec); storeSet(key, all); return rec; }
    function update(id, patch) {
      var all = list();
      for (var i = 0; i < all.length; i++) {
        if (all[i].id !== id) continue;
        all[i] = model(Object.assign({}, all[i], patch, { id: id }));
        storeSet(key, all);
        return all[i];
      }
      return null;
    }
    function remove(id) {
      var all = list();
      var next = all.filter(function (x) { return x.id !== id; });
      storeSet(key, next);
      return next.length !== all.length;
    }
    function replaceAll(recs) { storeSet(key, (Array.isArray(recs) ? recs : []).map(model)); }
    function nextOrder() {
      var all = list();
      return all.length ? Math.max.apply(null, all.map(function (x) { return num(x.order, 0); })) + 1 : 0;
    }
    return { key: key, list: list, get: get, add: add, update: update,
             remove: remove, replaceAll: replaceAll, nextOrder: nextOrder };
  }

  var Exercises = makeCollection(KEYS.exercises, exerciseModel);
  var Templates = makeCollection(KEYS.templates, templateModel);
  var Sessions  = makeCollection(KEYS.sessions,  sessionModel);
  var Body      = makeCollection(KEYS.body,      bodyModel);
  var Notes     = makeCollection(KEYS.notes,     noteModel);
  var Goals     = makeCollection(KEYS.goals,     goalModel);

  function exercisesSorted() {
    return Exercises.list().slice().sort(function (a, b) {
      return num(a.order, 0) - num(b.order, 0) || String(a.name).localeCompare(String(b.name));
    });
  }
  function templatesSorted() {
    return Templates.list().slice().sort(function (a, b) { return num(a.order, 0) - num(b.order, 0); });
  }
  function sessionsSorted() {
    return Sessions.list().slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date)) || num(b.startedAt, 0) - num(a.startedAt, 0);
    });
  }
  function bodySorted() {
    return Body.list().slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  }

  // ============================================================
  // SETTINGS
  // ============================================================
  function getSettings() { return settingsModel(storeGet(KEYS.settings) || SETTINGS_DEFAULTS); }
  function saveSettings(patch) {
    var next = settingsModel(Object.assign({}, getSettings(), patch || {}));
    storeSet(KEYS.settings, next);
    return next;
  }

  // ============================================================
  // SCHEDULE — the weekly plan the calendar projects forward.
  // { mon: {templateId:'…'} | {rest:true} | null, tue: … }
  // ============================================================
  var DAY_KEYS = WEEKDAYS.map(function (w) { return w.key; });
  function getSchedule() {
    var raw = storeGet(KEYS.schedule) || {};
    var out = {};
    WEEKDAYS.forEach(function (w) {
      var v = raw[w.key];
      if (!v) { out[w.key] = null; return; }
      if (v.rest === true || v.templateId === 'rest') { out[w.key] = { rest: true }; return; }
      out[w.key] = { templateId: str(v.templateId, 80) };
    });
    return out;
  }
  function setScheduleDay(dayKey, value) {
    var sched = getSchedule();
    if (DAY_KEYS.indexOf(dayKey) === -1) return sched;
    sched[dayKey] = value || null;
    storeSet(KEYS.schedule, sched);
    return sched;
  }
  // What the plan says for one date: a template, an explicit rest day,
  // or nothing scheduled at all. Those are three different states and
  // the calendar colours them differently.
  function plannedFor(dateStr) {
    var slot = getSchedule()[weekdayKey(dateStr)];
    if (!slot) return null;
    if (slot.rest) return { rest: true, type: 'Rest', name: 'Rest', templateId: '' };
    var tpl = Templates.get(slot.templateId);
    if (!tpl) return null;
    return { rest: false, type: tpl.type, name: tpl.name, templateId: tpl.id, template: tpl };
  }

  // ============================================================
  // DAILY METRICS — ONE key, `pal:days`, an object keyed YYYY-MM-DD.
  //
  // Deliberately not `pal:day:<date>` × 365. The heatmap, the 7- and
  // 30-day averages and the weekly scorecard each need a whole span in
  // one read; per-date keys would make every one of them a full scan
  // of localStorage. Trimmed to the most recent 730 days on write so
  // the synced blob cannot grow without bound.
  // ============================================================
  var DAY_FIELDS = ['steps', 'water', 'kcal', 'protein', 'carbs', 'fat', 'weight', 'cardioMin'];
  var DAY_CAP = 730;

  function allDays() {
    var raw = storeGet(KEYS.days);
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  }
  function dayModel(d) {
    d = d || {};
    var out = {};
    DAY_FIELDS.forEach(function (f) { out[f] = Math.max(0, num(d[f], 0)); });
    return out;
  }
  function getDay(dateStr) { return dayModel(allDays()[dateStr || today()]); }
  function patchDay(dateStr, patch) {
    var date = dateStr || today();
    var days = allDays();
    days[date] = dayModel(Object.assign({}, days[date] || {}, patch || {}));
    var keys = Object.keys(days).sort();
    if (keys.length > DAY_CAP) {
      keys.slice(0, keys.length - DAY_CAP).forEach(function (k) { delete days[k]; });
    }
    storeSet(KEYS.days, days);
    return days[date];
  }
  function addToDay(dateStr, field, amount) {
    if (DAY_FIELDS.indexOf(field) === -1) return null;
    var date = dateStr || today();
    var cur = getDay(date);
    var patch = {}; patch[field] = Math.max(0, cur[field] + num(amount, 0));
    return patchDay(date, patch);
  }
  // Inclusive both ends, oldest first, with zero-filled gaps — so a
  // heatmap or an average never has to guess what a missing day meant.
  function daysRange(fromISO, toISO) {
    var days = allDays(), out = [];
    var cursor = fromISO, guard = 0;
    while (daysBetween(cursor, toISO) >= 0 && guard++ < 1200) {
      out.push(Object.assign({ date: cursor }, dayModel(days[cursor])));
      cursor = addDays(cursor, 1);
    }
    return out;
  }

  // ============================================================
  // LIVE WORKOUT — its own key so a cloud pull, another tab, or a
  // re-render can never stomp mid-set state, and a reload mid-workout
  // resumes rather than resets.
  //
  // restEndsAt is an absolute timestamp, not a counter that ticks in
  // memory: a locked phone stops firing intervals, so a decrementing
  // counter would be wrong by exactly however long the screen was off.
  // ============================================================
  function getLive() {
    var raw = storeGet(KEYS.live);
    if (!raw || !raw.sessionId) return null;
    var ses = Sessions.get(raw.sessionId);
    if (!ses || ses.status !== 'live') { storeSet(KEYS.live, null); return null; }
    return {
      sessionId: raw.sessionId,
      focusIndex: clamp(Math.round(num(raw.focusIndex, 0)), 0, 59),
      restEndsAt: raw.restEndsAt == null ? null : num(raw.restEndsAt, 0),
      restSec: clamp(Math.round(num(raw.restSec, 0)), 0, 900),
      runningSince: raw.runningSince == null ? null : num(raw.runningSince, 0)
    };
  }
  // The clock's version. getLive() validates against pal:sessions, which
  // means parsing every session ever logged — fine once, ruinous at 2Hz
  // on a page whose whole job is to tick. This reads only the small
  // `pal:live` record and trusts the caller to have validated it once.
  function getLiveRaw() {
    var raw = storeGet(KEYS.live);
    if (!raw || !raw.sessionId) return null;
    return {
      sessionId: raw.sessionId,
      focusIndex: clamp(Math.round(num(raw.focusIndex, 0)), 0, 59),
      restEndsAt: raw.restEndsAt == null ? null : num(raw.restEndsAt, 0),
      restSec: clamp(Math.round(num(raw.restSec, 0)), 0, 900),
      runningSince: raw.runningSince == null ? null : num(raw.runningSince, 0)
    };
  }
  function setLive(patch) {
    var cur = storeGet(KEYS.live) || {};
    var next = Object.assign({}, cur, patch || {});
    storeSet(KEYS.live, next);
    return next;
  }
  function clearLive() { storeSet(KEYS.live, null); }

  // ============================================================
  // STARTING A WORKOUT
  // ============================================================
  function entriesFromTemplate(tpl) {
    if (!tpl) return [];
    return (tpl.items || []).map(function (item) {
      var ex = Exercises.get(item.exerciseId);
      var sets = item.sets == null ? (ex ? ex.sets : 3) : item.sets;
      var repMin = item.repMin == null ? (ex ? ex.repMin : 8) : item.repMin;
      var repMax = item.repMax == null ? (ex ? ex.repMax : 12) : item.repMax;
      var rest = item.restSec == null ? (ex ? ex.restSec : 90) : item.restSec;
      var blank = [];
      for (var i = 0; i < sets; i++) blank.push(setModel({}));
      return entryModel({
        exerciseId: item.exerciseId,
        name: ex ? ex.name : 'Exercise',
        muscle: ex ? ex.muscle : 'Full Body',
        equipment: ex ? ex.equipment : '',
        restSec: rest,
        targetReps: repMin === repMax ? String(repMin) : (repMin + '–' + repMax),
        sets: blank,
        notes: item.note || (ex ? ex.notes : ''),
        media: ex ? ex.media : [],
        trackId: ex ? ex.trackId : ''
      });
    });
  }
  // One live session at a time. Starting a second resumes the first
  // rather than silently orphaning a half-logged workout.
  function startWorkout(opts) {
    opts = opts || {};
    var existing = getLive();
    if (existing) return Sessions.get(existing.sessionId);

    var tpl = opts.templateId ? Templates.get(opts.templateId) : null;
    var ses = Sessions.add({
      date: opts.date || today(),
      templateId: tpl ? tpl.id : '',
      name: opts.name || (tpl ? tpl.name : 'Freestyle workout'),
      type: opts.type || (tpl ? tpl.type : 'Custom'),
      status: 'live',
      entries: tpl ? entriesFromTemplate(tpl) : [],
      startedAt: Date.now(),
      trackId: tpl ? tpl.trackId : ''
    });
    setLive({ sessionId: ses.id, focusIndex: 0, restEndsAt: null, restSec: 0, runningSince: Date.now() });
    return ses;
  }
  function finishWorkout(sessionId, patch) {
    var ses = Sessions.get(sessionId);
    if (!ses) return null;
    var live = getLive();
    var extra = (live && live.runningSince) ? Math.round((Date.now() - live.runningSince) / 1000) : 0;
    var done = Sessions.update(sessionId, Object.assign({
      status: 'done',
      endedAt: Date.now(),
      elapsedSec: ses.elapsedSec + extra
    }, patch || {}));
    if (live && live.sessionId === sessionId) clearLive();
    // A finished session's cardio minutes belong to the day record too,
    // so the steps and scorecard surfaces don't have to re-scan sessions.
    if (done && done.cardioMin > 0) addToDay(done.date, 'cardioMin', done.cardioMin);
    return done;
  }
  function abandonWorkout(sessionId) {
    var live = getLive();
    if (live && live.sessionId === sessionId) clearLive();
    return Sessions.update(sessionId, { status: 'abandoned', endedAt: Date.now() });
  }

  // ============================================================
  // DERIVATIONS — nothing below is ever written to storage.
  // ============================================================
  function doneSessions() {
    return Sessions.list().filter(function (s) { return s.status === 'done'; });
  }
  function sessionsOn(dateStr) {
    return doneSessions().filter(function (s) { return s.date === dateStr; });
  }
  function doneSetsOf(ses) {
    var out = [];
    (ses.entries || []).forEach(function (e) {
      (e.sets || []).forEach(function (st) { if (st.done) out.push({ entry: e, set: st }); });
    });
    return out;
  }
  function sessionVolume(ses) {
    return doneSetsOf(ses).reduce(function (sum, x) { return sum + x.set.weight * x.set.reps; }, 0);
  }
  function sessionSetCount(ses) { return doneSetsOf(ses).length; }
  // Epley. One comparable number per set, so "was that a PR" has an
  // answer when the reps differ — an estimate, not a measurement, and
  // labelled as one everywhere it is shown.
  function e1rm(weight, reps) {
    var w = num(weight, 0), r = num(reps, 0);
    if (w <= 0 || r <= 0) return 0;
    return Math.round(w * (1 + r / 30));
  }
  function estimatedDuration(entriesOrTemplate) {
    var entries = Array.isArray(entriesOrTemplate) ? entriesOrTemplate : entriesFromTemplate(entriesOrTemplate);
    // ~40 working seconds a set, plus that exercise's own rest. Rough
    // by design and labelled "est." wherever it is shown.
    var sec = entries.reduce(function (sum, e) {
      var n = (e.sets || []).length || 1;
      return sum + n * (40 + (e.restSec || 90));
    }, 0);
    return Math.round(sec / 60);
  }

  // --- personal records ------------------------------------------------
  // Walks every done session oldest-first and records each moment an
  // exercise's best estimated 1RM was beaten. Derived, so it can never
  // disagree with the sessions it came from.
  function prTimeline() {
    var best = {}, out = [];
    doneSessions()
      .slice()
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || a.startedAt - b.startedAt; })
      .forEach(function (ses) {
        doneSetsOf(ses).forEach(function (x) {
          var name = x.entry.name;
          if (!name) return;
          var v = e1rm(x.set.weight, x.set.reps);
          if (v <= 0) return;
          if (best[name] == null || v > best[name]) {
            best[name] = v;
            out.push({ exercise: name, e1rm: v, weight: x.set.weight, reps: x.set.reps,
                       date: ses.date, sessionId: ses.id });
          }
        });
      });
    return out;
  }
  function personalBests() {
    var by = {};
    prTimeline().forEach(function (p) { by[p.exercise] = p; });
    return Object.keys(by).sort().map(function (k) { return by[k]; });
  }
  function prsBetween(fromISO, toISO) {
    return prTimeline().filter(function (p) {
      return daysBetween(fromISO, p.date) >= 0 && daysBetween(p.date, toISO) >= 0;
    });
  }

  // --- volume ----------------------------------------------------------
  function volumeByMuscle(fromISO, toISO) {
    var out = {};
    MUSCLES.forEach(function (m) { out[m] = { sets: 0, volume: 0, reps: 0 }; });
    doneSessions().forEach(function (ses) {
      if (daysBetween(fromISO, ses.date) < 0 || daysBetween(ses.date, toISO) < 0) return;
      doneSetsOf(ses).forEach(function (x) {
        var m = out[x.entry.muscle] || (out[x.entry.muscle] = { sets: 0, volume: 0, reps: 0 });
        m.sets += 1;
        m.reps += x.set.reps;
        m.volume += x.set.weight * x.set.reps;
      });
    });
    return out;
  }
  function volumeComparison(weekStartISO) {
    var start = mondayOf(weekStartISO || today());
    var a = volumeByMuscle(start, addDays(start, 6));
    var b = volumeByMuscle(addDays(start, -7), addDays(start, -1));
    return MUSCLES.map(function (m) {
      return { muscle: m, thisWeek: a[m].sets, lastWeek: b[m].sets,
               thisVolume: a[m].volume, lastVolume: b[m].volume };
    }).filter(function (r) { return r.thisWeek || r.lastWeek; });
  }

  // --- steps -----------------------------------------------------------
  function stepStats() {
    var s = getSettings(), t = today();
    var rows = daysRange(addDays(t, -364), t);
    var byDate = {};
    rows.forEach(function (r) { byDate[r.date] = r.steps; });
    function avg(n) {
      var span = rows.slice(-n);
      if (!span.length) return 0;
      return Math.round(span.reduce(function (a, r) { return a + r.steps; }, 0) / span.length);
    }
    var best = rows.reduce(function (b, r) { return r.steps > b.steps ? r : b; }, { date: t, steps: 0 });

    // The streak counts back from today ONLY if today's goal is already
    // met — otherwise from yesterday. Counting from today unconditionally
    // would show a hard-won 40-day streak as 0 every morning until the
    // first walk, which is exactly when it matters that it still reads 40.
    var cursor = byDate[t] >= s.stepGoal ? t : addDays(t, -1);
    var streak = 0, guard = 0;
    while (guard++ < 400 && (byDate[cursor] || 0) >= s.stepGoal) {
      streak++; cursor = addDays(cursor, -1);
    }
    return { goal: s.stepGoal, today: byDate[t] || 0, avg7: avg(7), avg30: avg(30),
             best: best, streak: streak, rows: rows };
  }

  // --- bodyweight ------------------------------------------------------
  function latestWeight() {
    var log = bodySorted();
    for (var i = log.length - 1; i >= 0; i--) if (log[i].weight > 0) return { weight: log[i].weight, date: log[i].date };
    var t = today();
    var rows = daysRange(addDays(t, -364), t);
    for (var j = rows.length - 1; j >= 0; j--) if (rows[j].weight > 0) return { weight: rows[j].weight, date: rows[j].date };
    return null;
  }
  // The most recent reading on or before a date — a week with no
  // weigh-in should read as "unchanged", not as a drop to zero.
  function weightOn(dateStr) {
    var log = bodySorted().filter(function (b) { return b.weight > 0 && daysBetween(b.date, dateStr) >= 0; });
    if (log.length) return log[log.length - 1].weight;
    var days = allDays(), keys = Object.keys(days).sort();
    for (var i = keys.length - 1; i >= 0; i--) {
      if (daysBetween(keys[i], dateStr) >= 0 && num(days[keys[i]].weight, 0) > 0) return num(days[keys[i]].weight, 0);
    }
    return 0;
  }
  function bodyProgress() {
    var s = getSettings();
    var cur = latestWeight();
    var log = bodySorted().filter(function (b) { return b.weight > 0; });
    var start = s.startWeight > 0 ? s.startWeight : (log.length ? log[0].weight : 0);
    var goal = s.goalWeight;
    var current = cur ? cur.weight : start;
    var target = Math.abs(start - goal);
    var moved = start === 0 ? 0 : Math.abs(start - current);
    // Only movement in the intended direction counts. Losing 15 of 50
    // and then putting 3 back on is 12, not 18.
    if (goal && ((goal < start && current > start) || (goal > start && current < start))) moved = 0;
    return {
      unit: s.weightUnit,
      current: current, start: start, goal: goal,
      moved: Math.round(moved * 10) / 10,
      target: Math.round(target * 10) / 10,
      pct: target > 0 ? clamp(Math.round((moved / target) * 100), 0, 100) : 0,
      direction: goal && goal < start ? 'lost' : 'gained',
      asOf: cur ? cur.date : ''
    };
  }
  var MEASURE_FIELDS = [
    { key: 'weight',  label: 'Weight',   unit: 'weight' },
    { key: 'waist',   label: 'Waist',    unit: 'length' },
    { key: 'chest',   label: 'Chest',    unit: 'length' },
    { key: 'arms',    label: 'Arms',     unit: 'length' },
    { key: 'thighs',  label: 'Thighs',   unit: 'length' },
    { key: 'hips',    label: 'Hips',     unit: 'length' },
    { key: 'bodyFat', label: 'Body fat', unit: 'pct'    }
  ];

  // --- streaks ---------------------------------------------------------
  // The workout streak counts consecutive days you did WHAT THE PLAN
  // SAID: a scheduled rest day you rested on keeps it alive, a
  // scheduled workout you skipped breaks it. A plain "days trained in a
  // row" counter tops out at 2 for anyone training four times a week,
  // which makes it useless as the number on the front page.
  function dayFollowedPlan(dateStr) {
    var planned = plannedFor(dateStr);
    if (sessionsOn(dateStr).length > 0) return true;
    if (!planned) return null;          // nothing planned, nothing done — neutral
    return planned.rest === true;
  }
  function streaks() {
    var s = getSettings(), t = today();

    var cursor = t, workout = 0, guard = 0;
    // Today is not counted against you until it is over.
    if (dayFollowedPlan(t) !== true) cursor = addDays(t, -1);
    while (guard++ < 400) {
      var v = dayFollowedPlan(cursor);
      if (v === false) break;
      if (v === true) workout++;
      cursor = addDays(cursor, -1);
    }

    var wkStart = mondayOf(t);
    var done = doneSessions();
    var weekSessions = done.filter(function (x) {
      return daysBetween(wkStart, x.date) >= 0 && daysBetween(x.date, addDays(wkStart, 6)) >= 0;
    });
    var monthPrefix = t.slice(0, 7);
    var monthSessions = done.filter(function (x) { return String(x.date).slice(0, 7) === monthPrefix; });

    // Cardio and PRs are counted by WEEK, not by day. Two cardio
    // sessions a week is a target you can hit; a daily cardio streak
    // would read 0 almost always and mean nothing when it didn't.
    function weeklyStreak(test) {
      var wk = wkStart, n = 0, g = 0;
      if (!test(wk)) wk = addDays(wk, -7);      // the current week is still open
      while (g++ < 200 && test(wk)) { n++; wk = addDays(wk, -7); }
      return n;
    }
    var cardioStreak = s.weeklyCardioGoal > 0 ? weeklyStreak(function (wk) {
      var end = addDays(wk, 6);
      var n = done.filter(function (x) {
        return laneOf(x.type) === 'cardio' && daysBetween(wk, x.date) >= 0 && daysBetween(x.date, end) >= 0;
      }).length;
      return n >= s.weeklyCardioGoal;
    }) : 0;
    var prStreak = weeklyStreak(function (wk) { return prsBetween(wk, addDays(wk, 6)).length > 0; });

    return {
      workout: workout,
      weekDone: weekSessions.length, weekGoal: s.weeklyWorkoutGoal,
      monthDone: monthSessions.length,
      steps: stepStats().streak,
      cardio: cardioStreak,
      pr: prStreak
    };
  }

  // --- the weekly scorecard --------------------------------------------
  // Derived on demand for any week. Nothing about it is stored, so
  // correcting a session's date on Sunday corrects the scorecard too.
  function scorecard(weekStartISO) {
    var s = getSettings();
    var start = mondayOf(weekStartISO || today());
    var end = addDays(start, 6);
    var t = today();
    function inWeek(d) { return daysBetween(start, d) >= 0 && daysBetween(d, end) >= 0; }

    var sessions = doneSessions().filter(function (x) { return inWeek(x.date); });
    var cardio = sessions.filter(function (x) { return laneOf(x.type) === 'cardio'; });
    var rows = daysRange(start, end);
    var stepsTotal = rows.reduce(function (a, r) { return a + r.steps; }, 0);

    var wFrom = weightOn(addDays(start, -1)) || weightOn(start);
    var wTo = weightOn(daysBetween(t, end) >= 0 ? t : end);

    var parts = [];
    parts.push(Math.min(1, s.weeklyWorkoutGoal ? sessions.length / s.weeklyWorkoutGoal : 0));
    parts.push(Math.min(1, s.stepGoal ? stepsTotal / (s.stepGoal * 7) : 0));
    if (s.weeklyCardioGoal > 0) parts.push(Math.min(1, cardio.length / s.weeklyCardioGoal));

    return {
      weekStart: start, weekEnd: end, isCurrent: inWeek(t),
      training: { done: sessions.length, goal: s.weeklyWorkoutGoal },
      steps: { total: stepsTotal, goal: s.stepGoal * 7 },
      cardio: { done: cardio.length, goal: s.weeklyCardioGoal },
      weight: { from: wFrom, to: wTo, delta: Math.round((wTo - wFrom) * 10) / 10, unit: s.weightUnit },
      prs: prsBetween(start, end).length,
      volume: sessions.reduce(function (a, x) { return a + sessionVolume(x); }, 0),
      sessions: sessions,
      overall: parts.length ? Math.round((parts.reduce(function (a, b) { return a + b; }, 0) / parts.length) * 100) : 0
    };
  }

  // --- the calendar ----------------------------------------------------
  // status is one of: done · missed · rest · planned · future · open
  function dayStatus(dateStr) {
    var t = today();
    var did = sessionsOn(dateStr);
    var planned = plannedFor(dateStr);
    if (did.length) return { status: 'done', sessions: did, planned: planned };
    var past = daysBetween(dateStr, t) > 0;
    if (planned && planned.rest) return { status: 'rest', sessions: [], planned: planned };
    if (planned) return { status: past ? 'missed' : 'planned', sessions: [], planned: planned };
    return { status: past ? 'open' : 'future', sessions: [], planned: null };
  }
  // Six Monday-first rows covering the month, padded from the
  // surrounding months so the grid is always 7 × 6 and never reflows.
  function calendarMonth(year, monthIdx) {
    var first = new Date(year, monthIdx, 1);
    var lead = (first.getDay() + 6) % 7;
    var startDate = localISO(new Date(year, monthIdx, 1 - lead));
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var d = addDays(startDate, i);
      var parsed = parseISO(d);
      var info = dayStatus(d);
      cells.push({
        date: d,
        day: parsed.getDate(),
        inMonth: parsed.getMonth() === monthIdx,
        isToday: d === today(),
        status: info.status,
        lane: info.status === 'done' ? laneOf(info.sessions[0].type)
            : (info.planned ? laneOf(info.planned.type) : 'none'),
        label: info.status === 'done' ? info.sessions[0].name : (info.planned ? info.planned.name : ''),
        sessions: info.sessions,
        planned: info.planned
      });
    }
    return { year: year, month: monthIdx, monthName: MONTHS[monthIdx], cells: cells };
  }

  // The seven cells of the Week Bar: type, status, and the day's volume
  // as a fraction of the best day in that week.
  function weekBar(weekStartISO) {
    var start = mondayOf(weekStartISO || today());
    var cells = WEEKDAYS.map(function (w, i) {
      var d = addDays(start, i);
      var info = dayStatus(d);
      var vol = info.sessions.reduce(function (a, s) { return a + sessionVolume(s); }, 0);
      return {
        date: d, key: w.key, short: w.short,
        status: info.status,
        lane: info.status === 'done' ? laneOf(info.sessions[0].type)
            : (info.planned ? laneOf(info.planned.type) : 'none'),
        name: info.status === 'done' ? info.sessions[0].name : (info.planned ? info.planned.name : ''),
        volume: vol,
        steps: getDay(d).steps,
        sets: info.sessions.reduce(function (a, s) { return a + sessionSetCount(s); }, 0),
        isToday: d === today()
      };
    });
    var peak = Math.max.apply(null, cells.map(function (c) { return c.volume; }).concat([1]));
    cells.forEach(function (c) { c.fill = c.volume > 0 ? clamp(c.volume / peak, 0.14, 1) : 0; });
    return { weekStart: start, cells: cells, peak: peak };
  }

  // ============================================================
  // IMPORT — one-time, read-only, and never automatic.
  //
  // Reads the two older fitness pages' own storage keys directly and
  // copies each routine in as a Palaestra template plus whatever
  // exercises it needs. Dedupe is per record via importSource +
  // importSourceId, so re-running only ever adds what is genuinely
  // new: a program since renamed or re-ordered here is left alone.
  // Nothing is ever written back to `fitstudio:` or `fitness:`.
  // ============================================================
  function guessMuscle(name) {
    var n = String(name || '').toLowerCase();
    if (/bench|chest|fly|pec|push.?up|dip/.test(n)) return 'Chest';
    if (/row|pull.?up|chin|lat|deadlift|shrug|pulldown/.test(n)) return 'Back';
    if (/shoulder|overhead press|ohp|lateral|rear delt|upright/.test(n)) return 'Shoulders';
    if (/curl/.test(n)) return /leg curl|hamstring/.test(n) ? 'Legs' : 'Biceps';
    if (/tricep|skull|pushdown|kickback/.test(n)) return 'Triceps';
    if (/squat|lunge|leg press|leg extension|hack|quad|hamstring/.test(n)) return 'Legs';
    if (/glute|hip thrust|bridge/.test(n)) return 'Glutes';
    if (/calf|calves/.test(n)) return 'Calves';
    if (/plank|crunch|\bab\b|\babs\b|core|sit.?up|hanging/.test(n)) return 'Core';
    if (/carry|grip|wrist|forearm/.test(n)) return 'Forearms';
    if (/run|jog|bike|cycle|rower|rowing|treadmill|cardio|walk|sprint|hiit/.test(n)) return 'Cardio';
    return 'Full Body';
  }
  function guessType(name, category) {
    var n = (String(name || '') + ' ' + String(category || '')).toLowerCase();
    if (/push/.test(n)) return 'Push';
    if (/pull/.test(n)) return 'Pull';
    if (/lower/.test(n)) return 'Lower';
    if (/leg/.test(n)) return 'Legs';
    if (/upper/.test(n)) return 'Upper';
    if (/full.?body/.test(n)) return 'Full Body';
    if (/cardio|run|hiit|conditioning/.test(n)) return 'Cardio';
    if (/mobility|stretch|yoga|flexib/.test(n)) return 'Mobility';
    return 'Custom';
  }
  // Finds an existing library exercise by import identity first, then by
  // name — so importing from both older pages does not create two
  // "Dumbbell Row" records.
  function ensureExercise(spec, source, sourceId) {
    var all = Exercises.list();
    var byImport = all.filter(function (x) {
      return sourceId && x.importSource === source && x.importSourceId === sourceId;
    })[0];
    if (byImport) return byImport;
    var lower = String(spec.name || '').trim().toLowerCase();
    var byName = all.filter(function (x) { return lower && String(x.name).trim().toLowerCase() === lower; })[0];
    if (byName) return byName;
    var media = [];
    if (spec.photo) media.push(mediaModel({ kind: 'image', url: spec.photo, name: 'Imported photo' }));
    if (spec.video) media.push(mediaModel({ kind: 'video', url: spec.video, name: 'Imported video' }));
    return Exercises.add({
      name: spec.name,
      muscle: guessMuscle(spec.name),
      equipment: spec.equipment || '',
      sets: spec.sets, repMin: spec.repMin, repMax: spec.repMax, restSec: spec.restSec,
      notes: spec.notes || '',
      media: media,
      order: Exercises.nextOrder(),
      importSource: source, importSourceId: sourceId || ''
    });
  }
  function importPrograms() {
    var added = { templates: 0, exercises: 0, skipped: 0 };
    var before = Exercises.list().length;
    var existing = Templates.list();
    function alreadyImported(source, id) {
      return existing.some(function (t) { return t.importSource === source && t.importSourceId === id; });
    }

    // --- fitnessstudio.html -------------------------------------------
    var fsTemplates = foreignGet('fitstudio:templates');
    (Array.isArray(fsTemplates) ? fsTemplates : []).forEach(function (t) {
      if (!t || !t.id) return;
      if (alreadyImported('fitstudio', t.id)) { added.skipped++; return; }
      var items = (Array.isArray(t.exercises) ? t.exercises : []).map(function (e) {
        var ex = ensureExercise({
          name: e.name, equipment: e.equipment, sets: e.sets, repMin: e.repMin,
          repMax: e.repMax, restSec: e.restSec, notes: e.notes, photo: e.photo, video: e.video
        }, 'fitstudio', e.id);
        return { exerciseId: ex.id, sets: e.sets, repMin: e.repMin, repMax: e.repMax, restSec: e.restSec };
      });
      Templates.add({
        name: t.name || 'Imported program',
        type: guessType(t.name, t.category),
        items: items,
        order: Templates.nextOrder(),
        importSource: 'fitstudio', importSourceId: t.id
      });
      added.templates++;
    });

    // --- index.html's Fitness Studio tab -------------------------------
    var equipment = foreignGet('fitness:equipment');
    var eqById = {};
    (Array.isArray(equipment) ? equipment : []).forEach(function (q) { if (q && q.id) eqById[q.id] = q.name || ''; });
    var fTemplates = foreignGet('fitness:templates');
    (Array.isArray(fTemplates) ? fTemplates : []).forEach(function (t) {
      if (!t || !t.id) return;
      if (alreadyImported('fitness', t.id)) { added.skipped++; return; }
      var items = (Array.isArray(t.exercises) ? t.exercises : []).map(function (e) {
        var ex = ensureExercise({
          name: e.name, equipment: eqById[e.equipmentId] || '', sets: e.sets, repMin: e.repMin,
          repMax: e.repMax, restSec: e.restSec, notes: e.notes, photo: e.photoUrl, video: e.videoUrl
        }, 'fitness', e.id);
        return { exerciseId: ex.id, sets: e.sets, repMin: e.repMin, repMax: e.repMax, restSec: e.restSec };
      });
      Templates.add({
        name: t.name || 'Imported program',
        type: guessType(t.name, t.gymType),
        items: items,
        order: Templates.nextOrder(),
        importSource: 'fitness', importSourceId: t.id
      });
      added.templates++;
    });

    added.exercises = Exercises.list().length - before;
    storeSet(KEYS.imported, Date.now());
    return added;
  }
  function importAvailable() {
    var a = foreignGet('fitstudio:templates'), b = foreignGet('fitness:templates');
    return (Array.isArray(a) ? a.length : 0) + (Array.isArray(b) ? b.length : 0);
  }

  // ============================================================
  // SEEDING — a starter exercise library only, and never before the
  // cloud has had its chance.
  //
  // On a fresh device the local store is empty until the first pull
  // lands. Seeding immediately would write starter rows locally, sync
  // would push them, and the push would overwrite the real 'palaestra'
  // row. Same guard, same reason, as athenaeum-data.js's and
  // chrysalis-data.js's own.
  //
  // Exercises only — no templates, no schedule, no invented history. A
  // routine is a decision; the app does not get to make it for you.
  // ============================================================
  var STARTER_EXERCISES = [
    ['Barbell Bench Press', 'Chest', 'Barbell', 4, 5, 8, 150],
    ['Incline Dumbbell Press', 'Chest', 'Dumbbell', 3, 8, 12, 90],
    ['Cable Fly', 'Chest', 'Cable', 3, 12, 15, 60],
    ['Dumbbell Row', 'Back', 'Dumbbell', 4, 8, 12, 90],
    ['Pull-Up', 'Back', 'Bodyweight', 4, 5, 10, 120],
    ['Lat Pulldown', 'Back', 'Cable', 3, 10, 12, 90],
    ['Overhead Press', 'Shoulders', 'Barbell', 4, 5, 8, 120],
    ['Lateral Raise', 'Shoulders', 'Dumbbell', 3, 12, 15, 60],
    ['Rear Delt Fly', 'Shoulders', 'Dumbbell', 3, 12, 15, 60],
    ['Dumbbell Curl', 'Biceps', 'Dumbbell', 3, 8, 12, 60],
    ['Hammer Curl', 'Biceps', 'Dumbbell', 3, 10, 12, 60],
    ['Triceps Pushdown', 'Triceps', 'Cable', 3, 10, 15, 60],
    ['Back Squat', 'Legs', 'Barbell', 4, 5, 8, 180],
    ['Romanian Deadlift', 'Legs', 'Barbell', 3, 8, 10, 150],
    ['Leg Press', 'Legs', 'Machine', 3, 10, 15, 90],
    ['Hip Thrust', 'Glutes', 'Barbell', 3, 8, 12, 90],
    ['Standing Calf Raise', 'Calves', 'Machine', 4, 12, 20, 45],
    ['Farmer Carry', 'Forearms', 'Dumbbell', 3, 1, 1, 90],
    ['Plank', 'Core', 'Bodyweight', 3, 1, 1, 45],
    ['Treadmill Walk', 'Cardio', 'Treadmill', 1, 1, 1, 0],
    ['Stationary Bike', 'Cardio', 'Bike', 1, 1, 1, 0]
  ];
  function isEmptyEverywhere() {
    return !Exercises.list().length && !Templates.list().length &&
           !Sessions.list().length && !Body.list().length;
  }
  function ensureSeeded() {
    if (storeGet(KEYS.seeded)) return false;
    if (!isEmptyEverywhere()) { storeSet(KEYS.seeded, true); return false; }
    STARTER_EXERCISES.forEach(function (row, i) {
      Exercises.add({
        name: row[0], muscle: row[1], equipment: row[2],
        sets: row[3], repMin: row[4], repMax: row[5], restSec: row[6], order: i
      });
    });
    storeSet(KEYS.seeded, true);
    return true;
  }
  function seedAfterSyncAttempt(remoteRef, onDone) {
    var run = function () {
      var seeded = ensureSeeded();
      if (typeof onDone === 'function') onDone(seeded);
    };
    if (remoteRef && remoteRef.applied) { run(); return; }
    setTimeout(run, 1200);
  }

  // ============================================================
  // IMAGES — compress before storing, then hand to PhotoStore.
  // Verbatim recipe from businessdash-data.js / chrysalis-data.js.
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1200; quality = quality || 0.82;
    return new Promise(function (resolve) {
      try {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, maxDim / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
          var c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          var ctx = c.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, cw, ch);
          try { resolve(c.toDataURL('image/jpeg', quality)); }
          catch (e) { resolve(dataUrl); }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) { resolve(dataUrl); }
    });
  }
  function readFileAsDataUrl(file) {
    return new Promise(function (resolve) {
      try {
        var r = new FileReader();
        r.onload = function () { resolve(String(r.result)); };
        r.onerror = function () { resolve(''); };
        r.readAsDataURL(file);
      } catch (e) { resolve(''); }
    });
  }

  // ============================================================
  // AUTOSAVE — per field, never one shared timer.
  //
  // A single timer shared across a form means typing in field A and
  // then field B within the debounce window clears A's timer and loses
  // A's edit. That was a real bug on The Chrysalis, not a hypothetical
  // one. Fires on debounced input (so a long note is durable WHILE
  // typing), on blur (which fires before the navigation a link click
  // starts, and is what actually saves the last sentence), and on
  // change — plus a sweep at pagehide as a backstop, never as the only
  // chance.
  // ============================================================
  var autosaves = [];
  function autosave(el, commit, ms) {
    if (!el || typeof commit !== 'function') return null;
    var timer = null, dirty = false, last = el.value;
    function fire() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!dirty) return;
      dirty = false; last = el.value;
      commit(last);
    }
    el.addEventListener('input', function () {
      if (el.value === last) return;
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(fire, ms == null ? 260 : ms);
    });
    el.addEventListener('blur', fire);
    el.addEventListener('change', fire);
    if (autosaves.length > 64) autosaves = autosaves.filter(function (h) { return h.el.isConnected; });
    var handle = { el: el, flush: fire };
    autosaves.push(handle);
    return handle;
  }
  autosave.flushAll = function () {
    autosaves = autosaves.filter(function (h) { return h.el.isConnected; });
    autosaves.forEach(function (h) { h.flush(); });
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden) autosave.flushAll(); });
  global.addEventListener('pagehide', function () { autosave.flushAll(); });

  // Cross-tab and cross-device live updates. In row/ the IndexedDB shim
  // re-fires the same 'storage' event, so this keeps working there.
  function onChange(fn) {
    global.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf('pal:') === 0) fn(e.key || '');
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) fn(''); });
  }

  // ============================================================
  // FORMATTING
  // ============================================================
  function fmtInt(n) { return String(Math.round(num(n, 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // THE REP RANGE. Reps are stored as two integers and shown as one
  // string, with an EN DASH — and that derivation used to be written out
  // in three separate places, in two files, which is exactly how the
  // dash in one of them ends up a hyphen. It lives here now.
  //   { repMin: 5, repMax: 8 }  -> '5–8'
  //   { repMin: 5, repMax: 5 }  -> '5'
  function repRange(o) {
    if (!o) return '';
    var lo = Math.round(num(o.repMin, 0)), hi = Math.round(num(o.repMax, 0));
    if (!lo && !hi) return '';
    if (!hi || lo === hi) return String(lo || hi);
    return lo + '\u2013' + hi;
  }

  // '4 × 5–8'. The multiplication sign is U+00D7, not the letter x.
  function setsAndReps(o) {
    if (!o) return '';
    var reps = repRange(o);
    var sets = Math.round(num(o.sets, 0));
    if (!sets) return reps;
    return reps ? sets + ' \u00d7 ' + reps : String(sets);
  }

  // '90s' / '2m' / '2m 30s'. Rest of 0 is a real answer for cardio, and
  // reads better as a dash than as '0s'.
  function fmtRest(sec) {
    var s = Math.max(0, Math.round(num(sec, 0)));
    if (!s) return '\u2014';
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60), r = s % 60;
    return r ? m + 'm ' + r + 's' : m + 'm';
  }

  function fmtWeight(n) {
    var v = Math.round(num(n, 0) * 10) / 10;
    return String(v).replace(/\.0$/, '');
  }
  function fmtClock(sec) {
    var s = Math.max(0, Math.round(num(sec, 0)));
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  }
  function fmtDuration(sec) {
    var s = Math.max(0, Math.round(num(sec, 0)));
    var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    return h ? (h + 'h ' + m + 'm') : (m + 'm');
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ============================================================
  global.Pal = {
    KEYS: KEYS,
    // constants
    TYPES: TYPES, TYPE_KEYS: TYPE_KEYS, laneOf: laneOf,
    MUSCLES: MUSCLES, EQUIPMENT: EQUIPMENT, WEEKDAYS: WEEKDAYS, DAY_KEYS: DAY_KEYS,
    MONTHS: MONTHS, REST_PRESETS: REST_PRESETS, MEASURE_FIELDS: MEASURE_FIELDS,
    // dates
    localISO: localISO, today: today, addDays: addDays, mondayOf: mondayOf,
    dayNumber: dayNumber, daysBetween: daysBetween, weekdayKey: weekdayKey,
    prettyDate: prettyDate, prettyLong: prettyLong, parseISO: parseISO,
    // collections
    Exercises: Exercises, Templates: Templates, Sessions: Sessions,
    Body: Body, Notes: Notes, Goals: Goals,
    exercisesSorted: exercisesSorted, templatesSorted: templatesSorted,
    sessionsSorted: sessionsSorted, bodySorted: bodySorted,
    // settings + schedule
    getSettings: getSettings, saveSettings: saveSettings,
    getSchedule: getSchedule, setScheduleDay: setScheduleDay, plannedFor: plannedFor,
    // days
    allDays: allDays, getDay: getDay, patchDay: patchDay, addToDay: addToDay,
    daysRange: daysRange, DAY_FIELDS: DAY_FIELDS,
    // workouts
    getLive: getLive, getLiveRaw: getLiveRaw, setLive: setLive, clearLive: clearLive,
    entriesFromTemplate: entriesFromTemplate, startWorkout: startWorkout,
    finishWorkout: finishWorkout, abandonWorkout: abandonWorkout,
    // derivations
    doneSessions: doneSessions, sessionsOn: sessionsOn, doneSetsOf: doneSetsOf,
    sessionVolume: sessionVolume, sessionSetCount: sessionSetCount,
    e1rm: e1rm, estimatedDuration: estimatedDuration,
    prTimeline: prTimeline, personalBests: personalBests, prsBetween: prsBetween,
    volumeByMuscle: volumeByMuscle, volumeComparison: volumeComparison,
    stepStats: stepStats, latestWeight: latestWeight, weightOn: weightOn,
    bodyProgress: bodyProgress, streaks: streaks, scorecard: scorecard,
    dayStatus: dayStatus, calendarMonth: calendarMonth, weekBar: weekBar,
    // import + seed
    importPrograms: importPrograms, importAvailable: importAvailable,
    ensureSeeded: ensureSeeded, seedAfterSyncAttempt: seedAfterSyncAttempt,
    // media + utils
    mediaModel: mediaModel, compressImageDataUrl: compressImageDataUrl,
    readFileAsDataUrl: readFileAsDataUrl,
    autosave: autosave, onChange: onChange, uid: uid,
    fmtInt: fmtInt, fmtWeight: fmtWeight, fmtClock: fmtClock,
    repRange: repRange, setsAndReps: setsAndReps, fmtRest: fmtRest,
    fmtDuration: fmtDuration, escapeHtml: escapeHtml, clamp: clamp, num: num
  };
})(window);
