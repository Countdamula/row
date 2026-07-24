// home-data.js
//
// Shared data foundation for home.html ("Home"). Same conventions as
// aitech-data.js/business-data.js/dreamboard-data.js (see CLAUDE.md §4):
// plain localStorage, JSON-serialized, one key per collection, no
// server/DB. All keys live under a `home:` prefix so home.html's
// initCloudSync({ syncedPrefixes: ['home:'] }) call covers every
// collection with no per-key list.
//
// home.html combines four *existing* pages (Dream Board / Tasks & Notes /
// AI & Tech / Self-Care) by embedding them unmodified in same-origin
// iframes — this file has nothing to do with that (their own -data.js
// files and Supabase rows are completely untouched). This file only backs
// the two genuinely new sections built natively into home.html:
//
//   - Weekly Schedule — a small database of recurring tasks, each with a
//     Mon–Sun checkbox row (reset automatically at the start of a new
//     week), a per-task progress bar, notes, and a day-of-week filter.
//   - Subconscious Reprogramming — a daily ritual checklist (resets each
//     day), an Affirmations gallery with a practice-streak counter, and a
//     freeform "Notes & Scripts" list (visualization/mantra scripts,
//     generated on demand — same pattern as business.html's Platform
//     Detail sections).

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same honest-save-signal pattern as aitech-data.js's
  // storeSet(): a failed localStorage write (e.g. quota exceeded) used to
  // vanish silently; this dispatches a 'home:save' event either way.
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      try { window.dispatchEvent(new CustomEvent('home:save', { detail: { key: key, ok: true } })); } catch (e2) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('home:save', { detail: { key: key, ok: false, error: e } })); } catch (e2) {}
    }
  }

  const KEYS = {
    scheduleTasks: 'home:scheduleTasks',
    affirmations: 'home:affirmations',
    reprogramSections: 'home:reprogramSections',
    ritualItems: 'home:ritualItems',
    ritualDate: 'home:ritualDate',
    heroTitle: 'home:heroTitle',
    heroSubtext: 'home:heroSubtext',
    heroPhoto: 'home:heroPhoto',
    seeded: 'home:seeded'
  };
  // `home:active_tab` (from this page's first build, when it was a
  // 6-panel tab-switcher) is now orphaned — Home was rebuilt into one
  // continuous scrollable page in the same feature's next pass, the same
  // same-session-supersession precedent as e.g. gym.html's Timer
  // modal→panel conversion, so the mechanism it backed no longer exists.
  // Left alone on any device that already wrote it, same treatment as
  // every other orphaned key elsewhere in this app.

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // IMAGE COMPRESSION / URL VALIDATION — same canvas-downscale recipe and
  // http(s)-only URL guard as every other page in this app (see
  // aitech-data.js's identical copy).
  // ============================================================
  function compressImageDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1100;
    quality = quality == null ? 0.8 : quality;
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
          else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL('image/jpeg', quality)); } catch (e) { resolve(dataUrl); }
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }
  function isValidMediaUrl(value) {
    if (!value) return false;
    try {
      const u = new URL(String(value));
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) { return false; }
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayISO() { return isoDate(new Date()); }
  function addDaysISO(iso, delta) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    return isoDate(d);
  }
  // Monday of the week containing `d` (or today), Mon-first per this app's
  // established weekday-order convention (gym.html's WEEKDAY_ORDER etc.).
  function mondayISO(d) {
    d = d || new Date();
    const dow = d.getDay(); // 0=Sun..6=Sat
    const diff = (dow === 0 ? -6 : 1 - dow);
    return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff));
  }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as
  // aitech-data.js/business-data.js/household-data.js.
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

  function nextOrder(list) {
    return list.length ? Math.max.apply(null, list.map(function (x) { return x.order; })) + 1 : 0;
  }
  // Swap-adjacent-order-values reorder — this app's standard convention
  // for up/down-arrow reorderable lists (Life Areas, Workflow weeks/days,
  // etc. — see CLAUDE.md §1/Writing Dashboard section).
  function moveItem(collection, id, dir) {
    const all = collection.list().slice().sort(function (a, b) { return a.order - b.order; });
    const idx = all.findIndex(function (x) { return x.id === id; });
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= all.length) return;
    const a = all[idx], b = all[swapIdx];
    const orderA = a.order, orderB = b.order;
    collection.update(a.id, { order: orderB });
    collection.update(b.id, { order: orderA });
  }

  // ============================================================
  // WEEKLY SCHEDULE
  // ============================================================
  const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const WEEKDAY_LABELS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const WEEKDAY_LETTERS = { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' };

  function normalizeChecks(c) {
    const out = {};
    WEEKDAY_KEYS.forEach(function (k) { out[k] = !!(c && c[k]); });
    return out;
  }

  /** @typedef {{id:string, title:string, notes:string, scheduledDays:string[], checks:Object, checksWeekStart:string, order:number, createdAt:number}} ScheduleTask */
  function scheduleTaskModel(data) {
    data = data || {};
    const days = Array.isArray(data.scheduledDays) ? data.scheduledDays.filter(function (d) { return WEEKDAY_KEYS.indexOf(d) !== -1; }) : [];
    return {
      id: data.id || uid('sch'),
      title: typeof data.title === 'string' ? data.title : '',
      notes: typeof data.notes === 'string' ? data.notes : '',
      scheduledDays: days.length ? days : WEEKDAY_KEYS.slice(),
      checks: normalizeChecks(data.checks),
      checksWeekStart: typeof data.checksWeekStart === 'string' ? data.checksWeekStart : mondayISO(),
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const ScheduleTasks = makeCollection(KEYS.scheduleTasks, scheduleTaskModel);

  function scheduleTasksSorted() { return ScheduleTasks.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function tasksForDay(day) {
    return scheduleTasksSorted().filter(function (t) { return t.scheduledDays.indexOf(day) !== -1; });
  }
  function scheduleTaskProgress(t) {
    const days = (t.scheduledDays && t.scheduledDays.length) ? t.scheduledDays : WEEKDAY_KEYS;
    const checks = normalizeChecks(t.checks);
    const done = days.filter(function (d) { return checks[d]; }).length;
    return { done: done, total: days.length };
  }
  /** A task's checkbox row is scoped to "this week" — once the real
   * calendar week rolls over, its checks reset to unchecked (title/notes/
   * scheduledDays are untouched). Run this before rendering the Weekly
   * Schedule so it's always comparing against the true current week. */
  function resetStaleWeeks() {
    const currentMonday = mondayISO();
    const all = ScheduleTasks.list();
    let changed = false;
    const next = all.map(function (t) {
      if (t.checksWeekStart !== currentMonday) {
        changed = true;
        return Object.assign({}, t, { checksWeekStart: currentMonday, checks: normalizeChecks(null) });
      }
      return t;
    });
    if (changed) ScheduleTasks.replaceAll(next);
    return changed;
  }
  function toggleScheduleCheck(id, day) {
    const t = ScheduleTasks.get(id);
    if (!t) return null;
    const checks = normalizeChecks(t.checks);
    checks[day] = !checks[day];
    return ScheduleTasks.update(id, { checks: checks, checksWeekStart: mondayISO() });
  }
  function moveScheduleTask(id, dir) { moveItem(ScheduleTasks, id, dir); }

  // ============================================================
  // SUBCONSCIOUS REPROGRAMMING — Affirmations
  // ============================================================
  const AFFIRMATION_CATEGORIES = ['Money', 'Health', 'Relationships', 'Confidence', 'Purpose', 'Mindset', 'Other'];

  /** @typedef {{id:string, text:string, category:string, favorite:boolean, order:number, createdAt:number, lastPracticedDate:?string, currentStreak:number, bestStreak:number, practiceDate:?string, practiceCountToday:number}} Affirmation */
  function affirmationModel(data) {
    data = data || {};
    return {
      id: data.id || uid('aff'),
      text: typeof data.text === 'string' ? data.text : '',
      category: AFFIRMATION_CATEGORIES.indexOf(data.category) !== -1 ? data.category : 'Other',
      favorite: !!data.favorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      lastPracticedDate: typeof data.lastPracticedDate === 'string' ? data.lastPracticedDate : null,
      currentStreak: typeof data.currentStreak === 'number' ? data.currentStreak : 0,
      bestStreak: typeof data.bestStreak === 'number' ? data.bestStreak : 0,
      practiceDate: typeof data.practiceDate === 'string' ? data.practiceDate : null,
      practiceCountToday: typeof data.practiceCountToday === 'number' ? data.practiceCountToday : 0
    };
  }
  const Affirmations = makeCollection(KEYS.affirmations, affirmationModel);
  function affirmationsSorted() { return Affirmations.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function moveAffirmation(id, dir) { moveItem(Affirmations, id, dir); }

  /** Logs one practice rep for today. First rep of a new day advances the
   * streak (continues it if the last practice was yesterday, else resets
   * to 1) and bumps the best-streak high-water mark; every rep the same
   * day just increments today's count. */
  function markAffirmationPracticed(id) {
    const a = Affirmations.get(id);
    if (!a) return null;
    const today = todayISO();
    const yesterday = addDaysISO(today, -1);
    let currentStreak = a.currentStreak;
    let bestStreak = a.bestStreak;
    let lastPracticedDate = a.lastPracticedDate;
    let practiceCountToday = (a.practiceDate === today) ? a.practiceCountToday : 0;
    practiceCountToday += 1;
    if (a.lastPracticedDate !== today) {
      currentStreak = (a.lastPracticedDate === yesterday) ? currentStreak + 1 : 1;
      bestStreak = Math.max(bestStreak, currentStreak);
      lastPracticedDate = today;
    }
    return Affirmations.update(id, {
      lastPracticedDate: lastPracticedDate,
      currentStreak: currentStreak,
      bestStreak: bestStreak,
      practiceDate: today,
      practiceCountToday: practiceCountToday
    });
  }

  // ============================================================
  // SUBCONSCIOUS REPROGRAMMING — Notes & Scripts (generated sections,
  // same "+ Generate Section" pattern as business.html's Platform Detail
  // page — a flat, freeform list of title+body blocks).
  // ============================================================
  /** @typedef {{id:string, title:string, body:string, order:number, createdAt:number}} ReprogramSection */
  function reprogramSectionModel(data) {
    data = data || {};
    return {
      id: data.id || uid('rps'),
      title: typeof data.title === 'string' ? data.title : 'New Section',
      body: typeof data.body === 'string' ? data.body : '',
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const ReprogramSections = makeCollection(KEYS.reprogramSections, reprogramSectionModel);
  function reprogramSectionsSorted() { return ReprogramSections.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function moveReprogramSection(id, dir) { moveItem(ReprogramSections, id, dir); }

  // ============================================================
  // SUBCONSCIOUS REPROGRAMMING — Today's Ritual (a small daily checklist
  // that resets every day, same "reset via a date stamp" precedent as
  // this file's own weekly-schedule reset above, just on a daily cadence).
  // ============================================================
  /** @typedef {{id:string, text:string, checked:boolean, order:number, createdAt:number}} RitualItem */
  function ritualItemModel(data) {
    data = data || {};
    return {
      id: data.id || uid('rit'),
      text: typeof data.text === 'string' ? data.text : '',
      checked: !!data.checked,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
    };
  }
  const RitualItems = makeCollection(KEYS.ritualItems, ritualItemModel);
  function ritualItemsSorted() { return RitualItems.list().slice().sort(function (a, b) { return a.order - b.order; }); }
  function moveRitualItem(id, dir) { moveItem(RitualItems, id, dir); }
  function resetRitualIfNewDay() {
    const today = todayISO();
    if (storeGet(KEYS.ritualDate) === today) return false;
    const all = RitualItems.list();
    if (all.length) RitualItems.replaceAll(all.map(function (i) { return Object.assign({}, i, { checked: false }); }));
    storeSet(KEYS.ritualDate, today);
    return true;
  }

  // ============================================================
  // SEED — guarded, deferred to a fallback after the cloud pull has had a
  // real chance to answer (same empty-storage seed-race-safety contract
  // as every other board/gallery page in this app — see CLAUDE.md's
  // Writing Dashboard/Dream Board/Business Hub/AI & Tech entries).
  // seedIfEmpty() is deliberately NOT called automatically here.
  // ============================================================
  function seedDefaultData() {
    ScheduleTasks.replaceAll([]);
    Affirmations.replaceAll([]);
    ReprogramSections.replaceAll([]);
    RitualItems.replaceAll([]);

    const monday = mondayISO();
    const scheduleDefs = [
      { title: 'Morning Workout', scheduledDays: ['mon', 'wed', 'fri'], notes: '45 min strength training — see the routine in Fitness Studio.' },
      { title: 'Deep Work Block', scheduledDays: ['mon', 'tue', 'wed', 'thu', 'fri'], notes: '9–11am, phone in another room, one task only.' },
      { title: 'Meal Prep', scheduledDays: ['sun'], notes: 'Prep lunches for the week ahead.' },
      { title: 'Weekly Review', scheduledDays: ['sun'], notes: 'Review goals, clear the inbox, plan next week.' },
      { title: 'Call Family', scheduledDays: ['sat'], notes: '' }
    ];
    scheduleDefs.forEach(function (d, i) {
      ScheduleTasks.add(Object.assign({}, d, { order: i, checksWeekStart: monday }));
    });

    const affirmationDefs = [
      { text: 'I am worthy of the success I am building.', category: 'Confidence' },
      { text: 'Money flows to me easily and consistently.', category: 'Money' },
      { text: 'My body is strong, healthy, and capable.', category: 'Health' },
      { text: 'I attract relationships built on trust and respect.', category: 'Relationships' },
      { text: 'I know exactly what I am here to do.', category: 'Purpose' },
      { text: 'My mind is calm, focused, and fully in my control.', category: 'Mindset' }
    ];
    affirmationDefs.forEach(function (d, i) { Affirmations.add(Object.assign({}, d, { order: i })); });

    [
      'Recite my affirmations out loud, 3x',
      '5-minute visualization of today going perfectly',
      'Write down 3 things I am grateful for'
    ].forEach(function (text, i) { RitualItems.add({ text: text, order: i }); });

    ReprogramSections.add({
      order: 0, title: 'Visualization Script',
      body: 'Close your eyes. Picture the moment you achieve the goal — where you are, what you see, what you hear, how it feels in your body. Hold that feeling for 60 seconds before opening your eyes.'
    });
    ReprogramSections.add({
      order: 1, title: 'Nightly Mantra (Sleep Programming)',
      body: 'Repeat silently as you fall asleep: "Every night I rest, my mind rewires itself toward the person I am becoming."'
    });

    storeSet(KEYS.seeded, true);
  }
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (ScheduleTasks.list().length || Affirmations.list().length || ReprogramSections.list().length || RitualItems.list().length) {
      storeSet(KEYS.seeded, true);
      return;
    }
    seedDefaultData();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.HomeData = {
    KEYS: KEYS,
    WEEKDAY_KEYS: WEEKDAY_KEYS,
    WEEKDAY_LABELS: WEEKDAY_LABELS,
    WEEKDAY_LETTERS: WEEKDAY_LETTERS,
    AFFIRMATION_CATEGORIES: AFFIRMATION_CATEGORIES,
    uid: uid,
    compressImageDataUrl: compressImageDataUrl,
    isValidMediaUrl: isValidMediaUrl,
    todayISO: todayISO,
    mondayISO: mondayISO,
    ScheduleTasks: ScheduleTasks,
    scheduleTasksSorted: scheduleTasksSorted,
    tasksForDay: tasksForDay,
    scheduleTaskProgress: scheduleTaskProgress,
    resetStaleWeeks: resetStaleWeeks,
    toggleScheduleCheck: toggleScheduleCheck,
    moveScheduleTask: moveScheduleTask,
    Affirmations: Affirmations,
    affirmationsSorted: affirmationsSorted,
    moveAffirmation: moveAffirmation,
    markAffirmationPracticed: markAffirmationPracticed,
    ReprogramSections: ReprogramSections,
    reprogramSectionsSorted: reprogramSectionsSorted,
    moveReprogramSection: moveReprogramSection,
    RitualItems: RitualItems,
    ritualItemsSorted: ritualItemsSorted,
    moveRitualItem: moveRitualItem,
    resetRitualIfNewDay: resetRitualIfNewDay,
    nextOrder: nextOrder,
    seedDefaultData: seedDefaultData,
    seedIfEmpty: seedIfEmpty
  };
})(window);
