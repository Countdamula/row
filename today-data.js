// =============================================================
// today-data.js — the data layer for Main's Today page.
//
// Prefix `today:`, on the `goals` Supabase row (see main-sync.js).
//
// ─────────────────────────────────────────────────────────────
// THE EFFORT LEVEL IS THE VERSION. There is no second switcher.
//
// The Morning Ritual this page replaces had its own length control —
// Floor · 10 / Hour / Full · 80 — that scaled every step. Today also
// has HIGH / MID / LOW, which is described in exactly the same terms
// ("a 60-minute workout or two hours on the side hustle" vs "a 40
// minute workout or one hour" vs "a 20-minute walk or one tiny
// task"). Keeping both would be two knobs for one quantity, free to
// disagree: a Full morning at LOW effort is not a thing that means
// anything.
//
// So a step's `mins` is keyed by level, and the level — which lives
// in pal:levels and is shared with the Fitness Studio — drives the
// clock. One answer in the morning sets the workout, the meditation
// AND the shape of the routine.
//
// A step with 0 minutes at the current level is NOT hidden and NOT a
// failure. It is marked optional and stays tickable. Nothing derived
// from a level may penalise it — the same rule palaestra-data.js
// states at :202-214.
// ─────────────────────────────────────────────────────────────
//
// WHAT THIS FILE DELIBERATELY DOES NOT OWN
//
// Four things on the Today page are read and written under the OLD
// `routine:` prefix, not `today:`:
//
//   the Beliefs database + its 30-day recitation lock   routine:beliefs, routine:config
//   the three present-tense lines for today             routine:todayEntries
//   tonight's evidence / reflection / gratitude         routine:tonightEntries
//   the days-run history and the Frog metric            routine:log
//
// They moved screens, not homes. Copying them to a `today:` prefix
// would be a migration with two failure modes (a half-copied record,
// and a second copy on a device that had not yet pulled) in exchange
// for a tidier name. `routine:` is on the same Supabase row, so
// nothing about sync changes. The accessors are wrapped here so the
// page has ONE data API rather than reaching into two prefixes.
// =============================================================

