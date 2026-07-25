// fitness-data.js
//
// Data foundation for the "Fitness Studio" tab merged into index.html
// (Main) — a dedicated 4th main tab, separate from the standalone
// gym.html page of the same name (see CLAUDE.md for that discrepancy;
// this is a deliberate, explicitly-requested second page under the same
// name, not a rebuild of gym.html). Same conventions as every other
// -data.js in this app: plain localStorage, JSON-serialized, one key per
// collection, no server/DB. Everything lives under a `fitness:` prefix
// so index.html's existing initCloudSync({ appKey: 'goals', syncedPrefixes:
// [...] }) call covers it once `'fitness:'` is added to that list — no
// new sync mechanism.
//
// Day records (`fitness:day:<date>`) are individual date-keyed keys, the
// same convention mainpillar-data.js already uses for
// `mainpillar:whoop:<date>`/`mainpillar:habitlog:<date>` — still covered
// by the one `fitness:` prefix, no per-key sync list needed.

(function (global) {
  'use strict';

  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('fitness:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('fitness:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    templates: 'fitness:templates',
    equipment: 'fitness:equipment',
    progression: 'fitness:progression',
    activeTab: 'fitness:active_tab',
    activeDay: 'fitness:active_day',
    seeded: 'fitness:seeded'
  };
  function dayKey(dateStr) { return 'fitness:day:' + dateStr; }

  function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function weekdayIndex(dateStr) { return new Date(dateStr + 'T00:00:00').getDay(); }
  function dateForWeekday(idx) {
    // Nearest date (today or one of the next 6 days) landing on weekday idx.
    const d = new Date();
    const cur = d.getDay();
    let delta = idx - cur; if (delta < 0) delta += 7;
    d.setDate(d.getDate() + delta);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  const TEMPLATE_COLORS = ['gold', 'good', 'warn', 'bad', 'info', 'accent-bright'];

  // ============================================================
  // MODELS
  // ============================================================
  function exerciseModel(data) {
    data = data || {};
    return {
      id: data.id || uid('ex'),
      name: typeof data.name === 'string' ? data.name : '',
      sets: typeof data.sets === 'number' ? data.sets : 3,
      repMin: typeof data.repMin === 'number' ? data.repMin : 8,
      repMax: typeof data.repMax === 'number' ? data.repMax : 12,
      restSec: typeof data.restSec === 'number' ? data.restSec : 60,
      notes: typeof data.notes === 'string' ? data.notes : '',
      photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
      videoUrl: typeof data.videoUrl === 'string' ? data.videoUrl : '',
      equipmentId: data.equipmentId || null,
      targetWeight: typeof data.targetWeight === 'number' ? data.targetWeight : 0,
      order: typeof data.order === 'number' ? data.order : 0
    };
  }

  function templateModel(data) {
    data = data || {};
    const scheduledDays = Array.isArray(data.scheduledDays)
      ? data.scheduledDays.filter(function (d) { return typeof d === 'number' && d >= 0 && d <= 6; })
      : [];
    return {
      id: data.id || uid('tpl'),
      name: typeof data.name === 'string' ? data.name : '',
      gymType: typeof data.gymType === 'string' ? data.gymType : '',
      color: TEMPLATE_COLORS.indexOf(data.color) !== -1 ? data.color : TEMPLATE_COLORS[0],
      scheduledDays: scheduledDays,
      exercises: Array.isArray(data.exercises) ? data.exercises.map(exerciseModel) : [],
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }

  function equipmentModel(data) {
    data = data || {};
    let weights = Array.isArray(data.weights) ? data.weights.filter(function (w) { return typeof w === 'number'; }) : [];
    return {
      id: data.id || uid('eq'),
      name: typeof data.name === 'string' ? data.name : '',
      type: typeof data.type === 'string' ? data.type : 'Other',
      weights: weights,
      notes: typeof data.notes === 'string' ? data.notes : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const EQUIPMENT_TYPES = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Band', 'Kettlebell', 'Other'];

  function dayRecordModel(data, date) {
    data = data || {};
    return {
      date: date,
      exerciseDone: (data.exerciseDone && typeof data.exerciseDone === 'object') ? data.exerciseDone : {},
      logs: Array.isArray(data.logs) ? data.logs : [],
      complete: !!data.complete,
      completedAt: typeof data.completedAt === 'number' ? data.completedAt : null,
      review: (data.review && typeof data.review === 'object') ? data.review : null
    };
  }
  function getDayRecord(date) { return dayRecordModel(storeGet(dayKey(date)), date); }
  function saveDayRecord(date, patch) {
    const next = dayRecordModel(Object.assign({}, getDayRecord(date), patch), date);
    storeSet(dayKey(date), next);
    return next;
  }

  // ============================================================
  // GENERIC COLLECTION CRUD
  // ============================================================
  function makeCollection(key, model) {
    function list() { return storeGet(key) || []; }
    function get(id) { return list().find(function (x) { return x.id === id; }) || null; }
    function add(data) {
      const record = model(data);
      const all = list();
      all.push(record);
      storeSet(key, all);
      return record;
    }
    function update(id, patch) {
      const all = list();
      const idx = all.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      all[idx] = model(Object.assign({}, all[idx], patch, { id: id }));
      storeSet(key, all);
      return all[idx];
    }
    function remove(id) {
      const all = list();
      const next = all.filter(function (x) { return x.id !== id; });
      storeSet(key, next);
      return next.length !== all.length;
    }
    function replaceAll(records) { storeSet(key, records); }
    return { list: list, get: get, add: add, update: update, remove: remove, replaceAll: replaceAll };
  }

  const Templates = makeCollection(KEYS.templates, templateModel);
  const Equipment = makeCollection(KEYS.equipment, equipmentModel);

  function nextOrder(list) { return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0; }
  function moveInCollection(coll, id, dir) {
    const all = coll.list();
    const sorted = all.slice().sort(function (a, b) { return a.order - b.order; });
    const idx = sorted.findIndex(function (x) { return x.id === id; });
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const idA = sorted[idx].id, idB = sorted[swapIdx].id;
    const orderA = sorted[idx].order, orderB = sorted[swapIdx].order;
    const next = all.map(function (x) {
      if (x.id === idA) return Object.assign({}, x, { order: orderB });
      if (x.id === idB) return Object.assign({}, x, { order: orderA });
      return x;
    });
    coll.replaceAll(next);
  }

  // Exercises live inline on a Template (same convention as a Content
  // Plan Card's inline checklist, or a Workflow Day's inline blocks) —
  // no separate collection, so deleting a Template deletes its
  // exercises with it.
  function moveExercise(templateId, exerciseId, dir) {
    const t = Templates.get(templateId);
    if (!t) return;
    const sorted = t.exercises.slice().sort(function (a, b) { return a.order - b.order; });
    const idx = sorted.findIndex(function (x) { return x.id === exerciseId; });
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    const orderA = a.order, orderB = b.order;
    const nextExercises = t.exercises.map(function (x) {
      if (x.id === a.id) return Object.assign({}, x, { order: orderB });
      if (x.id === b.id) return Object.assign({}, x, { order: orderA });
      return x;
    });
    Templates.update(templateId, { exercises: nextExercises });
  }
  function addExerciseToTemplate(templateId, data) {
    const t = Templates.get(templateId);
    if (!t) return null;
    const ex = exerciseModel(Object.assign({}, data, { order: nextOrder(t.exercises) }));
    Templates.update(templateId, { exercises: t.exercises.concat([ex]) });
    return ex;
  }
  function updateExerciseInTemplate(templateId, exerciseId, patch) {
    const t = Templates.get(templateId);
    if (!t) return null;
    let updated = null;
    const nextExercises = t.exercises.map(function (x) {
      if (x.id !== exerciseId) return x;
      updated = exerciseModel(Object.assign({}, x, patch, { id: exerciseId }));
      return updated;
    });
    Templates.update(templateId, { exercises: nextExercises });
    return updated;
  }
  function removeExerciseFromTemplate(templateId, exerciseId) {
    const t = Templates.get(templateId);
    if (!t) return;
    Templates.update(templateId, { exercises: t.exercises.filter(function (x) { return x.id !== exerciseId; }) });
  }
  function findExercise(exerciseId) {
    const all = Templates.list();
    for (let i = 0; i < all.length; i++) {
      const hit = all[i].exercises.find(function (x) { return x.id === exerciseId; });
      if (hit) return { exercise: hit, template: all[i] };
    }
    return null;
  }

  // Deleting equipment nulls the reference on any exercise that used it,
  // rather than deleting the exercise — same null-out-the-reference
  // precedent as household-data.js's legion deletion / aitech-data.js's
  // model deletion / business-data.js's week-day deletion.
  function deleteEquipment(equipmentId) {
    const templates = Templates.list();
    const next = templates.map(function (t) {
      const nextExercises = t.exercises.map(function (ex) {
        return ex.equipmentId === equipmentId ? Object.assign({}, ex, { equipmentId: null }) : ex;
      });
      return Object.assign({}, t, { exercises: nextExercises });
    });
    Templates.replaceAll(next);
    Equipment.remove(equipmentId);
  }

  // ============================================================
  // SELECTORS
  // ============================================================
  function templatesSorted() { return Templates.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function equipmentSorted() { return Equipment.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function templatesForDay(dayIdx) {
    return templatesSorted().filter(function (t) { return t.scheduledDays.indexOf(dayIdx) !== -1; });
  }
  function exercisesForDay(dayIdx) {
    const out = [];
    templatesForDay(dayIdx).forEach(function (t) {
      t.exercises.slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (ex) {
        out.push({ exercise: ex, template: t });
      });
    });
    return out;
  }

  // ============================================================
  // PROGRESSION / PRESCRIPTION — a simplified version of gym.html's own
  // "last logged set + rep-range threshold -> hold/add-weight/deload"
  // engine (see that file's own established precedent), stored as one
  // flat map keyed by exerciseId rather than per-session history.
  // ============================================================
  function getProgressionMap() { return storeGet(KEYS.progression) || {}; }
  function getProgression(exerciseId) { return getProgressionMap()[exerciseId] || null; }
  function updateProgression(exerciseId, patch) {
    const map = getProgressionMap();
    map[exerciseId] = Object.assign({}, map[exerciseId], patch, { updatedAt: Date.now() });
    storeSet(KEYS.progression, map);
    return map[exerciseId];
  }
  function suggestedWeight(exercise) {
    const prog = getProgression(exercise.id);
    if (!prog || typeof prog.lastWeight !== 'number') return exercise.targetWeight || 0;
    const step = exercise.targetWeight > 0 ? Math.max(1, Math.round(exercise.targetWeight * 0.05)) : 2.5;
    if (typeof prog.lastAvgReps === 'number') {
      if (prog.lastAvgReps >= exercise.repMax) return prog.lastWeight + step;
      if (prog.lastAvgReps < exercise.repMin) return Math.max(0, prog.lastWeight - step);
    }
    return prog.lastWeight;
  }

  function logSet(date, entry) {
    const rec = getDayRecord(date);
    const logEntry = {
      id: uid('log'),
      exerciseId: entry.exerciseId,
      templateId: entry.templateId,
      weight: typeof entry.weight === 'number' ? entry.weight : 0,
      reps: typeof entry.reps === 'number' ? entry.reps : 0,
      loggedAt: Date.now()
    };
    const next = saveDayRecord(date, { logs: rec.logs.concat([logEntry]) });
    updateProgression(entry.exerciseId, { lastWeight: logEntry.weight, lastReps: logEntry.reps });
    return next;
  }
  function toggleExerciseDone(date, exerciseId) {
    const rec = getDayRecord(date);
    const next = Object.assign({}, rec.exerciseDone);
    next[exerciseId] = !next[exerciseId];
    return saveDayRecord(date, { exerciseDone: next });
  }

  // ============================================================
  // PRE-WORKOUT COACHING — locally computed, template-based explanation
  // text, not a live LLM call (this app has no active AI key anywhere,
  // per CLAUDE.md §1/§2 — same honest "AUTO-SUMMARY, not AI-GENERATED"
  // convention mainpillar.html's own brief fallback already established).
  // ============================================================
  function coachingForDay(dayIdx) {
    const rows = exercisesForDay(dayIdx);
    if (!rows.length) return null;
    let totalSets = 0, totalEstVolume = 0;
    const perExercise = rows.map(function (row) {
      const ex = row.exercise;
      const weight = suggestedWeight(ex);
      const prog = getProgression(ex.id);
      totalSets += ex.sets;
      totalEstVolume += ex.sets * ((ex.repMin + ex.repMax) / 2) * weight;
      let why = ex.notes ? ex.notes : 'Selected for ' + row.template.name + ' — builds toward this template\'s overall goal through progressive overload.';
      let weightWhy;
      if (!prog || typeof prog.lastWeight !== 'number') {
        weightWhy = weight > 0
          ? 'No logged history yet — starting at the target weight of ' + weight + '.'
          : 'No logged history yet and no target weight set — start conservative and log your first set to establish a baseline.';
      } else if (prog.lastAvgReps >= ex.repMax) {
        weightWhy = 'Last session you hit the top of your rep range (' + prog.lastAvgReps + ' reps at ' + prog.lastWeight + ') — bumping up to ' + weight + '.';
      } else if (prog.lastAvgReps < ex.repMin) {
        weightWhy = 'Last session came in under range (' + prog.lastAvgReps + ' reps at ' + prog.lastWeight + ') — holding or backing off to ' + weight + '.';
      } else {
        weightWhy = 'Last session was right in range (' + prog.lastAvgReps + ' reps at ' + prog.lastWeight + ') — holding at ' + weight + ' for another session.';
      }
      return { exercise: ex, template: row.template, why: why, weightWhy: weightWhy, suggestedWeight: weight };
    });
    const templateNames = rows.reduce(function (acc, r) { if (acc.indexOf(r.template.name) === -1) acc.push(r.template.name); return acc; }, []);
    const strategy = 'Today: ' + templateNames.join(' + ') + ' — ' + rows.length + ' exercise' + (rows.length === 1 ? '' : 's') +
      ', ' + totalSets + ' total sets, roughly ' + Math.round(totalEstVolume).toLocaleString() + ' lb of estimated volume. ' +
      'Pace it so the last set of the last exercise still has something left — that\'s what makes tomorrow\'s numbers trustworthy.';
    return { perExercise: perExercise, strategy: strategy };
  }

  // ============================================================
  // POST-WORKOUT REVIEW — compliance / fatigue / volume, computed from
  // the day's real logged sets against what was prescribed, then folded
  // forward into the progression map so it actually shapes next time
  // (not just a one-off report).
  // ============================================================
  function markWorkoutComplete(date, dayIdx) {
    const rec = getDayRecord(date);
    const rows = exercisesForDay(dayIdx);
    let prescribedSets = 0, loggedSets = rec.logs.length, repCompletionSum = 0, repCompletionN = 0, volume = 0;
    rows.forEach(function (row) {
      const ex = row.exercise;
      prescribedSets += ex.sets;
      const exLogs = rec.logs.filter(function (l) { return l.exerciseId === ex.id; });
      if (exLogs.length) {
        const avgReps = exLogs.reduce(function (s, l) { return s + l.reps; }, 0) / exLogs.length;
        const targetMid = (ex.repMin + ex.repMax) / 2;
        repCompletionN++; repCompletionSum += Math.min(1.3, avgReps / (targetMid || 1));
        updateProgression(ex.id, { lastAvgReps: Math.round(avgReps * 10) / 10 });
      }
      exLogs.forEach(function (l) { volume += l.weight * l.reps; });
    });
    const compliancePct = prescribedSets ? Math.round(Math.min(1, loggedSets / prescribedSets) * 100) : 0;
    const avgRepCompletionPct = repCompletionN ? Math.round((repCompletionSum / repCompletionN) * 100) : null;
    let fatigueNote;
    if (avgRepCompletionPct === null) fatigueNote = 'No sets logged — nothing to gauge fatigue from.';
    else if (avgRepCompletionPct >= 105) fatigueNote = 'Reps ran ahead of target across the board — fresh, or the weight was light. Consider adding weight next time.';
    else if (avgRepCompletionPct >= 85) fatigueNote = 'Reps landed close to target — normal training fatigue, on track.';
    else fatigueNote = 'Reps came in under target — real fatigue showed up. Consider an easier session or a deload before the next one.';
    const review = {
      compliancePct: compliancePct,
      avgRepCompletionPct: avgRepCompletionPct,
      volume: Math.round(volume),
      loggedSets: loggedSets,
      prescribedSets: prescribedSets,
      fatigueNote: fatigueNote,
      generatedAt: Date.now()
    };
    return saveDayRecord(date, { complete: true, completedAt: Date.now(), review: review });
  }

  function computeDayStats(date) {
    const rec = getDayRecord(date);
    if (!rec.logs.length) return null;
    const timestamps = rec.logs.map(function (l) { return l.loggedAt; });
    const durationMin = Math.max(1, Math.round((Math.max.apply(null, timestamps) - Math.min.apply(null, timestamps)) / 60000));
    const volume = rec.logs.reduce(function (s, l) { return s + l.weight * l.reps; }, 0);
    let whoop = null;
    try { whoop = storeGet('mainpillar:whoop:' + date); } catch (e) {}
    return {
      date: date, durationMin: durationMin, volume: Math.round(volume), setCount: rec.logs.length,
      complete: rec.complete, review: rec.review,
      recovery: whoop && typeof whoop.recovery === 'number' ? whoop.recovery : null,
      strain: whoop && typeof whoop.strain === 'number' ? whoop.strain : null,
      hrv: whoop && typeof whoop.hrv === 'number' ? whoop.hrv : null
    };
  }
  function loggedDates() {
    // Scans localStorage for fitness:day:* keys — this app's own
    // established "read raw localStorage keys directly" convention
    // (index.html's former Connected Apps tiles, tasks-data.js's import).
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('fitness:day:') === 0) out.push(k.slice('fitness:day:'.length));
      }
    } catch (e) {}
    return out.sort().reverse();
  }

  // ============================================================
  // SEED
  // ============================================================
  function seedDefaultData() {
    Equipment.replaceAll([]);
    Templates.replaceAll([]);
    const barbell = Equipment.add({ name: 'Barbell', type: 'Barbell', weights: [45, 65, 95, 135, 185], order: 0 });
    const dbs = Equipment.add({ name: 'Adjustable Dumbbells', type: 'Dumbbell', weights: [10, 20, 30, 40, 50], order: 1 });
    Equipment.add({ name: 'Cable Machine', type: 'Cable', weights: [10, 20, 30, 40, 50, 60], order: 2 });

    Templates.add({
      name: 'Push Day', gymType: 'Home Gym', color: 'gold', scheduledDays: [1, 4], order: 0,
      exercises: [
        exerciseModel({ name: 'Barbell Bench Press', sets: 4, repMin: 6, repMax: 10, restSec: 120, notes: 'Primary horizontal push — do this first while fresh.', equipmentId: barbell.id, targetWeight: 135, order: 0 }),
        exerciseModel({ name: 'Overhead Press', sets: 3, repMin: 8, repMax: 12, restSec: 90, notes: 'Shoulder press, standing.', equipmentId: barbell.id, targetWeight: 65, order: 1 }),
        exerciseModel({ name: 'Dumbbell Lateral Raise', sets: 3, repMin: 12, repMax: 15, restSec: 60, notes: 'Finisher for the delts.', equipmentId: dbs.id, targetWeight: 15, order: 2 })
      ]
    });
    Templates.add({
      name: 'Pull Day', gymType: 'Home Gym', color: 'info', scheduledDays: [2, 5], order: 1,
      exercises: [
        exerciseModel({ name: 'Deadlift', sets: 3, repMin: 5, repMax: 8, restSec: 150, notes: 'Primary hinge — heaviest lift of the week.', equipmentId: barbell.id, targetWeight: 185, order: 0 }),
        exerciseModel({ name: 'Cable Row', sets: 3, repMin: 10, repMax: 12, restSec: 90, equipmentId: null, targetWeight: 40, order: 1 })
      ]
    });
    Templates.add({
      name: 'Legs Day', gymType: 'Home Gym', color: 'good', scheduledDays: [3, 6], order: 2,
      exercises: [
        exerciseModel({ name: 'Back Squat', sets: 4, repMin: 6, repMax: 10, restSec: 150, notes: 'Primary squat pattern.', equipmentId: barbell.id, targetWeight: 135, order: 0 }),
        exerciseModel({ name: 'Dumbbell Lunge', sets: 3, repMin: 10, repMax: 12, restSec: 75, equipmentId: dbs.id, targetWeight: 25, order: 1 })
      ]
    });
    storeSet(KEYS.seeded, true);
  }
  function isEmpty() { return Templates.list().length === 0 && Equipment.list().length === 0; }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (!isEmpty()) { storeSet(KEYS.seeded, true); return; }
    seedDefaultData();
  }
  // seedIfEmpty() is deliberately NOT called automatically — same
  // empty-storage seed-race reasoning as every other page in this app
  // (dreamboard.html/business.html/aitech.html/system.html, etc.):
  // seeding synchronously before initCloudSync()'s cloud pull has a real
  // chance to land could push a freshly-seeded "default" set to Supabase
  // and clobber another device's real data. The caller runs it only from
  // a deferred, cloud-pull-aware fallback.

  global.FitnessData = {
    KEYS: KEYS, dayKey: dayKey,
    WEEKDAY_LABELS: WEEKDAY_LABELS, TEMPLATE_COLORS: TEMPLATE_COLORS, EQUIPMENT_TYPES: EQUIPMENT_TYPES,
    uid: uid, todayISO: todayISO, weekdayIndex: weekdayIndex, dateForWeekday: dateForWeekday,
    Templates: Templates, Equipment: Equipment,
    nextOrder: nextOrder, moveInCollection: moveInCollection,
    moveExercise: moveExercise, addExerciseToTemplate: addExerciseToTemplate,
    updateExerciseInTemplate: updateExerciseInTemplate, removeExerciseFromTemplate: removeExerciseFromTemplate,
    findExercise: findExercise, deleteEquipment: deleteEquipment,
    templatesSorted: templatesSorted, equipmentSorted: equipmentSorted,
    templatesForDay: templatesForDay, exercisesForDay: exercisesForDay,
    getDayRecord: getDayRecord, saveDayRecord: saveDayRecord,
    getProgression: getProgression, updateProgression: updateProgression, suggestedWeight: suggestedWeight,
    logSet: logSet, toggleExerciseDone: toggleExerciseDone,
    coachingForDay: coachingForDay, markWorkoutComplete: markWorkoutComplete,
    computeDayStats: computeDayStats, loggedDates: loggedDates,
    isEmpty: isEmpty, seedDefaultData: seedDefaultData, seedIfEmpty: seedIfEmpty
  };
})(window);
