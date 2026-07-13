// selfcare-data.js
//
// Shared data foundation for an in-progress Self-Care tab: typed-by-JSDoc
// models, a localStorage-backed data-access layer, and pure derived
// selectors — same shape/conventions as household-data.js/finance-data.js
// (see CLAUDE.md §4): plain localStorage, JSON-serialized, one key per
// collection, no server/DB. All keys live under a `selfcare:` prefix so a
// future selfcare.html's `initCloudSync({ syncedPrefixes: ['selfcare:'] })`
// call (not wired up yet — no page exists yet) will cover every collection
// here with no per-key list, same as household.html's call does today.
//
// This step is data-layer only — no UI reads this yet, and nothing else in
// the app references `selfcare:`-prefixed keys or window.SelfCareData, so
// this file cannot break any existing page.

(function (global) {
  'use strict';

  // ============================================================
  // STORAGE — same storeGet/storeSet shim used by every other page
  // in this app (finance.html, index.html, household-data.js, etc.).
  // ============================================================
  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  const KEYS = {
    journalEntries: 'selfcare:journalEntries',
    meditations: 'selfcare:meditations',
    hydrationProfile: 'selfcare:hydrationProfile',
    waterLog: 'selfcare:waterLog',
    bucketList: 'selfcare:bucketList',
    seeded: 'selfcare:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ============================================================
  // DATE HELPERS — local-date-safe "YYYY-MM-DD" strings, same
  // precedent as household-data.js/finance-data.js: never round-trip a
  // bare date through `new Date(isoString)`, which parses as UTC
  // midnight and can land on the wrong day depending on the browser's
  // timezone.
  // ============================================================
  function pad2(n) { return String(n).padStart(2, '0'); }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function localDateFromISO(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function addDaysISO(iso, days) {
    const d = localDateFromISO(iso) || new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  /** Whole days from today to iso; negative = in the past. Null if iso is unparseable. */
  function daysUntil(iso) {
    const d = localDateFromISO(iso);
    if (!d) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((d.getTime() - today.getTime()) / 86400000);
  }

  // ============================================================
  // UNITS — the one shared helper for converting/formatting volume
  // (ml|oz) and weight (kg|lb), mirroring FinanceCurrency/
  // HouseholdCurrency's "config-free pure convert + format" shape.
  // Storage is always in the metric base unit (ml for volume, kg for
  // weight where relevant) — display unit is a per-record/profile
  // preference, converted only at render time. There's no reusable
  // cross-file unit helper to import (no build step / no shared JS
  // modules in this app — gym.html's `unit()` is the closest existing
  // precedent, but it's a page-scoped kg/lb label getter, not a
  // conversion helper), so this is a small new one in the same spirit.
  // ============================================================
  const ML_PER_OZ = 29.5735;
  const KG_PER_LB = 0.45359237;

  const SelfCareUnits = {
    Volume: {
      mlToOz(ml) { return (Number(ml) || 0) / ML_PER_OZ; },
      ozToMl(oz) { return (Number(oz) || 0) * ML_PER_OZ; },
      /** Stored ml -> a whole-number amount in the given display unit ('ml'|'oz'). */
      toDisplay(ml, unit) {
        return unit === 'oz' ? Math.round(this.mlToOz(ml)) : Math.round(Number(ml) || 0);
      },
      /** A user-entered amount in the given display unit -> whole-number ml (the storage unit). */
      fromDisplay(amount, unit) {
        return unit === 'oz' ? Math.round(this.ozToMl(amount)) : Math.round(Number(amount) || 0);
      },
      /** "500 ml" / "17 oz" */
      format(ml, unit) {
        return this.toDisplay(ml, unit) + ' ' + (unit === 'oz' ? 'oz' : 'ml');
      }
    },
    Weight: {
      kgToLb(kg) { return (Number(kg) || 0) / KG_PER_LB; },
      lbToKg(lb) { return (Number(lb) || 0) * KG_PER_LB; },
      /** A weight entered in either unit -> kg (used internally by the water-goal formula). */
      toKg(weight, unit) {
        return unit === 'lb' ? this.lbToKg(weight) : (Number(weight) || 0);
      },
      /** "70 kg" / "154.3 lb" */
      format(weight, unit) {
        const rounded = Math.round((Number(weight) || 0) * 10) / 10;
        return rounded + ' ' + (unit === 'lb' ? 'lb' : 'kg');
      }
    }
  };

  // ============================================================
  // MODELS — no build step / no TypeScript in this repo, so "typed"
  // means a JSDoc @typedef (for editor hints) plus a factory that
  // fills every field with a sane default and coerces enums/numbers,
  // matching household-data.js/finance-data.js's convention.
  // ============================================================

  const JOURNAL_TOPICS = ['daily_reflection', 'self_discovery', 'emotional_processing', 'gratitude'];

  /**
   * @typedef {Object} JournalEntry
   * @property {string} id
   * @property {'daily_reflection'|'self_discovery'|'emotional_processing'|'gratitude'} topic
   * @property {string} title
   * @property {string} body - markdown text
   * @property {?string} mood - freeform, nullable
   * @property {string} date - ISO date (YYYY-MM-DD)
   * @property {string[]} tags
   * @property {string} createdAt - ISO date
   */
  function journalEntryModel(data) {
    data = data || {};
    return {
      id: data.id || uid('journal'),
      topic: JOURNAL_TOPICS.indexOf(data.topic) !== -1 ? data.topic : JOURNAL_TOPICS[0],
      title: data.title || '',
      body: data.body || '',
      mood: data.mood == null || data.mood === '' ? null : data.mood,
      date: data.date || todayISO(),
      tags: Array.isArray(data.tags) ? data.tags.filter(function (t) { return typeof t === 'string' && t; }) : [],
      createdAt: data.createdAt || todayISO()
    };
  }

  const MEDITATION_TYPES = ['breathing', 'sleep', 'anxiety', 'focus', 'body_scan', 'other'];

  /**
   * @typedef {Object} Meditation
   * @property {string} id
   * @property {string} title
   * @property {string} description
   * @property {string} url - web link
   * @property {'breathing'|'sleep'|'anxiety'|'focus'|'body_scan'|'other'} type
   * @property {?number} durationMin - nullable
   * @property {string[]} tags
   * @property {boolean} isFavorite
   * @property {string} notes
   */
  function meditationModel(data) {
    data = data || {};
    return {
      id: data.id || uid('med'),
      title: data.title || '',
      description: data.description || '',
      url: data.url || '',
      type: MEDITATION_TYPES.indexOf(data.type) !== -1 ? data.type : 'other',
      durationMin: data.durationMin == null || data.durationMin === '' ? null : Math.max(0, Math.round(Number(data.durationMin)) || 0),
      tags: Array.isArray(data.tags) ? data.tags.filter(function (t) { return typeof t === 'string' && t; }) : [],
      isFavorite: !!data.isFavorite,
      notes: data.notes || ''
    };
  }

  const ACTIVITY_LEVELS = ['none', 'light', 'moderate', 'heavy'];
  const CLIMATES = ['normal', 'hot'];
  const HYDRATION_PROFILE_ID = 'hydration_profile';

  /**
   * @typedef {Object} HydrationProfile
   * @property {string} id - fixed single-record id, always HYDRATION_PROFILE_ID
   * @property {number} weight
   * @property {'kg'|'lb'} weightUnit
   * @property {?number} heightCm - nullable
   * @property {number} age
   * @property {?string} sex - nullable, freeform
   * @property {'none'|'light'|'moderate'|'heavy'} activityLevel
   * @property {'normal'|'hot'} climate
   * @property {'ml'|'oz'} volumeUnit
   * @property {?number} customGoalOverride - ml, nullable; wins over the computed formula when set
   */
  function hydrationProfileModel(data) {
    data = data || {};
    return {
      id: HYDRATION_PROFILE_ID,
      weight: Math.max(0, Number(data.weight) || 0),
      weightUnit: data.weightUnit === 'lb' ? 'lb' : 'kg',
      heightCm: data.heightCm == null || data.heightCm === '' ? null : Math.max(0, Number(data.heightCm) || 0),
      age: Math.max(0, Math.round(Number(data.age)) || 0),
      sex: data.sex || null,
      activityLevel: ACTIVITY_LEVELS.indexOf(data.activityLevel) !== -1 ? data.activityLevel : 'none',
      climate: CLIMATES.indexOf(data.climate) !== -1 ? data.climate : 'normal',
      volumeUnit: data.volumeUnit === 'oz' ? 'oz' : 'ml',
      customGoalOverride: data.customGoalOverride == null || data.customGoalOverride === '' ? null : Math.max(0, Math.round(Number(data.customGoalOverride)) || 0)
    };
  }

  const WATER_SOURCES = ['cup', 'bottle', 'custom'];

  /**
   * @typedef {Object} WaterLog
   * @property {string} id
   * @property {string} date - ISO date (YYYY-MM-DD)
   * @property {number} amountMl - stored internally in ml regardless of the profile's display unit
   * @property {'cup'|'bottle'|'custom'} source
   */
  function waterLogModel(data) {
    data = data || {};
    return {
      id: data.id || uid('water'),
      date: data.date || todayISO(),
      amountMl: Math.max(0, Math.round(Number(data.amountMl)) || 0),
      source: WATER_SOURCES.indexOf(data.source) !== -1 ? data.source : 'custom'
    };
  }

  const BUCKET_CATEGORIES = ['relax', 'adventure', 'treat', 'social', 'creative', 'nature', 'other'];
  const BUCKET_STATUSES = ['idea', 'planned', 'done'];

  /**
   * @typedef {Object} BucketItem
   * @property {string} id
   * @property {string} title
   * @property {string} description
   * @property {'relax'|'adventure'|'treat'|'social'|'creative'|'nature'|'other'} category
   * @property {'idea'|'planned'|'done'} status
   * @property {?string} targetDate - ISO date, nullable
   * @property {?number} costCents - integer minor units, nullable
   * @property {?string} url - nullable
   * @property {?string} imageUrl - nullable
   * @property {?string} completedDate - ISO date, nullable
   * @property {string} notes
   */
  function bucketItemModel(data) {
    data = data || {};
    return {
      id: data.id || uid('bucket'),
      title: data.title || '',
      description: data.description || '',
      category: BUCKET_CATEGORIES.indexOf(data.category) !== -1 ? data.category : 'other',
      status: BUCKET_STATUSES.indexOf(data.status) !== -1 ? data.status : 'idea',
      targetDate: data.targetDate || null,
      costCents: data.costCents == null || data.costCents === '' ? null : Math.max(0, Math.round(Number(data.costCents)) || 0),
      url: data.url || null,
      imageUrl: data.imageUrl || null,
      completedDate: data.completedDate || null,
      notes: data.notes || ''
    };
  }

  // ============================================================
  // DATA ACCESS — list / get / add / update / remove per collection,
  // copied verbatim from household-data.js/finance-data.js's
  // makeCollection.
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
      // Re-run through the model factory so patched fields stay coerced
      // (enums, numbers) and unknown/missing fields keep their
      // defaults — same precedent as household-data.js's makeCollection.
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
    return { list: list, get: get, add: add, update: update, remove: remove };
  }

  const JournalEntries = makeCollection(KEYS.journalEntries, journalEntryModel);
  const Meditations = makeCollection(KEYS.meditations, meditationModel);
  const WaterLog = makeCollection(KEYS.waterLog, waterLogModel);
  const BucketList = makeCollection(KEYS.bucketList, bucketItemModel);

  // HydrationProfile is a single record, not a list, so it gets a plain
  // get/save pair instead of makeCollection — "create" and "update" are
  // the same upsert operation here since there's only ever one record.
  function getHydrationProfile() {
    return storeGet(KEYS.hydrationProfile) || null;
  }
  function saveHydrationProfile(patch) {
    const current = getHydrationProfile() || {};
    const next = hydrationProfileModel(Object.assign({}, current, patch));
    storeSet(KEYS.hydrationProfile, next);
    return next;
  }

  // ============================================================
  // WATER RECOMMENDATION — a general hydration ESTIMATE, NOT medical
  // advice: a simple, editable heuristic (ml/kg scaled by age bracket,
  // plus flat activity/climate adjustments), not a clinical formula.
  // If the profile has a customGoalOverride set, that value wins
  // outright and none of the math below runs.
  // ============================================================
  const WATER_AGE_FACTOR_ML_PER_KG = [
    { maxAge: 30, factor: 40 },
    { maxAge: 55, factor: 35 },
    { maxAge: 65, factor: 30 },
    { maxAge: Infinity, factor: 25 }
  ];
  const WATER_ACTIVITY_ADJUSTMENT_ML = { none: 0, light: 250, moderate: 500, heavy: 750 };
  const WATER_CLIMATE_ADJUSTMENT_ML = { normal: 0, hot: 500 };

  /** @param {?HydrationProfile} profile @returns {number} recommended daily intake in ml */
  function recommendedDailyMl(profile) {
    if (!profile) return 0;
    if (profile.customGoalOverride != null) return profile.customGoalOverride;

    const weightKg = SelfCareUnits.Weight.toKg(profile.weight, profile.weightUnit);
    const age = Number(profile.age) || 0;
    const ageFactor = (WATER_AGE_FACTOR_ML_PER_KG.find(function (b) { return age < b.maxAge || age === b.maxAge; }) || WATER_AGE_FACTOR_ML_PER_KG[WATER_AGE_FACTOR_ML_PER_KG.length - 1]).factor;
    const base = weightKg * ageFactor;

    const activityAdj = WATER_ACTIVITY_ADJUSTMENT_ML[profile.activityLevel] || 0;
    const climateAdj = WATER_CLIMATE_ADJUSTMENT_ML[profile.climate] || 0;

    return Math.round(base + activityAdj + climateAdj);
  }

  // ============================================================
  // DERIVED SELECTORS — pure functions over the collections above,
  // re-derived on every call, not cached.
  // ============================================================

  /** Entries for one topic (or all, if topic is falsy), newest date first. */
  function entriesByTopic(topic) {
    return JournalEntries.list()
      .filter(function (e) { return !topic || e.topic === topic; })
      .sort(function (a, b) { return b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)); });
  }

  /** Sum of amountMl logged today. */
  function todayIntakeMl() {
    const today = todayISO();
    return WaterLog.list()
      .filter(function (w) { return w.date === today; })
      .reduce(function (sum, w) { return sum + w.amountMl; }, 0);
  }

  /** todayIntakeMl() / today's goal (0 if no profile/goal is set yet). */
  function todayProgress() {
    const goal = recommendedDailyMl(getHydrationProfile());
    return goal ? todayIntakeMl() / goal : 0;
  }

  /** Last `days` days (oldest first, ending today) as { date, totalMl, goalMl, progress }. */
  function intakeHistory(days) {
    const n = days == null ? 7 : days;
    const goal = recommendedDailyMl(getHydrationProfile());
    const today = todayISO();
    const totalsByDate = {};
    WaterLog.list().forEach(function (w) { totalsByDate[w.date] = (totalsByDate[w.date] || 0) + w.amountMl; });
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const date = addDaysISO(today, -i);
      const totalMl = totalsByDate[date] || 0;
      out.push({ date: date, totalMl: totalMl, goalMl: goal, progress: goal ? totalMl / goal : 0 });
    }
    return out;
  }

  /** BucketList items grouped by status — { idea: [...], planned: [...], done: [...] }. */
  function bucketItemsByStatus() {
    const groups = {};
    BUCKET_STATUSES.forEach(function (s) { groups[s] = []; });
    BucketList.list().forEach(function (item) { groups[item.status].push(item); });
    return groups;
  }

  /** BucketList items grouped by category. */
  function bucketItemsByCategory() {
    const groups = {};
    BUCKET_CATEGORIES.forEach(function (c) { groups[c] = []; });
    BucketList.list().forEach(function (item) { groups[item.category].push(item); });
    return groups;
  }

  // ============================================================
  // SEED DATA — a small, realistic starter set so a future UI has
  // something to render. Runs once, guarded by selfcare:seeded, and
  // only if every collection (and the hydration profile) is already
  // empty/unset, so it can never clobber real data added later — same
  // precedent as household-data.js/finance-data.js's seedIfEmpty().
  // Dates are computed relative to today (not hardcoded) so the water
  // history/journal selectors always have something meaningful to show
  // regardless of when this runs. WaterLog is seeded alongside the
  // profile (even though only entries/meditations/profile/bucket items
  // were asked for) since a hydration profile with no logged water
  // would leave todayProgress()/intakeHistory() with nothing to
  // demonstrate.
  // ============================================================
  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (JournalEntries.list().length || Meditations.list().length || WaterLog.list().length
      || BucketList.list().length || getHydrationProfile()) {
      storeSet(KEYS.seeded, true);
      return;
    }

    const today = todayISO();

    JournalEntries.add({ topic: 'gratitude', title: 'Small things', body: 'Grateful for a slow morning coffee and no meetings before 10am.', date: today, tags: ['morning'] });
    JournalEntries.add({ topic: 'daily_reflection', title: 'Reset day', body: 'Felt scattered most of the day — noticing I skipped lunch again.', date: addDaysISO(today, -1), tags: ['work'] });
    JournalEntries.add({ topic: 'emotional_processing', title: 'Naming it', body: 'The knot in my chest before the call was anticipatory anxiety, not dread — helped to name it.', date: addDaysISO(today, -3), mood: 'anxious', tags: [] });
    JournalEntries.add({ topic: 'self_discovery', title: 'Pattern noticed', body: 'I default to over-scheduling right after a good week, then burn out. Worth watching for.', date: addDaysISO(today, -6), tags: ['patterns'] });

    Meditations.add({ title: '10-Minute Body Scan', description: 'A gentle full-body scan for releasing tension.', url: 'https://example.com/meditations/body-scan-10', type: 'body_scan', durationMin: 10, tags: ['relaxation'], isFavorite: true, notes: '' });
    Meditations.add({ title: 'Box Breathing for Focus', description: '4-4-4-4 breathing to reset before deep work.', url: 'https://example.com/meditations/box-breathing', type: 'breathing', durationMin: 5, tags: ['work', 'quick'], isFavorite: false, notes: '' });
    Meditations.add({ title: 'Wind Down for Sleep', description: 'A slow, guided descent into sleep.', url: 'https://example.com/meditations/sleep-wind-down', type: 'sleep', durationMin: 20, tags: ['night'], isFavorite: false, notes: '' });
    Meditations.add({ title: 'Grounding for Anxiety', description: 'A 5-4-3-2-1 senses grounding exercise.', url: 'https://example.com/meditations/grounding-anxiety', type: 'anxiety', durationMin: 8, tags: [], isFavorite: false, notes: '' });

    saveHydrationProfile({ weight: 70, weightUnit: 'kg', heightCm: 175, age: 29, sex: null, activityLevel: 'moderate', climate: 'normal', volumeUnit: 'ml', customGoalOverride: null });

    WaterLog.add({ date: today, amountMl: 500, source: 'bottle' });
    WaterLog.add({ date: today, amountMl: 250, source: 'cup' });
    WaterLog.add({ date: addDaysISO(today, -1), amountMl: 1800, source: 'bottle' });
    WaterLog.add({ date: addDaysISO(today, -2), amountMl: 2100, source: 'bottle' });
    WaterLog.add({ date: addDaysISO(today, -3), amountMl: 1400, source: 'cup' });

    BucketList.add({ title: 'Sunrise hike + journal at the summit', description: 'Combine movement with a reflection session.', category: 'nature', status: 'idea', targetDate: null, costCents: 0, url: null, imageUrl: null, completedDate: null, notes: '' });
    BucketList.add({ title: 'Book a solo spa day', description: 'A full day, phone off.', category: 'relax', status: 'planned', targetDate: addDaysISO(today, 21), costCents: 15000, url: null, imageUrl: null, completedDate: null, notes: 'Look at the place downtown.' });
    BucketList.add({ title: 'Pottery class with a friend', description: 'Try something new, together.', category: 'creative', status: 'idea', targetDate: null, costCents: null, url: null, imageUrl: null, completedDate: null, notes: '' });
    BucketList.add({ title: 'Digital detox weekend', description: 'A full weekend with no screens.', category: 'relax', status: 'done', targetDate: null, costCents: 0, url: null, imageUrl: null, completedDate: addDaysISO(today, -14), notes: 'Went better than expected.' });

    storeSet(KEYS.seeded, true);
  }
  seedIfEmpty();

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.SelfCareData = {
    KEYS: KEYS,
    JOURNAL_TOPICS: JOURNAL_TOPICS,
    MEDITATION_TYPES: MEDITATION_TYPES,
    ACTIVITY_LEVELS: ACTIVITY_LEVELS,
    CLIMATES: CLIMATES,
    WATER_SOURCES: WATER_SOURCES,
    BUCKET_CATEGORIES: BUCKET_CATEGORIES,
    BUCKET_STATUSES: BUCKET_STATUSES,
    Units: SelfCareUnits,
    Models: {
      journalEntry: journalEntryModel,
      meditation: meditationModel,
      hydrationProfile: hydrationProfileModel,
      waterLog: waterLogModel,
      bucketItem: bucketItemModel
    },
    JournalEntries: JournalEntries,
    Meditations: Meditations,
    WaterLog: WaterLog,
    BucketList: BucketList,
    getHydrationProfile: getHydrationProfile,
    saveHydrationProfile: saveHydrationProfile,
    recommendedDailyMl: recommendedDailyMl,
    entriesByTopic: entriesByTopic,
    todayIntakeMl: todayIntakeMl,
    todayProgress: todayProgress,
    intakeHistory: intakeHistory,
    bucketItemsByStatus: bucketItemsByStatus,
    bucketItemsByCategory: bucketItemsByCategory,
    todayISO: todayISO,
    addDaysISO: addDaysISO,
    daysUntil: daysUntil,
    seedIfEmpty: seedIfEmpty
  };
})(window);