(function (global) {
  'use strict';

  var KEYS = {
    routines: 'today:routines',
    log:      'today:log',
    schedule: 'today:schedule',
    hero:     'today:hero',
    settings: 'today:settings',
    seeded:   'today:seeded'
  };

  // The carried-forward keys. Same names as index.html has always used.
  var R = {
    config:   'routine:config',
    log:      'routine:log',
    beliefs:  'routine:beliefs',
    today:    'routine:todayEntries',
    tonight:  'routine:tonightEntries'
  };

  var LEVEL_KEYS = ['high', 'mid', 'low'];

  // THREE PHASES SINCE 2026-08-26. `day` was added between the two
  // that already existed, because the hours between the morning and
  // the wind-down were the ones with nothing written down for them.
  //
  // Adding a phase is safe in a way removing one would not be:
  // stepModel() coerces any unrecognised phase to 'morning', so every
  // record written before today keeps exactly the phase it had, and
  // nothing needs migrating. `day` simply starts empty.
  var PHASES = ['morning', 'day', 'evening'];

  // Which clock time each phase runs forward from. See scheduleFor().
  var PHASE_ANCHOR = { morning: 'wake', day: 'dayStart', evening: 'windDown' };
  var PHASE_LABEL = { morning: 'Morning', day: 'Day', evening: 'Evening' };
  var PHASE_START_LABEL = { morning: 'Wake', day: 'Day starts', evening: 'Wind down' };

  // ------------------------------------------------------------
  // STORE
  // ------------------------------------------------------------
  function storeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { global.dispatchEvent(new CustomEvent('today:save', { detail: { key: key, ok: true } })); } catch (e2) {}
      return true;
    } catch (e) {
      try { global.dispatchEvent(new CustomEvent('today:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
      return false;
    }
  }

  function uid(p) {
    return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  /** Local ISO. toISOString() converts to UTC first, so at 21:00 in
      Berlin it already reads tomorrow. */
  function todayISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  function clampInt(v, lo, hi, dflt) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return dflt;
    return Math.max(lo, Math.min(hi, n));
  }
  function str(v) { return v == null ? '' : String(v); }
  function nextOrder(list) {
    return list.reduce(function (m, x) { return Math.max(m, (x.order || 0) + 1); }, 0);
  }

  // ------------------------------------------------------------
  // COLLECTION — same recipe as mainselfcare-data.js:54-79.
  // ------------------------------------------------------------
  function makeCollection(key, model) {
    function list() {
      var v = storeGet(key, []);
      return Array.isArray(v) ? v.map(model) : [];
    }
    function replaceAll(arr) { return storeSet(key, (arr || []).map(model)); }
    function get(id) {
      return list().find(function (x) { return x.id === id; }) || null;
    }
    function add(fields) {
      var all = list();
      var rec = model(Object.assign({}, fields, {
        id: (fields && fields.id) || uid(key.split(':')[1].slice(0, 3)),
        order: (fields && fields.order != null) ? fields.order : nextOrder(all),
        createdAt: Date.now()
      }));
      all.push(rec);
      replaceAll(all);
      return rec;
    }
    function update(id, patch) {
      var all = list(), i = all.findIndex(function (x) { return x.id === id; });
      if (i < 0) return null;
      all[i] = model(Object.assign({}, all[i], patch));
      replaceAll(all);
      return all[i];
    }
    function remove(id) {
      var all = list().filter(function (x) { return x.id !== id; });
      replaceAll(all);
      return true;
    }
    function move(id, dir) {
      var all = list().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      var i = all.findIndex(function (x) { return x.id === id; });
      var j = i + dir;
      if (i < 0 || j < 0 || j >= all.length) return false;
      var t = all[i]; all[i] = all[j]; all[j] = t;
      all.forEach(function (x, n) { x.order = n; });
      replaceAll(all);
      return true;
    }
    return { key: key, list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll, move: move };
  }

  // ------------------------------------------------------------
  // ROUTINE STEPS
  // ------------------------------------------------------------
  function minsModel(m) {
    m = m && typeof m === 'object' ? m : {};
    return { high: clampInt(m.high, 0, 600, 0), mid: clampInt(m.mid, 0, 600, 0), low: clampInt(m.low, 0, 600, 0) };
  }
  function subModel(s, i) {
    s = s || {};
    return { id: s.id || uid('sub'), text: str(s.text), order: s.order != null ? s.order : i };
  }
  function videoModel(v, i) {
    v = v || {};
    return { id: v.id || uid('vid'), title: str(v.title), url: str(v.url), order: v.order != null ? v.order : i };
  }
  function stepModel(s) {
    s = s || {};
    return {
      id: s.id || uid('stp'),
      phase: PHASES.indexOf(s.phase) !== -1 ? s.phase : 'morning',
      title: str(s.title),
      note: str(s.note),
      mins: minsModel(s.mins),
      linkHref: str(s.linkHref),
      linkLabel: str(s.linkLabel),
      substeps: (Array.isArray(s.substeps) ? s.substeps : []).map(subModel),
      videos: (Array.isArray(s.videos) ? s.videos : []).map(videoModel),
      prompts: (Array.isArray(s.prompts) ? s.prompts : []).map(subModel),
      // Which carried-forward artefact opens inside this step. One of
      // '', 'beliefs', 'intentions', 'tonight', 'frog'. This is how the
      // Mirror step comes to hold the five and the three lines: they
      // ARE its sub-steps 3 and 4, not a separate section repeating them.
      slot: str(s.slot),
      order: s.order != null ? s.order : 0,
      createdAt: s.createdAt || Date.now()
    };
  }

  var Routines = makeCollection(KEYS.routines, stepModel);

  function routinesFor(phase) {
    return Routines.list()
      .filter(function (s) { return s.phase === phase; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  // ------------------------------------------------------------
  // THE SEED
  //
  // A SEED, NOT A SCHEMA. Every one of these is editable, removable,
  // reorderable and retitleable; the shape below is only what the page
  // looks like before it has been made your own.
  //
  // The Mirror step's five sub-steps are carried over verbatim from
  // the Morning Ritual's own DEFAULT_STEPS — they were already exactly
  // right and rewording them would only make them less true.
  // ------------------------------------------------------------
  var SEED = [
    {
      phase: 'morning', order: 0, slot: 'beliefs',
      title: 'Mirror exercise',
      note: 'Before the phone. Always.',
      mins: { high: 8, mid: 5, low: 3 },
      substeps: [
        { text: 'Eye contact, steady breathing, one minute. Then one honest sentence out loud about your current state. Not a fix — true. "I’m tired and a little scared about today."' },
        { text: 'Then immediately: "And I’m not leaving. I’m here with you." You’re proving the promise before you ask yourself to believe anything. Skipping this is what makes affirmations feel like lying to your face.' },
        { text: 'The five, three times each. Flat, then louder, then like you’re telling someone who doubted you. Pause between them and let the meaning land in your body before moving on.' },
        { text: 'Then the three present-tense lines about today specifically. Hands over your heart or your face — anchoring the state to touch means you can recall it later by repeating the gesture.' },
        { text: 'Close quietly: "I’m proud of you. Let’s go." Then walk away. Don’t linger and undo it by drifting back into inspecting your face.' }
      ]
    },
    {
      phase: 'morning', order: 1,
      title: 'Hydrate, train, feed your mind',
      note: 'Water first. Then today’s workout at the effort you picked. Then two or three things worth putting in your head.',
      mins: { high: 75, mid: 45, low: 20 },
      linkHref: 'palaestra.html', linkLabel: 'Open the Fitness Studio',
      videos: []
    },
    {
      phase: 'morning', order: 2,
      title: 'Meditate and visualise',
      note: 'Not silence. Sit in the life where the goal is already real, and feel what it is like to be the person living it.',
      mins: { high: 15, mid: 10, low: 5 },
      prompts: [
        { text: 'What does your time look like?' },
        { text: 'How do you spend your day?' },
        { text: 'What does your life look like?' },
        { text: 'What are all the details?' }
      ]
    },
    {
      phase: 'morning', order: 3,
      title: 'Shower',
      note: '',
      mins: { high: 12, mid: 10, low: 7 }
    },
    {
      phase: 'morning', order: 4, slot: 'frog',
      title: 'Work on the business',
      note: 'Eat the frog. The hardest thing first, while there is still something left to spend on it.',
      mins: { high: 120, mid: 60, low: 15 }
    },

    {
      phase: 'evening', order: 0,
      title: 'Empty the inbox',
      note: 'Everything out of your head and into the daily note. Sunday sorts it.',
      mins: { high: 15, mid: 10, low: 5 }
    },
    {
      phase: 'evening', order: 1, slot: 'tonight',
      title: 'Script tonight',
      note: 'What actually happened, what it proved, and one thing worth being grateful for.',
      mins: { high: 10, mid: 6, low: 3 }
    },
    {
      phase: 'evening', order: 2,
      title: 'Hypnagogic wind-down',
      note: 'The last thing your mind holds before sleep is the thing it works on all night. Give it the right one.',
      mins: { high: 15, mid: 10, low: 5 }
    },
    {
      phase: 'evening', order: 3,
      title: 'Lab notebook',
      note: 'Lives in Obsidian. Listed here so the evening is complete, not so it is done here.',
      mins: { high: 15, mid: 8, low: 0 }
    },
    {
      phase: 'evening', order: 4,
      title: 'Maybe journal',
      note: 'Optional by design. Lives in Obsidian.',
      mins: { high: 15, mid: 0, low: 0 }
    }
  ];

  function isEmpty() { return Routines.list().length === 0; }
  function seeded() { return storeGet(KEYS.seeded, false) === true; }

  /**
   * Seed only if this device is genuinely empty AND has been told so.
   *
   * NEVER call this before the cloud pull has resolved. A seeder that
   * runs against a not-yet-hydrated store concludes the device is empty
   * and writes the defaults over real data that is still arriving.
   */
  function seedIfEmpty() {
    if (seeded() || !isEmpty()) return 0;
    Routines.replaceAll(SEED.map(stepModel));
    storeSet(KEYS.seeded, true);
    return SEED.length;
  }

  // ------------------------------------------------------------
  // THE PER-DAY LOG
  //
  // One key holding one object, date -> what was ticked. Trimmed to
  // 730 entries on every write, the same shape and the same reason as
  // pal:levels: one key holding every date forever eventually becomes
  // the largest thing in the row.
  // ------------------------------------------------------------
  function allLog() {
    var v = storeGet(KEYS.log, {});
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }
  function dayLog(date) {
    var d = allLog()[date || todayISO()];
    return {
      steps: (d && d.steps) || {},
      substeps: (d && d.substeps) || {},
      prompts: (d && d.prompts) || {},
      updatedAt: (d && d.updatedAt) || 0
    };
  }
  function writeDay(date, patch) {
    var all = allLog();
    var cur = all[date] || {};
    all[date] = Object.assign({ steps: {}, substeps: {}, prompts: {} }, cur, patch, { updatedAt: Date.now() });
    var keys = Object.keys(all).sort();
    while (keys.length > 730) delete all[keys.shift()];
    storeSet(KEYS.log, all);
    return all[date];
  }
  function toggleStep(date, stepId, on) {
    var d = dayLog(date), steps = Object.assign({}, d.steps);
    if (on === undefined) on = !steps[stepId];
    if (on) steps[stepId] = true; else delete steps[stepId];
    writeDay(date, { steps: steps });
    return on;
  }
  function toggleSub(date, subId, on) {
    var d = dayLog(date), subs = Object.assign({}, d.substeps);
    if (on === undefined) on = !subs[subId];
    if (on) subs[subId] = true; else delete subs[subId];
    writeDay(date, { substeps: subs });
    return on;
  }
  function setPrompt(date, promptId, text) {
    var d = dayLog(date), p = Object.assign({}, d.prompts);
    if (text) p[promptId] = String(text); else delete p[promptId];
    writeDay(date, { prompts: p });
  }
  /** done / total for a phase on a date, at that date's own level. */
  function phaseProgress(date, phase, level) {
    var d = dayLog(date);
    var steps = routinesFor(phase);
    var required = steps.filter(function (s) { return (s.mins[level] || 0) > 0; });
    var pool = required.length ? required : steps;
    var done = pool.filter(function (s) { return !!d.steps[s.id]; }).length;
    return { done: done, total: pool.length, optional: steps.length - pool.length };
  }

  // ------------------------------------------------------------
  // THE TIMING ENGINE
  //
  // Wake time plus the day's effort level gives every morning step a
  // real clock time; the wind-down time does the same for the evening.
  // Steps at 0 minutes for the current level are optional — they keep
  // their place in the list and take no time from the schedule.
  // ------------------------------------------------------------
  function scheduleModel(s) {
    s = s || {};
    return {
      wake: /^\d{2}:\d{2}$/.test(s.wake) ? s.wake : '06:30',
      // The day phase's own anchor. A record written before 2026-08-26
      // has no dayStart and falls through to noon, which is what the
      // phase means for anyone who has not moved it.
      dayStart: /^\d{2}:\d{2}$/.test(s.dayStart) ? s.dayStart : '12:00',
      windDown: /^\d{2}:\d{2}$/.test(s.windDown) ? s.windDown : '21:30'
    };
  }
  function getSchedule() { return scheduleModel(storeGet(KEYS.schedule, null)); }
  function saveSchedule(patch) {
    var next = scheduleModel(Object.assign({}, getSchedule(), patch));
    storeSet(KEYS.schedule, next);
    return next;
  }
  function toMins(hhmm) {
    var p = String(hhmm).split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }
  function fmtTime(mins) {
    var m = ((mins % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  /**
   * [{ step, startMins, start, mins, optional }] for a phase at a level.
   * The evening runs FORWARD from the wind-down time, same as the
   * morning runs forward from waking — a routine counted backwards from
   * a bedtime is a routine you are already late for.
   */
  function scheduleFor(phase, level) {
    var sch = getSchedule();
    var t = toMins(sch[PHASE_ANCHOR[phase] || 'wake']);
    return routinesFor(phase).map(function (s) {
      var m = s.mins[level] || 0;
      var row = { step: s, startMins: t, start: fmtTime(t), mins: m, optional: m === 0 };
      t += m;
      return row;
    });
  }
  function phaseTotal(phase, level) {
    return routinesFor(phase).reduce(function (a, s) { return a + (s.mins[level] || 0); }, 0);
  }

  /** The anchor time a phase counts forward from, as 'HH:MM'. */
  function phaseStart(phase) {
    var sch = getSchedule();
    return sch[PHASE_ANCHOR[phase] || 'wake'];
  }
  /** Write a phase's anchor without the caller knowing its field name. */
  function savePhaseStart(phase, hhmm) {
    var patch = {};
    patch[PHASE_ANCHOR[phase] || 'wake'] = hhmm;
    return saveSchedule(patch);
  }

  /**
   * Which phase the clock is in right now.
   *
   * Deliberately NOT "which phase has unfinished steps" — this answers
   * what time it is, so the page can open the part of the routine you
   * are actually in and fold the other two away. Before the day starts
   * you are in the morning; after the wind-down begins you are in the
   * evening; the small hours read as evening, because at 01:00 the
   * thing you have not finished is last night's wind-down, not
   * tomorrow's mirror.
   */
  function currentPhase(now) {
    now = now || new Date();
    var mins = now.getHours() * 60 + now.getMinutes();
    var sch = getSchedule();
    var dayAt = toMins(sch.dayStart);
    var eveAt = toMins(sch.windDown);
    if (mins >= eveAt) return 'evening';
    if (mins >= dayAt) return 'day';
    // Between midnight and the wake time the evening is still running.
    if (mins < toMins(sch.wake)) return 'evening';
    return 'morning';
  }

  /**
   * done / total across all three phases at a date's own level, plus a
   * whole percentage.
   *
   * It counts the SAME pool phaseProgress() counts — the steps that
   * are required at this level — so a Low day is measured against a
   * Low day. A meter that counted every step at every level would make
   * Low permanently unfinishable, and nothing derived from a level may
   * penalise it.
   */
  function overallProgress(date, level) {
    var done = 0, total = 0;
    PHASES.forEach(function (p) {
      var r = phaseProgress(date, p, level);
      done += r.done; total += r.total;
    });
    return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  /**
   * SUGGESTIONS, NOT A SEED.
   *
   * These are never written by seedIfEmpty() and never written by
   * anything on load. `day` arrived after this device was already
   * seeded, so seedIfEmpty() will never run again here and an empty
   * Day phase would otherwise be a blank space with no way in. The UI
   * offers these as ghost rows; a step exists only once it is tapped.
   *
   * "Main priority" is deliberately not among them — the morning's
   * "Work on the business" already IS the frog, and a second row
   * claiming the same hours would make both of them a lie.
   */
  var DAY_SUGGESTIONS = [
    {
      phase: 'day', title: 'Walk',
      note: 'Outside, without the phone in your hand. It counts as movement even on a Low day.',
      mins: { high: 30, mid: 20, low: 10 },
      linkHref: 'palaestra.html#/steps', linkLabel: 'Steps'
    },
    {
      phase: 'day', title: 'Log what you ate',
      note: 'While you can still remember it. Two minutes now beats guessing at midnight.',
      mins: { high: 5, mid: 5, low: 3 },
      linkHref: 'larder.html', linkLabel: 'The Larder'
    },
    {
      phase: 'day', title: 'Learning',
      note: 'One lesson, one paper, one chapter. Optional on a Low day by design.',
      mins: { high: 45, mid: 25, low: 0 },
      linkHref: 'athenaeum.html', linkLabel: 'The Athenaeum'
    },
    {
      phase: 'day', title: 'Self-care break',
      note: 'Breath, tapping, or ten minutes lying on the floor. Before you need it.',
      mins: { high: 15, mid: 10, low: 5 },
      linkHref: 'asclepion.html', linkLabel: 'The Asclepion'
    },
    {
      phase: 'day', title: 'Write',
      note: 'The manuscript, not the notes about the manuscript.',
      mins: { high: 60, mid: 30, low: 0 },
      linkHref: 'kdp.html', linkLabel: 'The Velvet Grimoire'
    }
  ];

  // ------------------------------------------------------------
  // HERO + SETTINGS
  // ------------------------------------------------------------
  function heroModel(h) {
    h = h || {};
    return {
      eyebrow: h.eyebrow != null ? str(h.eyebrow) : 'The morning call sheet',
      lines: Array.isArray(h.lines) && h.lines.length ? h.lines.map(str)
           : ['Decide what', 'you are capable', 'of today'],
      note: h.note != null ? str(h.note) : 'One answer, before anything else. It sets the workout, the meditation, and how much of yourself the day is allowed to ask for.',
      updatedAt: h.updatedAt || 0
    };
  }
  function getHero() { return heroModel(storeGet(KEYS.hero, null)); }
  function saveHero(patch) {
    var next = heroModel(Object.assign({}, getHero(), patch, { updatedAt: Date.now() }));
    storeSet(KEYS.hero, next);
    return next;
  }

  function getSettings() {
    var s = storeGet(KEYS.settings, {}) || {};
    return {
      activeTab: s.activeTab === 'selfcare' ? 'selfcare' : 'today',
      musicShelf: str(s.musicShelf) || 'playlists',
      // Which eight destinations Quick Launch shows, by main-nav.js id.
      // An empty array means "the default eight" — storing the default
      // would freeze it, so a later change to that list would never
      // reach a device that had simply never opened the picker.
      quickLaunch: Array.isArray(s.quickLaunch) ? s.quickLaunch.map(str) : []
    };
  }
  function saveSettings(patch) {
    var next = Object.assign({}, getSettings(), patch);
    storeSet(KEYS.settings, next);
    return next;
  }

  // ------------------------------------------------------------
  // THE EFFORT LEVEL — read straight through to the Fitness Studio.
  //
  // pal:levels is the single source of truth and palaestra-data.js
  // owns it. This page mounts the `palaestra` row (main-sync.js) so
  // the write syncs, and does NOT redefine the level list — Pal.LEVELS
  // stays exactly as the Fitness Studio wrote it.
  //
  // getLevel() DEFAULTS to 'high'. hasLevel() is how you tell "he
  // chose HIGH" from "he has not answered yet", and the card must
  // branch on it or every unanswered day silently reads as HIGH.
  // ------------------------------------------------------------
  function pal() { return global.Pal || null; }
  function getLevel(date) {
    var P = pal();
    if (P && P.getLevel) return P.getLevel(date || todayISO());
    var raw = storeGet('pal:levels', {}) || {};
    var v = raw[date || todayISO()];
    return LEVEL_KEYS.indexOf(v) !== -1 ? v : 'high';
  }
  function hasLevel(date) {
    var P = pal();
    if (P && P.hasLevel) return P.hasLevel(date || todayISO());
    var raw = storeGet('pal:levels', {}) || {};
    return LEVEL_KEYS.indexOf(raw[date || todayISO()]) !== -1;
  }
  function setLevel(date, level) {
    var P = pal();
    if (P && P.setLevel) return P.setLevel(date || todayISO(), level);
    return null;
  }
  function allLevels() {
    var P = pal();
    if (P && P.allLevels) return P.allLevels();
    return storeGet('pal:levels', {}) || {};
  }

  /**
   * Damian's own words for the three levels, kept HERE and not written
   * into Pal.LEVELS. The Fitness Studio's copy describes a training
   * session; this one describes a whole day. Two audiences, one value.
   */
  var LEVEL_COPY = {
    high: {
      name: 'High', title: 'The day you spend',
      mins: '60-min workout · 2 hours of work',
      blurb: 'What you do on a genuinely good day.',
      when: 'Energy, sleep and time are all there.'
    },
    mid: {
      name: 'Mid', title: 'The day you hold',
      mins: '40-min workout · 1 hour of work',
      blurb: 'What you do when you’re tired but can still function.',
      when: 'Mediocre sleep, a busy day, still standing.'
    },
    low: {
      name: 'Low', title: 'The day you keep',
      mins: '20-minute walk · one small thing',
      blurb: 'The bare minimum you can realistically handle when life kicks your ass.',
      when: 'This one isn’t meant to change your life overnight. It’s here so you stay consistent — because consistency is quite literally the key.'
    }
  };

  // ------------------------------------------------------------
  // CARRIED FORWARD FROM THE MORNING RITUAL — `routine:` keys.
  // See the header for why these did not move prefix.
  // ------------------------------------------------------------

  /** routine:config — { version, wake, lockStart }. Only lockStart is
      still used; version and wake are left untouched so an old device
      that has not updated yet still reads a well-formed record. */
  function ritualConfig() {
    var c = storeGet(R.config, {}) || {};
    return {
      version: c.version || 'hour',
      wake: c.wake || '06:30',
      lockStart: c.lockStart || todayISO()
    };
  }
  function saveRitualConfig(patch) {
    var next = Object.assign({}, ritualConfig(), patch);
    storeSet(R.config, next);
    return next;
  }

  var BELIEF_STATUSES = ['Working On', 'Integrated', 'Parked'];

  function beliefs() {
    var v = storeGet(R.beliefs, []);
    return Array.isArray(v) ? v : [];
  }
  function saveBeliefs(list) { return storeSet(R.beliefs, list || []); }
  /** The five: the beliefs actually being recited right now. */
  function working() {
    return beliefs().filter(function (b) { return b.status === 'Working On'; });
  }
  function updateBelief(id, patch, restartLock) {
    var all = beliefs(), i = all.findIndex(function (b) { return b.id === id; });
    if (i < 0) return null;
    all[i] = Object.assign({}, all[i], patch);
    saveBeliefs(all);
    if (restartLock) saveRitualConfig({ lockStart: todayISO() });
    return all[i];
  }
  function addBelief(fields) {
    var all = beliefs();
    var rec = Object.assign({
      id: uid('bl'), text: '', category: '', status: 'Working On', notes: ''
    }, fields || {});
    all.push(rec);
    saveBeliefs(all);
    saveRitualConfig({ lockStart: todayISO() });
    return rec;
  }
  function removeBelief(id) {
    saveBeliefs(beliefs().filter(function (b) { return b.id !== id; }));
    saveRitualConfig({ lockStart: todayISO() });
    return true;
  }

  /**
   * The 30-day recitation lock. `done` is elapsed days, capped at 30;
   * `day` is the 1-based day you are on.
   *
   * Editing, adding or deleting a belief restarts it — that rule is
   * the whole point of the lock and it predates this page.
   */
  function lockState() {
    var start = ritualConfig().lockStart;
    var elapsed = Math.max(0, daysBetween(start, todayISO()));
    return {
      start: start,
      done: Math.min(30, elapsed),
      day: Math.min(30, elapsed + 1),
      complete: elapsed >= 30
    };
  }
  function restartLock() { return saveRitualConfig({ lockStart: todayISO() }); }

  /** routine:log — the days-run history and the Frog metric. */
  function ritualLog() {
    var v = storeGet(R.log, {});
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }
  function ritualDay(date) {
    var d = ritualLog()[date || todayISO()];
    return { frog: !!(d && d.frog), caught: (d && d.caught) || null, version: (d && d.version) || '' };
  }
  function getFrog(date) { return ritualDay(date).frog; }
  function setFrog(date, on) {
    date = date || todayISO();
    var all = ritualLog();
    all[date] = Object.assign({}, all[date] || {}, { frog: !!on });
    storeSet(R.log, all);
    return !!on;
  }
  function setCaught(date, beliefId) {
    date = date || todayISO();
    var all = ritualLog();
    var cur = all[date] || {};
    all[date] = Object.assign({}, cur, { caught: cur.caught === beliefId ? null : beliefId });
    storeSet(R.log, all);
    return all[date].caught;
  }
  /** The last 30 days, oldest first — for the history strip. */
  function last30() {
    var all = ritualLog(), out = [], d, key, i;
    for (i = 29; i >= 0; i--) {
      d = new Date(); d.setDate(d.getDate() - i);
      key = todayISO(d);
      out.push({ date: key, day: d.getDate(), ran: !!all[key], frog: !!(all[key] && all[key].frog) });
    }
    return out;
  }
  function counts30() {
    var rows = last30();
    return {
      ran: rows.filter(function (r) { return r.ran; }).length,
      frog: rows.filter(function (r) { return r.frog; }).length
    };
  }

  /** routine:todayEntries — the three present-tense lines. */
  function intentions(date) {
    date = date || todayISO();
    var all = storeGet(R.today, []);
    all = Array.isArray(all) ? all : [];
    var e = all.find(function (x) { return x.date === date && !x.isExample; });
    return e || { id: null, date: date, intentions: ['', '', ''], ifthen: '', whyItMatters: '' };
  }
  function saveIntentions(date, patch) {
    date = date || todayISO();
    var all = storeGet(R.today, []);
    all = Array.isArray(all) ? all : [];
    var i = all.findIndex(function (x) { return x.date === date && !x.isExample; });
    if (i < 0) {
      all.push(Object.assign({
        id: uid('td'), date: date, intentions: ['', '', ''], ifthen: '', whyItMatters: '',
        isExample: false, createdAt: Date.now()
      }, patch));
    } else {
      all[i] = Object.assign({}, all[i], patch);
    }
    storeSet(R.today, all);
    return intentions(date);
  }

  /** routine:tonightEntries — evidence, reflection, gratitude. */
  function tonight(date) {
    date = date || todayISO();
    var all = storeGet(R.tonight, []);
    all = Array.isArray(all) ? all : [];
    var e = all.find(function (x) { return x.date === date && !x.isExample; });
    return e || { id: null, date: date, evidence: '', reflection: '', gratitude: '' };
  }
  function saveTonight(date, patch) {
    date = date || todayISO();
    var all = storeGet(R.tonight, []);
    all = Array.isArray(all) ? all : [];
    var i = all.findIndex(function (x) { return x.date === date && !x.isExample; });
    if (i < 0) {
      all.push(Object.assign({
        id: uid('tn'), date: date, evidence: '', reflection: '', gratitude: '',
        isExample: false, createdAt: Date.now()
      }, patch));
    } else {
      all[i] = Object.assign({}, all[i], patch);
    }
    storeSet(R.tonight, all);
    return tonight(date);
  }

  global.TodayData = {
    KEYS: KEYS, ROUTINE_KEYS: R,
    LEVEL_KEYS: LEVEL_KEYS, LEVEL_COPY: LEVEL_COPY, PHASES: PHASES,
    PHASE_LABEL: PHASE_LABEL, PHASE_START_LABEL: PHASE_START_LABEL,
    DAY_SUGGESTIONS: DAY_SUGGESTIONS,
    BELIEF_STATUSES: BELIEF_STATUSES,

    todayISO: todayISO, daysBetween: daysBetween, uid: uid, fmtTime: fmtTime,

    Routines: Routines, routinesFor: routinesFor, stepModel: stepModel,
    SEED: SEED, isEmpty: isEmpty, seeded: seeded, seedIfEmpty: seedIfEmpty,

    dayLog: dayLog, allLog: allLog, toggleStep: toggleStep, toggleSub: toggleSub,
    setPrompt: setPrompt, phaseProgress: phaseProgress,
    overallProgress: overallProgress, currentPhase: currentPhase,

    getSchedule: getSchedule, saveSchedule: saveSchedule,
    scheduleFor: scheduleFor, phaseTotal: phaseTotal,
    phaseStart: phaseStart, savePhaseStart: savePhaseStart,

    getHero: getHero, saveHero: saveHero,
    getSettings: getSettings, saveSettings: saveSettings,

    getLevel: getLevel, hasLevel: hasLevel, setLevel: setLevel, allLevels: allLevels,

    ritualConfig: ritualConfig, saveRitualConfig: saveRitualConfig,
    beliefs: beliefs, working: working, addBelief: addBelief,
    updateBelief: updateBelief, removeBelief: removeBelief, saveBeliefs: saveBeliefs,
    lockState: lockState, restartLock: restartLock,
    getFrog: getFrog, setFrog: setFrog, setCaught: setCaught,
    ritualDay: ritualDay, last30: last30, counts30: counts30,
    intentions: intentions, saveIntentions: saveIntentions,
    tonight: tonight, saveTonight: saveTonight
  };
})(window);
