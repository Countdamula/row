// =============================================================
// palaestra-data.js — data layer for FITNESS STUDIO
// (palaestra.html + palaestra-workout.html).
//
// Built as "The Palaestra" — the Greek training ground attached to the
// gymnasium, the counterpart to this app's Athenaeum — and renamed on
// 2026-08-21. DISPLAY NAME ONLY: the filenames, the `pal:` prefix, the
// appKey 'palaestra' and window.Pal are all unchanged, so no stored
// record and no bookmark moved.
//
// It was built as a PARALLEL page alongside two that already existed:
//
//   - index.html's embedded fitness tab  → `fitness:`  prefix
//   - fitnessstudio.html                 → `fitstudio:` prefix
//
// The second was deleted in the 2026-08-21 tidy-up and the first lost
// its nav link in the same pass; both are otherwise untouched on disk,
// and their keys are still readable by importPrograms(). Everything here
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
    // Synced deliberately: the offer is answered once, on whichever device
    // sees it first, and the others should not ask again.
    swept:     'pal:orphanSwept',
    imported:  'pal:importedAt',
    // Which effort level was chosen for a given date: { 'YYYY-MM-DD': 'low' }.
    // ONE key, an object, trimmed on write — same shape and the same reason
    // as pal:days.
    levels:    'pal:levels',
    // One-shot migration flags. Synced deliberately: a migration answered on
    // one device must not run again on the next.
    schedMigrated: 'pal:scheduleMigrated',
    programsAt:    'pal:programsInstalledAt'
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
  var DAY_KEYS = WEEKDAYS.map(function (w) { return w.key; });
  function laneOf(type) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].key === type) return TYPES[i].lane;
    return 'strength';
  }

  var MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs',
                 'Glutes', 'Core', 'Forearms', 'Calves', 'Cardio', 'Full Body'];
  var EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight',
                   'Kettlebell', 'Band', 'Bench', 'Treadmill', 'Bike', 'Rower',
                   // Added for the HIGH/MID/LOW programs. `equipment` is a free
                   // string on the record; this list is only what the picker
                   // offers, so adding to it cannot invalidate anything stored.
                   'Rings', 'Pull-up Bar', 'Jump Rope', 'Mat', 'Wall', 'None',
                   'Other'];
  var REST_PRESETS = [30, 45, 60, 75, 90, 120, 180];

  // ============================================================
  // EFFORT LEVELS
  //
  // MID and LOW are NOT failed versions of HIGH. They are programmed
  // options, and the app has to say so everywhere it offers them — a
  // schedule that greys out the short session, or a streak that breaks on
  // one, has quietly turned "which version am I capable of today" back into
  // "am I working out today", which is the question this whole scheme
  // exists to stop asking.
  //
  // Nothing derived may penalise a level. dayFollowedPlan() counts any
  // chosen level as following the plan; see §STREAKS.
  // ============================================================
  var LEVELS = [
    { key: 'high', label: 'HIGH', title: 'Progress Day',  mins: '55–75 min',
      blurb: 'The full session. Push progression — add reps or weight where the top of the range is clean.',
      when: 'Energy, sleep, motivation and time are all good.', dot: '🟢' },
    { key: 'mid',  label: 'MID',  title: 'Maintenance',   mins: '30–45 min',
      blurb: 'Keeps the highest-return exercises and cuts accessory volume and conditioning.',
      when: 'Tired, busy, mediocre sleep — but functional.', dot: '🟡' },
    { key: 'low',  label: 'LOW',  title: 'Consistency',   mins: '10–20 min',
      blurb: 'The minimum effective dose: the important movement patterns, some blood moving, then leave.',
      when: 'Exhausted, stressed, very short on time.', dot: '🔴' }
  ];
  var LEVEL_KEYS = LEVELS.map(function (l) { return l.key; });
  function levelInfo(key) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].key === key) return LEVELS[i];
    return LEVELS[0];
  }

  // Not every prescription is a number of reps. Jump rope is five minutes,
  // a wall sit is forty-five seconds, an L-sit is "as long as you can", and
  // a split squat is ten PER LEG. Storing all of those as repMin/repMax and
  // hoping the reader remembers which is which is how "3 × 45" ends up
  // meaning three sets of forty-five repetitions.
  var UNITS = ['reps', 'sec', 'min', 'max'];

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
      unit: UNITS.indexOf(d.unit) !== -1 ? d.unit : 'reps',
      perSide: d.perSide === true,
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
      unit: UNITS.indexOf(d.unit) !== -1 ? d.unit : null,
      perSide: d.perSide == null ? null : d.perSide === true,
      note: str(d.note, 400)
    };
  }
  function templateModel(d) {
    d = d || {};
    // §SCHEDULE-ON-THE-ROUTINE. Which weekdays a routine runs on, and at
    // which effort level, live HERE and nowhere else. The weekly schedule is
    // derived from these two fields — see getSchedule() — so there is no
    // second store to drift out of step, and renaming a routine renames it on
    // the schedule for free.
    //
    // `days` is a list, not one day, because a routine can legitimately run
    // twice a week. `level` empty means "this one applies whichever level is
    // chosen" — which is what a rest day is.
    var days = (Array.isArray(d.days) ? d.days : (d.day ? [d.day] : []))
      .map(function (x) { return str(x, 3); })
      .filter(function (x, i, a) { return DAY_KEYS.indexOf(x) !== -1 && a.indexOf(x) === i; });
    return {
      id: d.id || uid('ptpl'),
      name: str(d.name, 120),
      type: TYPE_KEYS.indexOf(d.type) !== -1 ? d.type : 'Custom',
      days: days,
      level: LEVEL_KEYS.indexOf(d.level) !== -1 ? d.level : '',
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
      // Which version of the day this was. Recorded so History can say "Push,
      // LOW" rather than leaving a 12-minute session looking like a bad full
      // one. Empty on everything logged before levels existed.
      level: LEVEL_KEYS.indexOf(d.level) !== -1 ? d.level : '',
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
    // add() mints a new id; this puts a record back under the one it already
    // has. Used when a remote apply has erased a record the page is still
    // working in — see palaestra-workout.html's restoreSession().
    function restore(rec) {
      if (!rec || !rec.id) return null;
      var all = list();
      for (var i = 0; i < all.length; i++) if (all[i].id === rec.id) return all[i];
      var kept = model(rec);
      kept.id = rec.id;
      all.push(kept); storeSet(key, all);
      return kept;
    }
    function nextOrder() {
      var all = list();
      return all.length ? Math.max.apply(null, all.map(function (x) { return num(x.order, 0); })) + 1 : 0;
    }
    return { key: key, list: list, get: get, add: add, update: update,
             remove: remove, replaceAll: replaceAll, restore: restore,
             nextOrder: nextOrder };
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
  // §SCHEDULE — DERIVED, never stored.
  //
  // The weekly schedule used to be its own key, pal:schedule, holding
  // template ids per weekday. Two stores meant two truths: renaming a
  // routine left the old name on the schedule, deleting one left a slot
  // pointing at nothing, and the two could be edited on different devices
  // and merged into nonsense.
  //
  // So it is now a pure function over the routines themselves. A routine
  // carries `days` and `level` (see templateModel §SCHEDULE-ON-THE-ROUTINE)
  // and the schedule is simply those fields read back the other way round.
  // Set a routine's days in Workouts and it appears here; rename it and it
  // renames here; delete it and its slot is empty rather than broken.
  //
  // Shape: { mon: { high: tpl|null, mid: …, low: …, any: tpl|null }, … }
  // where `any` is a routine with no level, which stands in at every level.
  // ============================================================
  function getSchedule() {
    var out = {};
    WEEKDAYS.forEach(function (w) { out[w.key] = { high: null, mid: null, low: null, any: null }; });
    templatesSorted().forEach(function (t) {
      (t.days || []).forEach(function (dk) {
        var slot = out[dk];
        if (!slot) return;
        var bucket = t.level || 'any';
        // First one wins, and templatesSorted is ordered, so which routine
        // wins a contested slot is stable rather than whichever was saved last.
        if (!slot[bucket]) slot[bucket] = t;
      });
    });
    return out;
  }

  /**
   * The routine for one weekday at one level, with a deliberate fallback.
   *
   * A day with only a HIGH routine written should still start something when
   * LOW is chosen — refusing to would make picking LOW cost you the workout,
   * which is exactly the pressure this scheme removes. Order: the exact
   * level, then the level-less routine, then the nearest others.
   */
  function resolveForDay(dayKey, level) {
    var slot = getSchedule()[dayKey];
    if (!slot) return null;
    var order = [level, 'any'].concat(LEVEL_KEYS.filter(function (k) { return k !== level; }));
    for (var i = 0; i < order.length; i++) {
      if (slot[order[i]]) return slot[order[i]];
    }
    return null;
  }

  // ------------------------------------------------------------
  // THE CHOSEN LEVEL, per date.
  // ------------------------------------------------------------
  function allLevels() {
    var raw = storeGet(KEYS.levels);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  }
  /** The level chosen for a date, defaulting to HIGH when nothing was said. */
  function getLevel(dateStr) {
    var v = allLevels()[dateStr];
    return LEVEL_KEYS.indexOf(v) !== -1 ? v : 'high';
  }
  /** Whether a level was actually chosen, as against defaulted. */
  function hasLevel(dateStr) { return LEVEL_KEYS.indexOf(allLevels()[dateStr]) !== -1; }
  function setLevel(dateStr, level) {
    var all = allLevels();
    if (LEVEL_KEYS.indexOf(level) === -1) delete all[dateStr];
    else all[dateStr] = level;
    // Trimmed like pal:days, and for the same reason: one key holding every
    // date forever eventually becomes the largest thing in the row.
    var keys = Object.keys(all).sort();
    while (keys.length > 730) delete all[keys.shift()];
    storeSet(KEYS.levels, all);
    return level;
  }

  // What the plan says for one date: a routine, an explicit rest day, or
  // nothing scheduled at all. Three different states, coloured differently.
  function plannedFor(dateStr) {
    var level = getLevel(dateStr);
    var tpl = resolveForDay(weekdayKey(dateStr), level);
    if (!tpl) return null;
    if (tpl.type === 'Rest') {
      return { rest: true, type: 'Rest', name: tpl.name || 'Rest', templateId: tpl.id, template: tpl, level: level };
    }
    return { rest: false, type: tpl.type, name: tpl.name, templateId: tpl.id, template: tpl, level: level };
  }

  /**
   * Fold the retired pal:schedule key into the routines, once.
   *
   * Additive and idempotent: a day already named by a routine is left alone,
   * and the flag is inside the synced prefix so the second device does not
   * repeat it. The old key is removed afterwards rather than left behind,
   * because a store nothing reads is a store that will eventually be trusted
   * by mistake.
   */
  function migrateSchedule() {
    if (storeGet(KEYS.schedMigrated)) return false;
    var raw = storeGet(KEYS.schedule);
    if (!raw || typeof raw !== 'object') { storeSet(KEYS.schedMigrated, true); return false; }
    var restDays = [];
    var touched = 0;
    DAY_KEYS.forEach(function (dk) {
      var v = raw[dk];
      if (!v) return;
      if (v.rest === true || v.templateId === 'rest') { restDays.push(dk); return; }
      var tpl = Templates.get(str(v.templateId, 80));
      if (!tpl) return;
      if ((tpl.days || []).indexOf(dk) !== -1) return;
      Templates.update(tpl.id, { days: (tpl.days || []).concat([dk]) });
      touched++;
    });
    if (restDays.length) {
      var existing = Templates.list().filter(function (t) { return t.type === 'Rest'; })[0];
      if (existing) {
        Templates.update(existing.id, {
          days: (existing.days || []).concat(restDays.filter(function (d) { return (existing.days || []).indexOf(d) === -1; }))
        });
      } else {
        Templates.add({ name: 'Rest', type: 'Rest', days: restDays, level: '', order: 900 });
      }
      touched++;
    }
    storeSet(KEYS.schedMigrated, true);
    try { localStorage.removeItem(KEYS.schedule); } catch (e) {}
    return touched > 0;
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
      // A per-item null means "inherit"; only an explicit value overrides. The
      // unit and the per-side flag follow the same rule as the numbers, or a
      // routine could show "3 × 45" for a wall sit measured in seconds.
      var unit = item.unit == null ? (ex ? ex.unit : 'reps') : item.unit;
      var perSide = item.perSide == null ? (ex ? ex.perSide : false) : item.perSide;
      var blank = [];
      for (var i = 0; i < sets; i++) blank.push(setModel({}));
      return entryModel({
        exerciseId: item.exerciseId,
        name: ex ? ex.name : 'Exercise',
        muscle: ex ? ex.muscle : 'Full Body',
        equipment: ex ? ex.equipment : '',
        restSec: rest,
        targetReps: repRange({ repMin: repMin, repMax: repMax, unit: unit, perSide: perSide }),
        sets: blank,
        notes: item.note || (ex ? ex.notes : ''),
        media: ex ? ex.media : [],
        trackId: ex ? ex.trackId : ''
      });
    });
  }
  // One live session at a time. Starting a second resumes the first
  // rather than silently orphaning a half-logged workout.
  // A session left at status 'live' with no pointer at it and nothing logged
  // in it. These were being minted one per failed start: the pal:sessions
  // write landed, the pal:live write did not, and the next attempt found no
  // live session and added another. History filters them out, so they were
  // invisible while still riding in every sync push.
  function orphanLiveSessions() {
    var raw = storeGet(KEYS.live);
    var liveId = raw && raw.sessionId ? raw.sessionId : '';
    return Sessions.list().filter(function (s) {
      if (s.status !== 'live' || s.id === liveId) return false;
      return !(s.entries || []).some(function (e) {
        return (e.sets || []).some(function (x) { return x.done; });
      });
    });
  }
  // Removes them. Never touches a session with a single completed set in it —
  // that is a workout someone did, however it ended.
  function orphanSweepDone() { return !!storeGet(KEYS.swept); }
  function setOrphanSweepDone() { storeSet(KEYS.swept, Date.now()); }
  function sweepOrphanLiveSessions() {
    var doomed = orphanLiveSessions();
    if (!doomed.length) return 0;
    var ids = {};
    doomed.forEach(function (s) { ids[s.id] = true; });
    Sessions.replaceAll(Sessions.list().filter(function (s) { return !ids[s.id]; }));
    return doomed.length;
  }

  function startWorkout(opts) {
    opts = opts || {};
    var existing = getLive();
    if (existing) return Sessions.get(existing.sessionId);

    // Adopt an empty live session started moments ago rather than adding a
    // second one. Belt to the braces of the durable navigation: if a pal:live
    // write is ever lost again, this is what stops it turning into a pile of
    // orphans.
    // Only a genuinely EMPTY freestyle shell qualifies. An orphan built from
    // a template carries that template's exercises and its name, and handing
    // it back to someone who asked for a freestyle workout would be a worse
    // answer than a clean one.
    var recent = orphanLiveSessions().filter(function (s) {
      if (s.templateId || (s.entries || []).length) return false;
      return Date.now() - num(s.startedAt, 0) < 10 * 60 * 1000;
    }).sort(function (a, b) { return num(b.startedAt, 0) - num(a.startedAt, 0); })[0];
    if (recent && !opts.templateId) {
      setLive({ sessionId: recent.id, focusIndex: 0, restEndsAt: null, restSec: 0, runningSince: Date.now() });
      return recent;
    }

    var tpl = opts.templateId ? Templates.get(opts.templateId) : null;
    var ses = Sessions.add({
      date: opts.date || today(),
      templateId: tpl ? tpl.id : '',
      name: opts.name || (tpl ? tpl.name : 'Freestyle workout'),
      type: opts.type || (tpl ? tpl.type : 'Custom'),
      // Whatever was chosen at the moment Start was pressed — which may not be
      // what the schedule was showing an hour ago. The last choice wins, and
      // this is where it is recorded.
      level: opts.level || (tpl ? tpl.level : '') || '',
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
  // ============================================================
  // §PROGRAMS — the HIGH / MID / LOW system.
  //
  // Three versions of the same training week. HIGH is the full session,
  // MID keeps the highest-return lifts and drops accessory volume and
  // conditioning, LOW is the minimum effective dose. They are three
  // programmed options, not one program and two apologies for it, and
  // nothing in this file is allowed to treat them otherwise.
  //
  // This is CONTENT, not a seed. ensureSeeded() still ships exercises only —
  // "a routine is a decision, and the app does not get to make it for you" —
  // and installing these is an explicit, repeatable, additive act with its
  // own button in Settings. It dedupes on importSource + importSourceId, so
  // running it a second time adds only what is missing. That matters: if
  // these ever disappear again they are one tap away rather than an evening.
  // ============================================================

  // Every exercise the three programs call for, with its form cues.
  // [name, muscle, equipment, sets, repMin, repMax, restSec, unit, perSide, cues]
  //
  // MUSCLES is a fixed twelve — it drives the --cover colour table and the
  // filter chips — so side and rear delts resolve to Shoulders, hip flexors
  // and the deep core to Core. The precise group is in the cues where it
  // matters.
  var PROGRAM_EXERCISES = [
    ['Incline DB Press', 'Chest', 'Dumbbell', 3, 10, 12, 90, 'reps', false,
      'Upper chest, triceps, front delts. Shoulder blades back and down; slight arch; lower the dumbbells under control; press up and slightly inward.'],
    ['Seated Arnold Press', 'Shoulders', 'Dumbbell', 3, 10, 12, 90, 'reps', false,
      'Brace the core; rotate smoothly; do not overarch the lower back; finish with the dumbbells overhead.'],
    ['Lateral Raises', 'Shoulders', 'Dumbbell', 4, 15, 20, 45, 'reps', false,
      'Side delts. Soft elbows; lead with the elbows; stop near shoulder height; no swinging.'],
    ['Ring Push-ups', 'Chest', 'Rings', 3, 10, 12, 60, 'reps', false,
      'Keep the rings stable; body straight; elbows roughly 30–45°; chest between the rings.'],
    ['DB Skull Crushers', 'Triceps', 'Dumbbell', 3, 10, 12, 60, 'reps', false,
      'Keep the upper arms fixed; bend only at the elbows; lower beside the forehead.'],
    ['Goblet Squats', 'Legs', 'Dumbbell', 3, 10, 12, 90, 'reps', false,
      'Quads and glutes. Dumbbell tight to the chest; brace; knees track the toes; full comfortable depth.'],
    ['Standing Calf Raises', 'Calves', 'Dumbbell', 3, 15, 20, 45, 'reps', false,
      'Full stretch at the bottom; drive onto the toes; pause a second at the top; do not bounce.'],
    ['Jump Rope', 'Cardio', 'Jump Rope', 3, 5, 5, 60, 'min', false,
      'Stay light on the feet; small jumps; elbows close; turn the rope from the wrists.'],
    ['Wide-Grip Pull-ups', 'Back', 'Pull-up Bar', 4, 6, 10, 120, 'reps', false,
      'Lats, upper back, biceps. Start from a controlled hang; pull the chest upward; shoulders away from the ears; no kicking.'],
    ['DB Pullover', 'Back', 'Dumbbell', 3, 10, 12, 75, 'reps', false,
      'Lats, chest, serratus. Ribs down; slight elbow bend; stretch behind the head; pull using the lats.'],
    ['Rear Delt Flyes', 'Shoulders', 'Dumbbell', 3, 12, 15, 45, 'reps', false,
      'Rear delts and upper back. Hinge forward; soft elbows; spread the dumbbells apart; do not shrug.'],
    ['Hammer Curls', 'Biceps', 'Dumbbell', 3, 10, 12, 60, 'reps', false,
      'Biceps, brachialis, forearms. Neutral grip; elbows stay near the torso; no swinging.'],
    ['Reverse Curls', 'Forearms', 'Dumbbell', 3, 12, 15, 60, 'reps', false,
      'Palms down; wrists neutral; elbows fixed.'],
    ['Romanian Deadlifts', 'Legs', 'Dumbbell', 3, 10, 12, 120, 'reps', false,
      'Hamstrings, glutes, back. Soft knees; push the hips backward; back neutral; feel the hamstring stretch.'],
    ['Hanging Leg Raises', 'Core', 'Pull-up Bar', 3, 10, 12, 60, 'reps', false,
      'Abs and hip flexors. Brace before raising; curl the pelvis upward; minimise swinging.'],
    ['Incline Treadmill Walk', 'Cardio', 'Treadmill', 2, 20, 20, 300, 'min', false,
      'Comfortable sustainable pace; upright posture; do not hang on the rails.'],
    ['Walking Lunges', 'Legs', 'Bodyweight', 2, 15, 15, 60, 'reps', true,
      'Long controlled steps; front knee follows the toes; keep the intensity easy.'],
    ['Stomach Vacuums', 'Core', 'None', 5, 30, 30, 30, 'sec', false,
      'Deep core. Fully exhale; draw the abdomen inward; keep breathing controlled where you can.'],
    ['Yoga', 'Full Body', 'Mat', 2, 10, 15, 0, 'min', false,
      'Mobility and recovery. Slow breathing; controlled stretches; do not force range of motion.'],
    ['Seated DB Press', 'Shoulders', 'Dumbbell', 4, 8, 10, 120, 'reps', false,
      'Brace the core; forearms vertical; press overhead without excessive back arch.'],
    ['Front Raises', 'Shoulders', 'Dumbbell', 3, 10, 12, 45, 'reps', false,
      'Front delts. Raise under control to shoulder height; keep the ribs down.'],
    ['Ring Dips', 'Chest', 'Rings', 3, 10, 12, 90, 'reps', false,
      'Chest, triceps, shoulders. Stabilise the rings; controlled descent; shoulders stay packed.'],
    ['Bulgarian Split Squats', 'Legs', 'Dumbbell', 3, 10, 10, 90, 'reps', true,
      'Quads and glutes. Front foot planted; lower vertically; knee tracks the toes; drive through the whole foot.'],
    ['Chin-ups', 'Back', 'Pull-up Bar', 4, 6, 10, 120, 'reps', false,
      'Lats, biceps, upper back. Controlled hang; pull the chest toward the bar; avoid swinging.'],
    ['DB Row', 'Back', 'Dumbbell', 3, 8, 10, 90, 'reps', false,
      'Lats and upper back. Brace the torso; pull toward the hip; do not twist or jerk.'],
    ['Incline DB Curls', 'Biceps', 'Dumbbell', 3, 10, 12, 60, 'reps', false,
      'Let the arms hang; keep the shoulders back; curl without moving the upper arm.'],
    ['Leg/Nordic Curls', 'Legs', 'Other', 3, 8, 12, 90, 'reps', false,
      'Hamstrings. Keep the hips controlled; squeeze the hamstrings; emphasise a slow eccentric.'],
    ['Glute Bridges', 'Glutes', 'Dumbbell', 3, 10, 15, 75, 'reps', false,
      'Glutes and hamstrings. Posterior pelvic tilt; drive the hips upward; squeeze the glutes instead of arching the back.'],
    ['Hanging Knee Tucks', 'Core', 'Pull-up Bar', 3, 12, 15, 60, 'reps', false,
      'Curl the pelvis toward the ribs; minimise swinging.'],
    ['Lateral Raise Triset', 'Shoulders', 'Dumbbell', 3, 0, 0, 60, 'reps', false,
      'Three lateral-raise variations back to back, no rest between them. Keep the tension on the delts; chase control and burn rather than load.'],
    ['Seated Calf Raises', 'Calves', 'Dumbbell', 4, 15, 20, 45, 'reps', false,
      'Full stretch; pause at the top; controlled lowering.'],
    ['Wall Sit', 'Legs', 'Wall', 3, 45, 60, 60, 'sec', false,
      'Quads. Back flat against the wall; knees at roughly 90°; feet planted.'],
    ['Hanging L-Sit', 'Core', 'Pull-up Bar', 3, 0, 0, 60, 'max', false,
      'Core and hip flexors. Brace hard; depress the shoulders; minimise swinging. Hold as long as the position stays clean.'],
    ['Pull-ups', 'Back', 'Pull-up Bar', 2, 5, 10, 90, 'reps', false,
      'Full controlled reps from a hang; do not kick.']
  ];

  // [exerciseName, sets, repMin, repMax, restSec, unit, perSide, note]
  // A null in a numeric slot means "inherit from the library record".
  var PROGRAM_ROUTINES = [
    // ---------------- HIGH — Progress Day ----------------
    { day: 'mon', level: 'high', type: 'Push', name: 'Monday Push — HIGH',
      notes: 'Chest + Shoulders + Quads. The full session, ~55–75 minutes. When you reach the top of the rep range with clean form on every working set, add resistance.',
      items: [
        ['Incline DB Press', 3, 10, 12, 90], ['Seated Arnold Press', 3, 10, 12, 90],
        ['Lateral Raises', 4, 15, 20, 45], ['Ring Push-ups', 3, 10, 12, 60],
        ['DB Skull Crushers', 3, 10, 12, 60], ['Goblet Squats', 3, 10, 12, 90],
        ['Standing Calf Raises', 3, 15, 20, 45],
        ['Jump Rope', 3, 5, 5, 60, 'min']
      ] },
    { day: 'tue', level: 'high', type: 'Pull', name: 'Tuesday Pull — HIGH',
      notes: 'Back + Biceps + Forearms + Hamstrings.',
      items: [
        ['Wide-Grip Pull-ups', 4, 6, 10, 120], ['DB Pullover', 3, 10, 12, 75],
        ['Rear Delt Flyes', 3, 12, 15, 45], ['Hammer Curls', 3, 10, 12, 60],
        ['Reverse Curls', 3, 12, 15, 60], ['Romanian Deadlifts', 3, 10, 12, 120],
        ['Hanging Leg Raises', 3, 10, 12, 60]
      ] },
    { day: 'wed', level: 'high', type: 'Mobility', name: 'Wednesday Recovery — HIGH',
      notes: 'Active recovery. Easy on purpose — this is not a session to push.',
      items: [
        ['Incline Treadmill Walk', 2, 20, 20, 300, 'min', false, 'Rest 2–5 min between blocks.'],
        ['Walking Lunges', 2, 15, 15, 60, 'reps', true, 'Keep the intensity easy.'],
        ['Stomach Vacuums', 5, 30, 30, 30, 'sec'],
        ['Yoga', 2, 10, 15, 0, 'min']
      ] },
    { day: 'thu', level: 'high', type: 'Push', name: 'Thursday Push — HIGH',
      notes: 'Shoulder priority + unilateral legs.',
      items: [
        ['Seated DB Press', 4, 8, 10, 120], ['Lateral Raises', 4, 15, 20, 45],
        ['Front Raises', 3, 10, 12, 45], ['Ring Dips', 3, 10, 12, 90],
        ['Bulgarian Split Squats', 3, 10, 10, 90, 'reps', true],
        ['Jump Rope', 3, 8, 8, 90, 'min', false, 'Rest 60–90 sec.']
      ] },
    { day: 'fri', level: 'high', type: 'Pull', name: 'Friday Pull — HIGH',
      notes: 'Lats + Arms + Core + Posterior chain.',
      items: [
        ['Chin-ups', 4, 6, 10, 120], ['DB Row', 3, 8, 10, 90],
        ['Incline DB Curls', 3, 10, 12, 60], ['Hammer Curls', 3, 8, 10, 60],
        ['Leg/Nordic Curls', 3, 8, 12, 90], ['Glute Bridges', 3, 10, 15, 75],
        ['Hanging Knee Tucks', 3, 12, 15, 60]
      ] },
    { day: 'sat', level: 'high', type: 'Full Body', name: 'Saturday Shoulders & Core — HIGH',
      notes: 'Shoulders + Core + Calves, finishing on the rope.',
      items: [
        ['Lateral Raise Triset', 3, 0, 0, 60, 'reps', false, '3 rounds, 3 movements per round.'],
        ['Rear Delt Flyes', 4, 12, 15, 45], ['Seated Calf Raises', 4, 15, 20, 45],
        ['Wall Sit', 3, 45, 60, 60, 'sec'], ['Stomach Vacuums', 5, 30, 30, 30, 'sec'],
        ['Hanging L-Sit', 3, 0, 0, 60, 'max'],
        ['Jump Rope', 3, 10, 10, 90, 'min', false, 'Rest 60–90 sec.']
      ] },

    // ---------------- MID — Maintenance ----------------
    { day: 'mon', level: 'mid', type: 'Push', name: 'Monday Push — MID',
      notes: 'Main compound → important secondary movement → one or two accessories → done. Skips ring push-ups, skull crushers and the rope.',
      items: [
        ['Incline DB Press', 3, 8, 12, 90], ['Seated Arnold Press', 2, 10, 12, 75],
        ['Lateral Raises', 2, 12, 15, 45], ['Goblet Squats', 3, 10, 12, 90],
        ['Standing Calf Raises', 2, 15, 20, 45]
      ] },
    { day: 'tue', level: 'mid', type: 'Pull', name: 'Tuesday Pull — MID',
      notes: 'Back + Biceps + Hamstrings. Skips rear delt flyes and reverse curls.',
      items: [
        ['Wide-Grip Pull-ups', 3, 6, 10, 120], ['DB Pullover', 2, 10, 12, 60],
        ['Hammer Curls', 2, 10, 12, 60], ['Romanian Deadlifts', 3, 8, 12, 120],
        ['Hanging Leg Raises', 2, 8, 12, 60]
      ] },
    { day: 'wed', level: 'mid', type: 'Mobility', name: 'Wednesday Recovery — MID',
      notes: 'Active recovery, trimmed.',
      items: [
        ['Incline Treadmill Walk', 1, 20, 30, 0, 'min'],
        ['Stomach Vacuums', 3, 30, 30, 30, 'sec'],
        ['Yoga', 1, 10, 15, 0, 'min']
      ] },
    { day: 'thu', level: 'mid', type: 'Push', name: 'Thursday Push — MID',
      notes: 'Shoulder priority + legs. Skips front raises and the rope.',
      items: [
        ['Seated DB Press', 3, 8, 10, 120], ['Lateral Raises', 3, 12, 20, 45],
        ['Ring Dips', 2, 8, 12, 90],
        ['Bulgarian Split Squats', 2, 8, 10, 90, 'reps', true]
      ] },
    { day: 'fri', level: 'mid', type: 'Pull', name: 'Friday Pull — MID',
      notes: 'Back + Arms + Posterior chain.',
      items: [
        ['Chin-ups', 3, 6, 10, 120], ['DB Row', 3, 8, 10, 90],
        ['Incline DB Curls', 2, 10, 12, 60], ['Leg/Nordic Curls', 2, 8, 12, 90],
        ['Glute Bridges', 2, 10, 15, 60]
      ] },
    { day: 'sat', level: 'mid', type: 'Full Body', name: 'Saturday Shoulders & Core — MID',
      notes: 'Shoulders + Core + Calves.',
      items: [
        ['Lateral Raise Triset', 2, 0, 0, 60, 'reps', false, '2 rounds, 3 movements per round.'],
        ['Rear Delt Flyes', 2, 12, 15, 45], ['Seated Calf Raises', 3, 15, 20, 45],
        ['Wall Sit', 2, 30, 60, 60, 'sec'], ['Hanging L-Sit', 2, 0, 0, 60, 'max']
      ] },

    // ---------------- LOW — Consistency ----------------
    { day: 'mon', level: 'low', type: 'Push', name: 'Monday Push — LOW',
      notes: 'Chest, shoulders, triceps, quads and glutes in roughly 10–15 minutes. Show up, hit the highest-value movements, leave.',
      items: [
        ['Incline DB Press', 2, 8, 12, 90, 'reps', false, 'Rest 60–90 sec.'],
        ['Goblet Squats', 2, 10, 12, 90, 'reps', false, 'Rest 60–90 sec.'],
        ['Lateral Raises', 2, 12, 15, 45]
      ] },
    { day: 'tue', level: 'low', type: 'Pull', name: 'Tuesday Pull — LOW',
      notes: 'Back, biceps, hamstrings. Three movements and you are done.',
      items: [
        ['Pull-ups', 2, 5, 10, 90], ['Romanian Deadlifts', 2, 8, 12, 90],
        ['Hammer Curls', 2, 8, 12, 60, 'reps', false, 'Rest 45–60 sec.']
      ] },
    { day: 'wed', level: 'low', type: 'Mobility', name: 'Wednesday Recovery — LOW',
      notes: 'If you are truly wrecked, just do the walk. That still counts as completing this one.',
      items: [
        ['Incline Treadmill Walk', 1, 15, 20, 0, 'min', false, 'Comfortable pace — do not turn this into hard cardio.'],
        ['Stomach Vacuums', 2, 30, 30, 30, 'sec']
      ] },
    { day: 'thu', level: 'low', type: 'Push', name: 'Thursday Push — LOW',
      notes: 'Shoulders and legs.',
      items: [
        ['Seated DB Press', 2, 8, 10, 90],
        ['Bulgarian Split Squats', 2, 8, 10, 90, 'reps', true],
        ['Lateral Raises', 2, 12, 15, 45]
      ] },
    { day: 'fri', level: 'low', type: 'Pull', name: 'Friday Pull — LOW',
      notes: 'Back, biceps, posterior chain.',
      items: [
        ['Chin-ups', 2, 5, 10, 90],
        ['DB Row', 2, 8, 10, 90, 'reps', false, 'Rest 60–90 sec.'],
        ['Glute Bridges', 2, 10, 15, 60]
      ] },
    { day: 'sat', level: 'low', type: 'Full Body', name: 'Saturday Shoulders & Core — LOW',
      notes: 'Shoulders, rear delts, calves, core.',
      items: [
        ['Lateral Raises', 2, 12, 15, 45], ['Rear Delt Flyes', 2, 12, 15, 45],
        ['Seated Calf Raises', 2, 15, 20, 45], ['Hanging L-Sit', 2, 0, 0, 60, 'max']
      ] },

    // ---------------- SUNDAY ----------------
    // No level: a rest day is a rest day whichever version of the week you
    // are running, and getSchedule()'s 'any' bucket is exactly that case.
    { day: 'sun', level: '', type: 'Rest', name: 'Sunday — Rest',
      notes: 'No structured training. You do not have to make up a missed HIGH or MID workout.',
      items: [] }
  ];

  // Matching a program exercise to one already in the library. Normalised
  // rather than exact, because "Incline DB Press" and "Incline Dumbbell
  // Press" are the same movement and a library holding both is a library
  // whose history is split down the middle.
  function exMatchKey(name) {
    return String(name || '').toLowerCase()
      .replace(/\bdb\b/g, 'dumbbell')
      .replace(/flyes/g, 'fly')
      .replace(/[^a-z]/g, '')
      .replace(/s$/, '');
  }
  function findExerciseByName(name) {
    var want = exMatchKey(name);
    return Exercises.list().filter(function (e) { return exMatchKey(e.name) === want; })[0] || null;
  }
  // A record still carrying only what ensureSeeded() gave it. Filling in the
  // cues and the unit on one of these is an improvement; doing it to a record
  // the reader has edited would be an overwrite, so it is never done.
  function looksUntouched(e) {
    return !e.notes && !(e.media || []).length && !e.trackId && !e.importSource;
  }

  /**
   * Install (or repair) the HIGH / MID / LOW programs.
   *
   * Additive and idempotent. Exercises are matched by normalised name and
   * only ever gain empty fields. Routines are keyed by importSourceId, so a
   * routine you have since customised is left exactly as it is and only
   * genuinely missing ones are written.
   *
   * @returns {{exercises:number, exercisesEnriched:number, routines:number}}
   */
  function installPrograms() {
    var res = { exercises: 0, exercisesEnriched: 0, routines: 0 };
    var byName = {};

    PROGRAM_EXERCISES.forEach(function (row, i) {
      var name = row[0];
      var found = findExerciseByName(name);
      if (found) {
        var patch = {};
        if (!found.notes && row[9]) patch.notes = row[9];
        if (found.unit === 'reps' && row[7] !== 'reps') patch.unit = row[7];
        if (!found.perSide && row[8]) patch.perSide = true;
        // Equipment only on a record nothing has touched: a seeded "Standing
        // Calf Raise / Machine" becoming "Dumbbell" is right, the reader's own
        // choice being rewritten is not.
        if (looksUntouched(found) && row[2] && found.equipment !== row[2]) patch.equipment = row[2];
        if (Object.keys(patch).length) { Exercises.update(found.id, patch); res.exercisesEnriched++; }
        byName[name] = Exercises.get(found.id);
        return;
      }
      byName[name] = Exercises.add({
        name: name, muscle: row[1], equipment: row[2],
        sets: row[3], repMin: row[4], repMax: row[5], restSec: row[6],
        unit: row[7], perSide: row[8], notes: row[9],
        order: 1000 + i,
        importSource: 'program-hml', importSourceId: 'ex:' + exMatchKey(name)
      });
      res.exercises++;
    });

    var have = {};
    Templates.list().forEach(function (t) {
      if (t.importSource === 'program-hml' && t.importSourceId) have[t.importSourceId] = true;
    });

    PROGRAM_ROUTINES.forEach(function (r, i) {
      var sourceId = r.day + ':' + (r.level || 'any');
      if (have[sourceId]) return;
      Templates.add({
        name: r.name, type: r.type, days: [r.day], level: r.level, notes: r.notes,
        order: i,
        importSource: 'program-hml', importSourceId: sourceId,
        items: r.items.map(function (it) {
          var ex = byName[it[0]] || findExerciseByName(it[0]);
          return {
            exerciseId: ex ? ex.id : '',
            sets: it[1] == null ? null : it[1],
            repMin: it[2] == null ? null : it[2],
            repMax: it[3] == null ? null : it[3],
            restSec: it[4] == null ? null : it[4],
            unit: it[5] == null ? null : it[5],
            perSide: it[6] == null ? null : it[6],
            note: it[7] || ''
          };
        })
      });
      res.routines++;
    });

    if (res.routines || res.exercises) storeSet(KEYS.programsAt, Date.now());
    return res;
  }
  function programsInstalled() {
    return Templates.list().filter(function (t) { return t.importSource === 'program-hml'; }).length;
  }

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
  // Seeding decides "is this device genuinely empty?", and getting that
  // wrong on a slow connection is expensive: the seed's own writes are
  // pushed, sync.js replaces the row's whole data column, and an entire
  // account collapses to twenty-one starter exercises.
  //
  // It used to wait a flat 1200ms and then guess. Worse, the flag it checked
  // — remoteRef.applied — is set from onApplied, which fires only when the
  // incoming row DIFFERED. A row that matched, or a row that was legitimately
  // empty, looked identical to no answer at all, so the guess was taken far
  // more often than intended.
  //
  // sync.js now reports arrival separately (onPulled), so the wait is for a
  // real event. The timeout survives only as a backstop for the case where
  // there is no cloud at all — no supabase client, no network, sync.js never
  // mounted — because a first-run device offline forever still has to seed.
  function seedAfterSyncAttempt(remoteRef, onDone) {
    var fired = false;
    var run = function () {
      if (fired) return;
      fired = true;
      var seeded = ensureSeeded();
      if (typeof onDone === 'function') onDone(seeded);
    };
    if (remoteRef && (remoteRef.pulled || remoteRef.applied)) { run(); return; }
    if (remoteRef) remoteRef.onPulled = run;
    setTimeout(run, 8000);
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
  var UNIT_SUFFIX = { reps: '', sec: ' sec', min: ' min', max: '' };
  function repRange(o) {
    if (!o) return '';
    var unit = UNITS.indexOf(o.unit) !== -1 ? o.unit : 'reps';
    if (unit === 'max') return 'Max';
    var lo = Math.round(num(o.repMin, 0)), hi = Math.round(num(o.repMax, 0));
    if (!lo && !hi) return '';
    var span = (!hi || lo === hi) ? String(lo || hi) : (lo + '\u2013' + hi);
    // '/leg' rather than '/side': every per-side movement in the programs
    // shipped with this app is a single-leg one. If an arm one is ever added
    // this becomes a label on the record rather than a constant here.
    return span + UNIT_SUFFIX[unit] + (o.perSide ? '/leg' : '');
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
    LEVELS: LEVELS, LEVEL_KEYS: LEVEL_KEYS, levelInfo: levelInfo, UNITS: UNITS,
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
    getSchedule: getSchedule, resolveForDay: resolveForDay, plannedFor: plannedFor,
    migrateSchedule: migrateSchedule,
    // levels
    getLevel: getLevel, hasLevel: hasLevel, setLevel: setLevel, allLevels: allLevels,
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
    dayStatus: dayStatus, weekBar: weekBar,
    // import + seed
    importPrograms: importPrograms, importAvailable: importAvailable,
    installPrograms: installPrograms, programsInstalled: programsInstalled,
    PROGRAM_ROUTINES: PROGRAM_ROUTINES,
    ensureSeeded: ensureSeeded, seedAfterSyncAttempt: seedAfterSyncAttempt,
    orphanLiveSessions: orphanLiveSessions, sweepOrphanLiveSessions: sweepOrphanLiveSessions,
    orphanSweepDone: orphanSweepDone, setOrphanSweepDone: setOrphanSweepDone,
    // media + utils
    mediaModel: mediaModel, compressImageDataUrl: compressImageDataUrl,
    readFileAsDataUrl: readFileAsDataUrl,
    autosave: autosave, onChange: onChange, uid: uid,
    fmtInt: fmtInt, fmtWeight: fmtWeight, fmtClock: fmtClock,
    repRange: repRange, setsAndReps: setsAndReps, fmtRest: fmtRest,
    fmtDuration: fmtDuration, escapeHtml: escapeHtml, clamp: clamp, num: num
  };
})(window);
