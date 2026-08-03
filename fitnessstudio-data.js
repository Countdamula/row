// fitnessstudio-data.js
//
// Data layer for the new "Fitness Studio" nav folder (fitnessstudio.html),
// its own top-level page sitting between the Business Dashboard folder and
// the Entertainment folder in topbar.js's nav — genuinely separate from
// every other fitness-flavored surface already in this app: gym.html
// ("Fitness Studio", own STUDIO nav pill, `po_coach_v1` data) and
// index.html's own embedded Fitness Studio tab (`fitness:*` data). Nothing
// here reads or writes either of those — same "same name, genuinely
// separate data" precedent this app already has for e.g. Self-Care
// (index.html's tab vs. selfcare.html) and Fitness Studio itself.
//
// Same makeCollection/model-factory conventions as every other page's own
// -data.js (aitech-data.js, businessdash-data.js, etc.). Every key here is
// `fitstudio:`-prefixed, so one `initCloudSync({ appKey: 'fitnessstudio',
// syncedPrefixes: ['fitstudio:'] })` call in fitnessstudio.html covers
// everything — no per-key sync wiring needed.
//
// Confirmed adaptations (flagged, not silently substituted — same
// discipline this app's Writing Dashboard / Main Pillar / AI Coach
// features already established elsewhere):
//   - "Heart Rate (if wearable)" / "Wearable integrations" is a manual
//     paste-in field, not a real device API — this app has no backend to
//     hold OAuth tokens for a real wearable integration (see CLAUDE.md
//     §2). Same precedent as Main Pillar's own manual Whoop fields.
//   - "AI Fitness Coach" calls this app's one established client-side
//     fetch('https://api.anthropic.com/v1/messages', ...) pattern when a
//     real key is pasted into Settings; ANTHROPIC_API_KEY here is the
//     same inactive 'PASTE-...' placeholder every other AI-shaped feature
//     in this app ships with, so out of the box every coach response is a
//     locally-computed template built from real logged data instead of a
//     dead button — see coachLocalReply() below.
//   - Calories burned / macro adjustments are documented rough estimates
//     (a fixed kcal-per-kg-of-volume-lifted heuristic), not real
//     physiology — same "documented simplification" spirit as this app's
//     other computed-not-measured numbers (e.g. gym.html's estimated
//     workout duration).
//   - "Copy the exercises from the other fitness dashboard tab" was read
//     as: this app now has two other places called "Fitness Studio"
//     (gym.html's own STUDIO nav pill, po_coach_v1 data; index.html's own
//     embedded Fitness Studio main-tab, fitness:* data) — since it's
//     ambiguous which one "the other" means, importExercisesFromOther
//     FitnessStudios() below reads BOTH directly out of their own real
//     localStorage keys (po_coach_v1, fitness:templates/fitness:equipment)
//     and copies every real routine/template — including each exercise's
//     photo/video, sets/rep range/rest/notes/linked-equipment-name — in
//     as a new Custom-category program here. Same "read another page's
//     storage directly, never call its sync, never write back to it"
//     precedent as this app's tasks-data.js importers and topbar.js's own
//     buildLearningTopicItems() — this never touches po_coach_v1 or
//     fitness:* on disk, only reads them. Dedupe is tracked per-template
//     via importSource+importSourceId (see templateModel below), so
//     re-running it (the "↻ Import My Exercises" button) only ever adds
//     what's genuinely new, never duplicates or overwrites a program
//     that's since been customized here.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('fitstudio:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('fitstudio:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  // Same canvas-downscale-before-storage recipe every other page's cover
  // photo already uses (verbatim from businessdash-data.js) — new here
  // since this page previously had no cover-photo field wired to any UI.
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 900; quality = quality == null ? 0.8 : quality;
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL('image/jpeg', quality)); } catch (e) { resolve(dataUrl); }
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  // ============================================================
  // CONSTANTS
  // ============================================================
  var PROGRAM_CATEGORIES = ['Powerlifting', 'Hypertrophy', 'Athletic', 'Fat Loss', 'Strength', 'Calisthenics', 'Custom'];
  var PROGRAM_COLORS = ['#e8484f', '#f2a154', '#f2d24f', '#6ee7b7', '#7dd3fc', '#c9a5f0', '#f472b6'];
  var WEEKDAYS = [
    { key: 'mon', label: 'Monday' }, { key: 'tue', label: 'Tuesday' }, { key: 'wed', label: 'Wednesday' },
    { key: 'thu', label: 'Thursday' }, { key: 'fri', label: 'Friday' }, { key: 'sat', label: 'Saturday' },
    { key: 'sun', label: 'Sunday' }
  ];
  var THEMES = ['black', 'red', 'pink'];
  // Preset swatches for the adjustable page-background glow color (the
  // "DarkGradientBg"-style skewed streak effect) — a fixed 8-color palette
  // plus a native <input type="color"> for anything else, same "N preset
  // swatches + one custom picker" convention this app already uses
  // elsewhere (business.html's Workflow week-color picker, this file's
  // own PROGRAM_COLORS). '#00cfff' (index 0) matches the reference
  // component's own default cyan.
  var BG_GLOW_PRESETS = ['#00cfff', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#38bdf8', '#84cc16', '#ff3b4a'];

  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function isoWeekdayKey(d) {
    // Monday-first key, matching WEEKDAYS above (native getDay() is Sunday-first).
    var js = d.getDay();
    return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][js] === 'sun' ? 'sun' : WEEKDAYS[(js + 6) % 7].key;
  }

  // ============================================================
  // MODELS
  // ============================================================
  /** @typedef {{id:string,name:string,sets:number,repMin:number,repMax:number,
   * restSec:number,notes:string,photo:string,video:string,equipment:string,order:number}} FsExercise */
  function exerciseModel(data) {
    data = data || {};
    return {
      id: data.id || uid('fex'),
      name: typeof data.name === 'string' ? data.name : '',
      sets: typeof data.sets === 'number' ? data.sets : 3,
      repMin: typeof data.repMin === 'number' ? data.repMin : 8,
      repMax: typeof data.repMax === 'number' ? data.repMax : 12,
      restSec: typeof data.restSec === 'number' ? data.restSec : 90,
      notes: typeof data.notes === 'string' ? data.notes : '',
      photo: typeof data.photo === 'string' ? data.photo : '',
      video: typeof data.video === 'string' ? data.video : '',
      equipment: typeof data.equipment === 'string' ? data.equipment : '',
      order: typeof data.order === 'number' ? data.order : 0
    };
  }
  /** @typedef {{id:string,name:string,category:string,color:string,exercises:FsExercise[],order:number,createdAt:number,importSource:string,importSourceId:string}} FsTemplate */
  function templateModel(data) {
    data = data || {};
    var exs = Array.isArray(data.exercises) ? data.exercises.map(exerciseModel) : [];
    return {
      id: data.id || uid('ftpl'),
      name: typeof data.name === 'string' ? data.name : '',
      category: PROGRAM_CATEGORIES.indexOf(data.category) !== -1 ? data.category : 'Custom',
      color: typeof data.color === 'string' && data.color ? data.color : PROGRAM_COLORS[0],
      exercises: exs,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      // Purely additive — undefined on every pre-existing template, same
      // "treated as not-imported" default either way. Only ever set by
      // importExercisesFromOtherFitnessStudios() below, to dedupe repeat
      // imports without touching a program the user has since edited here.
      importSource: typeof data.importSource === 'string' ? data.importSource : '',
      importSourceId: typeof data.importSourceId === 'string' ? data.importSourceId : ''
    };
  }
  function noteModel(data) {
    data = data || {};
    return {
      id: data.id || uid('fnote'),
      title: typeof data.title === 'string' ? data.title : '',
      body: typeof data.body === 'string' ? data.body : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  function prModel(data) {
    data = data || {};
    return {
      id: data.id || uid('fpr'),
      exerciseName: typeof data.exerciseName === 'string' ? data.exerciseName : '',
      value: typeof data.value === 'number' ? data.value : 0,
      unit: typeof data.unit === 'string' ? data.unit : 'lb',
      reps: typeof data.reps === 'number' ? data.reps : 0,
      date: typeof data.date === 'string' ? data.date : todayISO(),
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  // ============================================================
  // GENERIC COLLECTION CRUD
  // ============================================================
  function makeCollection(key, model) {
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) {
      var record = model(data);
      var all = list(); all.push(record); storeSet(key, all); return record;
    }
    function update(id, patch) {
      var all = list();
      var idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      all[idx] = model(Object.assign({}, all[idx], patch, { id: id }));
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) {
      var all = list();
      var next = all.filter(function (x) { return x.id !== id; });
      storeSet(key, next);
      return next.length !== all.length;
    }
    function replaceAll(records) { storeSet(key, records); }
    function nextOrder() {
      var all = list();
      return all.length ? Math.max.apply(null, all.map(function (x) { return x.order || 0; })) + 1 : 0;
    }
    return { list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll, nextOrder: nextOrder };
  }
  var Templates = makeCollection('fitstudio:templates', templateModel);
  var Notes = makeCollection('fitstudio:notes', noteModel);
  var PRs = makeCollection('fitstudio:prs', prModel);

  function templatesSorted() { return Templates.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function templatesForCategory(cat) { return templatesSorted().filter(function (t) { return t.category === cat; }); }
  function notesSorted() { return Notes.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function prsForExercise(name) {
    return PRs.list().filter(function (p) { return p.exerciseName === name; }).sort(function (a, b) { return b.value - a.value; });
  }
  function bestPR(name) { var l = prsForExercise(name); return l.length ? l[0] : null; }

  // ============================================================
  // IMPORT FROM THE OTHER "FITNESS STUDIO" SURFACES — one-way,
  // read-only. Never writes to gym.html's po_coach_v1 or index.html's
  // fitness:* keys, only reads them (see this file's own header comment).
  // ============================================================
  /** gym.html's own state, straight out of its po_coach_v1 blob —
   * routines[] + exercises[] + an equipment[] lookup for a human-readable
   * equipment name (gym.html links equipment by id, this app's own
   * exercise model just wants a free-text label). media[] entries are
   * {type:'image'|'video', dataUrl} — dataUrl holds a plain URL now (gym.
   * html moved off file-upload to paste-a-URL a while back), but an older
   * base64 data: URI works exactly the same way here, no conversion
   * needed either way. */
  function readGymRoutines() {
    try {
      var raw = localStorage.getItem('po_coach_v1');
      if (!raw) return [];
      var state = JSON.parse(raw);
      var equipList = Array.isArray(state.equipment) ? state.equipment : [];
      function equipName(id) {
        var e = equipList.find(function (x) { return x && x.id === id; });
        return e && typeof e.name === 'string' ? e.name : '';
      }
      var routines = Array.isArray(state.routines) ? state.routines : [];
      return routines.map(function (r) {
        var exs = Array.isArray(r.exercises) ? r.exercises : [];
        return {
          sourceId: r.id, name: (typeof r.name === 'string' && r.name) ? r.name : 'Untitled Routine',
          exercises: exs.map(function (ex, i) {
            var media = Array.isArray(ex.media) ? ex.media : [];
            var photoItem = media.find(function (m) { return m && m.type === 'image'; });
            var videoItem = media.find(function (m) { return m && m.type === 'video'; });
            return {
              name: typeof ex.name === 'string' ? ex.name : '',
              sets: typeof ex.sets === 'number' ? ex.sets : undefined,
              repMin: typeof ex.repMin === 'number' ? ex.repMin : undefined,
              repMax: typeof ex.repMax === 'number' ? ex.repMax : undefined,
              restSec: typeof ex.restSec === 'number' ? ex.restSec : undefined,
              notes: typeof ex.notes === 'string' ? ex.notes : '',
              equipment: equipName(ex.equipmentId),
              photo: photoItem ? (photoItem.dataUrl || '') : '',
              video: videoItem ? (videoItem.dataUrl || '') : '',
              order: i
            };
          })
        };
      });
    } catch (e) { return []; }
  }
  /** index.html's own embedded Fitness Studio tab, straight out of its
   * fitness:templates (+ fitness:equipment for the same id→name lookup). */
  function readMainFitnessTemplates() {
    try {
      var raw = localStorage.getItem('fitness:templates');
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      var equipList = [];
      try { equipList = JSON.parse(localStorage.getItem('fitness:equipment') || '[]') || []; } catch (e2) { equipList = []; }
      function equipName(id) {
        var e = equipList.find(function (x) { return x && x.id === id; });
        return e && typeof e.name === 'string' ? e.name : '';
      }
      return arr.map(function (t) {
        var exs = Array.isArray(t.exercises) ? t.exercises : [];
        return {
          sourceId: t.id, name: (typeof t.name === 'string' && t.name) ? t.name : 'Untitled Program',
          exercises: exs.map(function (ex, i) {
            return {
              name: typeof ex.name === 'string' ? ex.name : '',
              sets: typeof ex.sets === 'number' ? ex.sets : undefined,
              repMin: typeof ex.repMin === 'number' ? ex.repMin : undefined,
              repMax: typeof ex.repMax === 'number' ? ex.repMax : undefined,
              restSec: typeof ex.restSec === 'number' ? ex.restSec : undefined,
              notes: typeof ex.notes === 'string' ? ex.notes : '',
              equipment: equipName(ex.equipmentId),
              photo: typeof ex.photoUrl === 'string' ? ex.photoUrl : '',
              video: typeof ex.videoUrl === 'string' ? ex.videoUrl : '',
              order: typeof ex.order === 'number' ? ex.order : i
            };
          })
        };
      });
    } catch (e) { return []; }
  }
  /** Copies every real routine/template found on the other two "Fitness
   * Studio" surfaces in as a new Custom-category program here, exercises
   * (incl. photo/video/notes/equipment label) and all. Idempotent — a
   * routine/template already imported once (tracked by importSource +
   * importSourceId) is skipped on every later call, so a program that's
   * since been renamed/edited/reorganized here is never touched or
   * duplicated. Returns how many new programs were actually added. */
  function importExercisesFromOtherFitnessStudios() {
    var added = 0;
    function alreadyImported(source, sourceId) {
      return Templates.list().some(function (t) { return t.importSource === source && t.importSourceId === sourceId; });
    }
    readGymRoutines().forEach(function (r) {
      if (!r.exercises.length || alreadyImported('gym', r.sourceId)) return;
      Templates.add({
        name: r.name, category: 'Custom', color: PROGRAM_COLORS[Templates.list().length % PROGRAM_COLORS.length],
        exercises: r.exercises, order: Templates.nextOrder(),
        importSource: 'gym', importSourceId: r.sourceId
      });
      added++;
    });
    readMainFitnessTemplates().forEach(function (t) {
      if (!t.exercises.length || alreadyImported('main', t.sourceId)) return;
      Templates.add({
        name: t.name, category: 'Custom', color: PROGRAM_COLORS[Templates.list().length % PROGRAM_COLORS.length],
        exercises: t.exercises, order: Templates.nextOrder(),
        importSource: 'main', importSourceId: t.sourceId
      });
      added++;
    });
    if (added) storeSet('fitstudio:lastImportedFromOtherStudiosAt', Date.now());
    return added;
  }
  /** Checks a just-logged set against the exercise's current best PR;
   * records + returns the new PR record if this set beats it (or is the
   * first ever logged for this exercise name), else returns null. This
   * is the trigger the UI layer uses to fire the confetti/badge moment. */
  function checkForPR(exerciseName, weight, reps) {
    if (!exerciseName || !weight) return null;
    var best = bestPR(exerciseName);
    if (best && weight <= best.value) return null;
    return PRs.add({ exerciseName: exerciseName, value: weight, reps: reps || 0, date: todayISO() });
  }

  // ============================================================
  // SCHEDULE — fitstudio:schedule = { mon: {templateId, label}, ... }
  // A day can carry a real templateId (renders that template's exercise
  // list) and/or a plain label (Rest/Recovery/anything freeform) — same
  // "day carries an optional template + an optional label" shape
  // index.html's own Fitness Studio tab already established.
  // ============================================================
  function getSchedule() {
    var raw = storeGet('fitstudio:schedule') || {};
    var out = {};
    WEEKDAYS.forEach(function (d) {
      var v = raw[d.key] || {};
      out[d.key] = { templateId: v.templateId || null, label: typeof v.label === 'string' ? v.label : '' };
    });
    return out;
  }
  function saveScheduleDay(dayKey, patch) {
    var sched = getSchedule();
    sched[dayKey] = Object.assign({}, sched[dayKey], patch);
    storeSet('fitstudio:schedule', sched);
    return sched[dayKey];
  }
  function templateForDay(dayKey) {
    var day = getSchedule()[dayKey];
    if (!day || !day.templateId) return null;
    return Templates.get(day.templateId);
  }

  // ============================================================
  // SETTINGS — one record, fitstudio:settings.
  // ============================================================
  function settingsModel(data) {
    data = data || {};
    return {
      units: data.units === 'metric' ? 'metric' : 'imperial',
      theme: THEMES.indexOf(data.theme) !== -1 ? data.theme : 'red',
      workoutLengthMin: typeof data.workoutLengthMin === 'number' ? data.workoutLengthMin : 60,
      notifications: !!data.notifications,
      wearableConnected: !!data.wearableConnected,
      aiTone: typeof data.aiTone === 'string' && data.aiTone ? data.aiTone : 'direct',
      aiFocus: typeof data.aiFocus === 'string' && data.aiFocus ? data.aiFocus : 'strength',
      anthropicKey: typeof data.anthropicKey === 'string' ? data.anthropicKey : '',
      // Adjustable page-background glow color (the skewed-streak
      // "DarkGradientBg" effect) — purely additive, defaults to the
      // reference component's own cyan for anyone who already had
      // settings saved before this field existed.
      bgGlowColor: /^#[0-9a-fA-F]{6}$/.test(data.bgGlowColor || '') ? data.bgGlowColor : BG_GLOW_PRESETS[0]
    };
  }
  function getSettings() { return settingsModel(storeGet('fitstudio:settings')); }
  function saveSettings(patch) {
    var next = settingsModel(Object.assign({}, getSettings(), patch));
    storeSet('fitstudio:settings', next);
    return next;
  }

  // ============================================================
  // SECTION LAYOUT — per an explicit "make everything on the page
  // moveable" request. A plain array of section keys, persisted
  // whenever GlassTheme.wireMovableSections() (glass-theme.js) reorders
  // #fsSectionsWrap. Any key missing from a saved layout (e.g. this
  // page's own "notes" key, new the same session Goal Center was
  // removed) is appended in default order by the page's own apply
  // logic, not here — this function just stores/returns the raw array.
  // ============================================================
  var DEFAULT_SECTION_ORDER = ['hero', 'notes', 'today', 'programs', 'schedule', 'consistency', 'coach'];
  function getSectionLayout() {
    var saved = storeGet('fitstudio:sectionLayout');
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_SECTION_ORDER.slice();
  }
  function saveSectionLayout(order) {
    if (!Array.isArray(order)) return;
    storeSet('fitstudio:sectionLayout', order);
  }
  function unitLabel(kind) {
    var u = getSettings().units;
    if (kind === 'weight') return u === 'metric' ? 'kg' : 'lb';
    if (kind === 'distance') return u === 'metric' ? 'km' : 'mi';
    return '';
  }

  // ============================================================
  // HERO — one editable record, fitstudio:hero.
  // ============================================================
  function heroModel(data) {
    data = data || {};
    return {
      name: typeof data.name === 'string' && data.name ? data.name : 'Damian',
      focus: typeof data.focus === 'string' ? data.focus : 'Upper Body Strength',
      quote: typeof data.quote === 'string' && data.quote ? data.quote : 'Discipline creates freedom.',
      weeklyGoalTarget: typeof data.weeklyGoalTarget === 'number' ? data.weeklyGoalTarget : 6,
      photo: typeof data.photo === 'string' ? data.photo : '',
      photoColor: typeof data.photoColor === 'string' ? data.photoColor : '',
      // Additive fields backing the new cover-photo hero (matches
      // businessdash.html's own top-level page hero recipe) — "name" and
      // "quote" (both already above) do double duty as that hero's
      // editable title/subtext, so there's still just one hero record,
      // not two competing ones.
      eyebrow: typeof data.eyebrow === 'string' ? data.eyebrow : 'FITNESS STUDIO',
      ctaLabel: typeof data.ctaLabel === 'string' && data.ctaLabel ? data.ctaLabel : "START TODAY'S WORKOUT"
    };
  }
  function getHero() { return heroModel(storeGet('fitstudio:hero')); }
  function saveHero(patch) {
    var next = heroModel(Object.assign({}, getHero(), patch));
    storeSet('fitstudio:hero', next);
    return next;
  }

  // ============================================================
  // DAY LOG — one record per date, fitstudio:log:<date>.
  //   sets: { exerciseId: [{weight, reps, ts}] }
  //   doneIds: [exerciseId, ...]  — completion checkmarks
  // ============================================================
  function dayLogModel(data) {
    data = data || {};
    return {
      templateId: data.templateId || null,
      startedAt: typeof data.startedAt === 'number' ? data.startedAt : null,
      endedAt: typeof data.endedAt === 'number' ? data.endedAt : null,
      sets: (data.sets && typeof data.sets === 'object') ? data.sets : {},
      doneIds: Array.isArray(data.doneIds) ? data.doneIds : [],
      waterMl: typeof data.waterMl === 'number' ? data.waterMl : 0,
      heartRateBpm: typeof data.heartRateBpm === 'number' ? data.heartRateBpm : null,
      notes: typeof data.notes === 'string' ? data.notes : ''
    };
  }
  function dayLogKey(date) { return 'fitstudio:log:' + date; }
  function getDayLog(date) { return dayLogModel(storeGet(dayLogKey(date))); }
  function saveDayLog(date, patch) {
    var next = dayLogModel(Object.assign({}, getDayLog(date), patch));
    storeSet(dayLogKey(date), next);
    return next;
  }
  function startWorkout(date, templateId) {
    return saveDayLog(date, { templateId: templateId, startedAt: Date.now(), endedAt: null });
  }
  function endWorkout(date) {
    return saveDayLog(date, { endedAt: Date.now() });
  }
  function logSet(date, exerciseId, weight, reps) {
    var log = getDayLog(date);
    var sets = Object.assign({}, log.sets);
    sets[exerciseId] = (sets[exerciseId] || []).concat([{ weight: weight, reps: reps, ts: Date.now() }]);
    return saveDayLog(date, { sets: sets });
  }
  function markExerciseDone(date, exerciseId, done) {
    var log = getDayLog(date);
    var ids = log.doneIds.filter(function (id) { return id !== exerciseId; });
    if (done) ids.push(exerciseId);
    return saveDayLog(date, { doneIds: ids });
  }
  function addWater(date, ml) {
    var log = getDayLog(date);
    return saveDayLog(date, { waterMl: Math.max(0, log.waterMl + ml) });
  }
  /** Every logged set's weight*reps, summed — this template's or the
   * whole day's total volume lifted, whichever is asked for. */
  function volumeForDate(date) {
    var log = getDayLog(date);
    var total = 0;
    Object.keys(log.sets).forEach(function (exId) {
      log.sets[exId].forEach(function (s) { total += (s.weight || 0) * (s.reps || 0); });
    });
    return total;
  }
  function setCountForDate(date) {
    var log = getDayLog(date);
    var n = 0;
    Object.keys(log.sets).forEach(function (exId) { n += log.sets[exId].length; });
    return n;
  }
  /** A documented rough estimate, not real physiology (see this file's
   * own header comment) — roughly 0.005 kcal per lb of volume lifted
   * (a commonly cited ballpark for resistance work) plus a flat
   * per-minute baseline so a short, low-volume session still shows a
   * plausible non-zero number. */
  function estimatedCalories(volumeLb, durationMin) {
    return Math.round(volumeLb * 0.005 + (durationMin || 0) * 4.2);
  }
  function isWorkoutComplete(date) {
    var log = getDayLog(date);
    return !!log.endedAt;
  }

  // ============================================================
  // STREAKS / WEEKLY PROGRESS
  // ============================================================
  function startOfWeek(d) {
    var day = (d.getDay() + 6) % 7; // Monday = 0
    var monday = new Date(d);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(d.getDate() - day);
    return monday;
  }
  function weekDatesFor(d) {
    var mon = startOfWeek(d);
    var out = [];
    for (var i = 0; i < 7; i++) {
      var dt = new Date(mon); dt.setDate(mon.getDate() + i);
      out.push(dt.toISOString().slice(0, 10));
    }
    return out;
  }
  function weeklyCompletionCount(refDate) {
    var dates = weekDatesFor(refDate || new Date());
    return dates.filter(isWorkoutComplete).length;
  }
  function weeklyGoalTarget() { return getHero().weeklyGoalTarget || 6; }
  /** Consecutive days back from today (inclusive) with a completed
   * workout — walks backward day by day until it hits one that isn't. */
  function currentStreak() {
    var n = 0;
    var d = new Date();
    for (;;) {
      var iso = d.toISOString().slice(0, 10);
      if (!isWorkoutComplete(iso)) break;
      n++;
      d.setDate(d.getDate() - 1);
      if (n > 3650) break; // sanity cap
    }
    return n;
  }
  /** Last N weeks x 7 days of workout intensity (0 = nothing logged, 1-3
   * scaled by set count) for the consistency heatmap — same
   * GitHub-contribution-grid convention this app's other pages already
   * use (projects.html, mainpillar.html, gym.html). */
  function heatmapWeeks(numWeeks) {
    numWeeks = numWeeks || 12;
    var today = new Date();
    var mondayThisWeek = startOfWeek(today);
    var weeks = [];
    for (var w = numWeeks - 1; w >= 0; w--) {
      var weekStart = new Date(mondayThisWeek);
      weekStart.setDate(mondayThisWeek.getDate() - w * 7);
      var days = [];
      for (var i = 0; i < 7; i++) {
        var dt = new Date(weekStart); dt.setDate(weekStart.getDate() + i);
        var iso = dt.toISOString().slice(0, 10);
        var sets = setCountForDate(iso);
        var level = sets === 0 ? 0 : sets <= 3 ? 1 : sets <= 8 ? 2 : 3;
        days.push({ date: iso, level: level, complete: isWorkoutComplete(iso) });
      }
      weeks.push(days);
    }
    return weeks;
  }

  // ============================================================
  // PROGRESSION — a simplified version of gym.html's own
  // last-logged-set + rep-range-threshold prescription engine, stored
  // per exercise NAME (not id, so it survives an exercise being edited/
  // recreated across templates) under fitstudio:progression.
  // ============================================================
  function getProgression() { return storeGet('fitstudio:progression') || {}; }
  function suggestedWeight(exercise) {
    var prog = getProgression()[exercise.name];
    if (!prog) return { weight: null, note: 'No history yet — log a set to start tracking.' };
    var midReps = (exercise.repMin + exercise.repMax) / 2;
    if (prog.lastAvgReps >= exercise.repMax) return { weight: Math.round((prog.lastWeight + 5) * 10) / 10, note: 'Hit the top of your rep range last time — add weight.' };
    if (prog.lastAvgReps < exercise.repMin) return { weight: Math.round((prog.lastWeight - 5) * 10) / 10, note: 'Fell short of the rep range last time — consider a slight deload.' };
    return { weight: prog.lastWeight, note: 'Hold steady and aim for ' + Math.round(midReps) + ' reps.' };
  }
  function recordProgression(exerciseName, avgWeight, avgReps) {
    var prog = getProgression();
    prog[exerciseName] = { lastWeight: avgWeight, lastAvgReps: avgReps, updatedAt: Date.now() };
    storeSet('fitstudio:progression', prog);
  }
  /** Rolls up today's logged sets for one exercise into the progression
   * map — called once a workout is marked done. */
  function recordProgressionFromLog(date, templateId) {
    var log = getDayLog(date);
    var tpl = Templates.get(templateId);
    if (!tpl) return;
    tpl.exercises.forEach(function (ex) {
      var sets = log.sets[ex.id];
      if (!sets || !sets.length) return;
      var totalW = 0, totalR = 0;
      sets.forEach(function (s) { totalW += s.weight || 0; totalR += s.reps || 0; });
      recordProgression(ex.name, Math.round((totalW / sets.length) * 10) / 10, Math.round(totalR / sets.length));
      checkForPR(ex.name, Math.max.apply(null, sets.map(function (s) { return s.weight || 0; })), 0);
    });
  }

  // ============================================================
  // EQUIPMENT SUBSTITUTIONS — a small static lookup keyed by a
  // case-insensitive substring match against the exercise name, the
  // same "keyword-match, not real NLP" simplification this app's other
  // AI-shaped features already use and flag (Writing Dashboard's
  // trackers, Business Hub's chapter scan, etc.).
  // ============================================================
  var SUBSTITUTIONS = [
    { match: 'bench press', subs: ['Dumbbell floor press', 'Push-ups (weighted if needed)', 'Resistance band chest press'] },
    { match: 'squat', subs: ['Goblet squat', 'Bulgarian split squat', 'Walking lunges'] },
    { match: 'deadlift', subs: ['Romanian deadlift with dumbbells', 'Kettlebell swings', 'Good mornings'] },
    { match: 'pull-up', subs: ['Lat pulldown', 'Band-assisted pull-ups', 'Inverted rows'] },
    { match: 'row', subs: ['Resistance band rows', 'Single-arm dumbbell rows', 'Inverted rows'] },
    { match: 'overhead press', subs: ['Dumbbell shoulder press', 'Pike push-ups', 'Resistance band press'] },
    { match: 'shoulder press', subs: ['Dumbbell shoulder press', 'Pike push-ups', 'Resistance band press'] },
    { match: 'curl', subs: ['Resistance band curls', 'Isometric curl holds', 'Towel curls'] },
    { match: 'lateral raise', subs: ['Resistance band lateral raise', 'Water-bottle lateral raise'] },
    { match: 'triceps', subs: ['Diamond push-ups', 'Bench dips', 'Resistance band pushdowns'] },
    { match: 'leg press', subs: ['Bodyweight squats', 'Step-ups', 'Wall sit + lunges'] }
  ];
  function substitutionFor(exerciseName) {
    var lower = (exerciseName || '').toLowerCase();
    var found = SUBSTITUTIONS.find(function (s) { return lower.indexOf(s.match) !== -1; });
    return found ? found.subs : ['Any similar movement pattern targeting the same muscle group with what you have on hand.'];
  }
  var TECHNIQUE_TIPS = [
    { match: 'bench press', tip: 'Keep your shoulder blades pinned back and down, feet flat on the floor, and lower the bar to your lower chest under control.' },
    { match: 'squat', tip: 'Brace your core before descending, keep your knees tracking over your toes, and hit at least parallel depth for full benefit.' },
    { match: 'deadlift', tip: 'Keep the bar close to your shins the whole way up, hips and shoulders rising together, and avoid rounding your lower back.' },
    { match: 'pull-up', tip: 'Start from a full dead hang, pull your elbows down and back, and avoid kipping if you\'re training strength.' },
    { match: 'overhead press', tip: 'Brace your core and glutes, press in a straight line, and finish with your bicep by your ear.' },
    { match: 'row', tip: 'Lead with your elbows, squeeze your shoulder blades together at the top, and avoid using momentum.' }
  ];
  function techniqueAnswer(exerciseNameOrQuery) {
    var lower = (exerciseNameOrQuery || '').toLowerCase();
    var found = TECHNIQUE_TIPS.find(function (t) { return lower.indexOf(t.match) !== -1; });
    if (found) return found.tip;
    return 'Focus on a controlled tempo, full range of motion, and keeping tension on the target muscle throughout the movement — form beats load every time.';
  }

  // ============================================================
  // AI COACH — chat log + a local template-based reply generator that
  // covers every capability the request listed, built from real logged
  // data rather than fabricated. Real fetch() to the Anthropic API is
  // attempted first (see this file's own header comment on why it's
  // inactive by default).
  // ============================================================
  var ChatLog = makeCollection('fitstudio:aiChat', function (data) {
    data = data || {};
    return {
      id: data.id || uid('fchat'),
      role: data.role === 'ai' ? 'ai' : 'user',
      text: typeof data.text === 'string' ? data.text : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  });
  function chatSorted() { return ChatLog.list().slice().sort(function (a, b) { return a.createdAt - b.createdAt; }); }
  function addChatMessage(role, text) {
    return ChatLog.add({ role: role, text: text, order: ChatLog.nextOrder() });
  }

  function coachLocalReply(userText) {
    var lower = (userText || '').toLowerCase();
    var settings = getSettings();
    var recentVol = 0, recentDays = 0;
    var today = new Date();
    for (var i = 0; i < 7; i++) {
      var d = new Date(today); d.setDate(today.getDate() - i);
      var iso = d.toISOString().slice(0, 10);
      var v = volumeForDate(iso);
      if (v > 0) { recentVol += v; recentDays++; }
    }
    var streak = currentStreak();
    var target = weeklyGoalTarget();
    var completed = weeklyCompletionCount();

    // Technique question — a real exercise name (or "how do I"/"form")
    // mentioned in the message.
    var techMatch = TECHNIQUE_TIPS.find(function (t) { return lower.indexOf(t.match) !== -1; });
    if (techMatch || lower.indexOf('form') !== -1 || lower.indexOf('technique') !== -1) {
      return techniqueAnswer(userText);
    }
    // Substitution request.
    if (lower.indexOf('substitut') !== -1 || lower.indexOf('instead of') !== -1 || lower.indexOf('don’t have') !== -1 || lower.indexOf('dont have') !== -1) {
      var exNames = templatesSorted().reduce(function (acc, t) { return acc.concat(t.exercises.map(function (e) { return e.name; })); }, []);
      var mentioned = exNames.find(function (n) { return n && lower.indexOf(n.toLowerCase()) !== -1; });
      var subs = substitutionFor(mentioned || userText);
      return (mentioned ? 'For ' + mentioned + ', try: ' : 'A few solid substitutions: ') + subs.join(', ') + '.';
    }
    // Weekly plan generation.
    if (lower.indexOf('weekly plan') !== -1 || lower.indexOf('generate') !== -1 || lower.indexOf('plan for') !== -1) {
      var cats = templatesSorted().slice(0, 5).map(function (t) { return t.name; });
      if (!cats.length) return 'You don’t have any Workout Programs yet — add a few templates first and I can build a weekly split around them.';
      return 'A balanced split using what you’ve already built: ' + cats.join(' → ') + ', with at least one full rest day. Assign these on your Weekly Schedule below and I’ll factor completion into future suggestions.';
    }
    // Macro adjustment (documented rough heuristic).
    if (lower.indexOf('macro') !== -1) {
      if (recentDays === 0) return 'I don’t have enough logged workouts this week yet to suggest a macro adjustment — log a session or two and ask again.';
      var trend = recentVol > 15000 ? 'high' : recentVol > 6000 ? 'moderate' : 'light';
      var note = trend === 'high' ? 'Consider nudging protein and total calories up slightly to support recovery.' : trend === 'moderate' ? 'Your current intake is probably in the right range — hold steady.' : 'Volume has been light this week — no need to over-adjust, just stay consistent.';
      return 'This is a rough estimate, not real macro science: training volume this week reads as ' + trend + ' (~' + Math.round(recentVol) + ' ' + unitLabel('weight') + ' total). ' + note;
    }
    // Recovery trend.
    if (lower.indexOf('recover') !== -1) {
      if (streak >= 5) return 'You’re on a ' + streak + '-day streak — solid consistency. Make sure at least one of your scheduled days is genuine recovery (not just lighter lifting) so it doesn’t catch up with you.';
      if (recentDays === 0) return 'No workouts logged in the last 7 days — recovery isn’t the concern right now, getting back to a session is.';
      return 'You’ve trained ' + recentDays + ' of the last 7 days. That’s a reasonable recovery balance — keep an eye on sleep and soreness before adding more volume.';
    }
    // Volume estimate.
    if (lower.indexOf('volume') !== -1) {
      return 'Total volume lifted over the last 7 days: about ' + Math.round(recentVol) + ' ' + unitLabel('weight') + ' across ' + recentDays + ' session' + (recentDays === 1 ? '' : 's') + '.';
    }
    // Progressive overload for a specific exercise.
    var progMentioned = Object.keys(getProgression()).find(function (n) { return lower.indexOf(n.toLowerCase()) !== -1; });
    if (progMentioned || lower.indexOf('overload') !== -1 || lower.indexOf('how much weight') !== -1 || lower.indexOf('increase') !== -1) {
      if (progMentioned) {
        var ex = { name: progMentioned, repMin: 8, repMax: 12 };
        var sug = suggestedWeight(ex);
        return progMentioned + ': ' + sug.note + (sug.weight != null ? ' Suggested target: ' + sug.weight + ' ' + unitLabel('weight') + '.' : '');
      }
      return 'Log a set or two for the exercise you’re asking about and I’ll base a real suggestion on your own numbers instead of guessing.';
    }
    // Default: a general log analysis / status summary.
    return 'This week: ' + completed + '/' + target + ' workouts completed, a ' + streak + '-day streak, and ' + Math.round(recentVol) + ' ' + unitLabel('weight') + ' of volume lifted over the last 7 days. Ask me about progressive overload, substitutions, recovery, macros, or exercise technique for something specific.';
  }

  var ANTHROPIC_API_KEY_PLACEHOLDER_PREFIX = 'PASTE-';
  function callAI(prompt, apiKey) {
    if (!apiKey || apiKey.indexOf(ANTHROPIC_API_KEY_PLACEHOLDER_PREFIX) === 0) return Promise.resolve(null);
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.content || !data.content[0]) return null;
        return data.content[0].text || null;
      })
      .catch(function () { return null; });
  }
  /** Always resolves to a string — real AI reply if a working key is
   * configured, else the local template reply above. Never a dead
   * button either way. */
  function coachReply(userText) {
    var settings = getSettings();
    var key = settings.anthropicKey || 'PASTE-YOUR-ANTHROPIC-API-KEY-HERE';
    var context = 'You are a fitness coach embedded in a personal dashboard. Tone: ' + settings.aiTone + '. Focus area: ' + settings.aiFocus + '. ' +
      'This week: ' + weeklyCompletionCount() + '/' + weeklyGoalTarget() + ' workouts completed, current streak ' + currentStreak() + ' days. ' +
      'Answer briefly and concretely. User message: ' + userText;
    return callAI(context, key).then(function (aiText) {
      return aiText || coachLocalReply(userText);
    });
  }

  // ============================================================
  // SEED
  // ============================================================
  function isEmptyEverywhere() {
    return Templates.list().length === 0 && Notes.list().length === 0;
  }
  function seedDefaultData() {
    Templates.replaceAll([]); Notes.replaceAll([]); PRs.replaceAll([]);
    storeSet('fitstudio:schedule', {});

    var push = Templates.add({
      name: 'Push Day', category: 'Hypertrophy', color: PROGRAM_COLORS[0], order: 0,
      exercises: [
        exerciseModel({ name: 'Bench Press', sets: 4, repMin: 6, repMax: 8, restSec: 150, order: 0 }),
        exerciseModel({ name: 'Incline Dumbbell Press', sets: 3, repMin: 8, repMax: 12, restSec: 120, order: 1 }),
        exerciseModel({ name: 'Shoulder Press', sets: 3, repMin: 8, repMax: 10, restSec: 120, order: 2 }),
        exerciseModel({ name: 'Lateral Raises', sets: 3, repMin: 12, repMax: 15, restSec: 60, order: 3 }),
        exerciseModel({ name: 'Triceps Pushdowns', sets: 3, repMin: 10, repMax: 15, restSec: 60, order: 4 }),
        exerciseModel({ name: 'Overhead Extensions', sets: 3, repMin: 10, repMax: 12, restSec: 60, order: 5 })
      ]
    });
    var pull = Templates.add({
      name: 'Pull Day', category: 'Hypertrophy', color: PROGRAM_COLORS[3], order: 1,
      exercises: [
        exerciseModel({ name: 'Deadlift', sets: 3, repMin: 4, repMax: 6, restSec: 180, order: 0 }),
        exerciseModel({ name: 'Pull-Ups', sets: 4, repMin: 6, repMax: 10, restSec: 120, order: 1 }),
        exerciseModel({ name: 'Barbell Row', sets: 3, repMin: 8, repMax: 10, restSec: 120, order: 2 }),
        exerciseModel({ name: 'Face Pulls', sets: 3, repMin: 12, repMax: 15, restSec: 60, order: 3 }),
        exerciseModel({ name: 'Bicep Curl', sets: 3, repMin: 10, repMax: 12, restSec: 60, order: 4 })
      ]
    });
    var legs = Templates.add({
      name: 'Leg Day', category: 'Strength', color: PROGRAM_COLORS[4], order: 2,
      exercises: [
        exerciseModel({ name: 'Squat', sets: 4, repMin: 5, repMax: 8, restSec: 180, order: 0 }),
        exerciseModel({ name: 'Romanian Deadlift', sets: 3, repMin: 8, repMax: 10, restSec: 120, order: 1 }),
        exerciseModel({ name: 'Leg Press', sets: 3, repMin: 10, repMax: 12, restSec: 120, order: 2 }),
        exerciseModel({ name: 'Walking Lunges', sets: 3, repMin: 12, repMax: 15, restSec: 90, order: 3 })
      ]
    });

    storeSet('fitstudio:schedule', {
      mon: { templateId: push.id, label: 'Push' },
      tue: { templateId: pull.id, label: 'Pull' },
      wed: { templateId: legs.id, label: 'Legs' },
      thu: { templateId: null, label: 'Recovery' },
      fri: { templateId: push.id, label: 'Upper' },
      sat: { templateId: legs.id, label: 'Lower' },
      sun: { templateId: null, label: 'Rest' }
    });

    Notes.add({ title: 'Form Cues', body: 'Reminders to check before a heavy set — brace, neutral spine, full range of motion.', order: 0 });
    Notes.add({ title: 'This Month', body: 'What I\'m focused on right now.', order: 1 });

    saveHero({});
    saveSettings({});
    storeSet('fitstudio:seeded', true);
  }
  function seedIfEmpty() {
    if (storeGet('fitstudio:seeded')) return;
    if (!isEmptyEverywhere()) { storeSet('fitstudio:seeded', true); return; }
    seedDefaultData();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.FitStudioData = {
    PROGRAM_CATEGORIES: PROGRAM_CATEGORIES, PROGRAM_COLORS: PROGRAM_COLORS, WEEKDAYS: WEEKDAYS, THEMES: THEMES,
    BG_GLOW_PRESETS: BG_GLOW_PRESETS,
    Templates: Templates, Notes: Notes, PRs: PRs, ChatLog: ChatLog,
    exerciseModel: exerciseModel, templateModel: templateModel,
    templatesSorted: templatesSorted, templatesForCategory: templatesForCategory,
    notesSorted: notesSorted, prsForExercise: prsForExercise, bestPR: bestPR, checkForPR: checkForPR,
    importExercisesFromOtherFitnessStudios: importExercisesFromOtherFitnessStudios,
    getSchedule: getSchedule, saveScheduleDay: saveScheduleDay, templateForDay: templateForDay,
    getSettings: getSettings, saveSettings: saveSettings, unitLabel: unitLabel,
    getHero: getHero, saveHero: saveHero, compressImageDataUrl: compressImageDataUrl,
    getSectionLayout: getSectionLayout, saveSectionLayout: saveSectionLayout, DEFAULT_SECTION_ORDER: DEFAULT_SECTION_ORDER,
    getDayLog: getDayLog, saveDayLog: saveDayLog, startWorkout: startWorkout, endWorkout: endWorkout,
    logSet: logSet, markExerciseDone: markExerciseDone, addWater: addWater,
    volumeForDate: volumeForDate, setCountForDate: setCountForDate, estimatedCalories: estimatedCalories,
    isWorkoutComplete: isWorkoutComplete,
    weekDatesFor: weekDatesFor, weeklyCompletionCount: weeklyCompletionCount, weeklyGoalTarget: weeklyGoalTarget,
    currentStreak: currentStreak, heatmapWeeks: heatmapWeeks,
    suggestedWeight: suggestedWeight, recordProgression: recordProgression, recordProgressionFromLog: recordProgressionFromLog,
    substitutionFor: substitutionFor, techniqueAnswer: techniqueAnswer,
    chatSorted: chatSorted, addChatMessage: addChatMessage, coachReply: coachReply, coachLocalReply: coachLocalReply,
    todayISO: todayISO, isoWeekdayKey: isoWeekdayKey,
    isEmptyEverywhere: isEmptyEverywhere, seedDefaultData: seedDefaultData, seedIfEmpty: seedIfEmpty
  };
})(window);
