// anxiety-data.js
//
// Data foundation for anxiety.html ("Anxiety") — a dedicated page with two
// sections: Breathwork (a library of paced-breathing techniques, each
// playable through a full-screen animated breathing pacer) and Tips &
// Techniques (a filterable, favoritable card library of grounding/
// cognitive/physical/social anxiety-management techniques). Same
// conventions as household-data.js/selfcare-data.js/finance-data.js (see
// CLAUDE.md §4): plain localStorage, JSON-serialized, one key per
// collection, no server/DB. All keys live under an `anxiety:` prefix so
// anxiety.html's `initCloudSync({ syncedPrefixes: ['anxiety:'] })` call
// covers every collection here with no per-key list.

(function (global) {
  'use strict';

  function storeGet(key) {
    try { const raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  const KEYS = {
    breathwork: 'anxiety:breathwork',
    tips: 'anxiety:tips',
    seeded: 'anxiety:seeded'
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ============================================================
  // MODELS
  // ============================================================
  const BREATHWORK_GOALS = ['calm', 'focus', 'sleep', 'panic', 'other'];
  const BREATHWORK_GOAL_LABELS = { calm: 'Calm', focus: 'Focus', sleep: 'Sleep', panic: 'In the moment', other: 'Other' };

  /**
   * @typedef {Object} BreathworkTechnique
   * @property {string} id
   * @property {string} name
   * @property {string} description
   * @property {number} inhaleSec
   * @property {number} holdInSec
   * @property {number} exhaleSec
   * @property {number} holdOutSec
   * @property {number} cycles - suggested rounds, purely a default for the pacer
   * @property {'calm'|'focus'|'sleep'|'panic'|'other'} goal
   * @property {boolean} isFavorite
   * @property {number} order
   * @property {string} createdAt
   */
  function breathworkModel(data) {
    data = data || {};
    return {
      id: data.id || uid('breath'),
      name: data.name || '',
      description: data.description || '',
      inhaleSec: Math.max(1, Math.round(Number(data.inhaleSec)) || 4),
      holdInSec: Math.max(0, Math.round(Number(data.holdInSec)) || 0),
      exhaleSec: Math.max(1, Math.round(Number(data.exhaleSec)) || 4),
      holdOutSec: Math.max(0, Math.round(Number(data.holdOutSec)) || 0),
      cycles: Math.max(1, Math.round(Number(data.cycles)) || 6),
      goal: BREATHWORK_GOALS.indexOf(data.goal) !== -1 ? data.goal : 'calm',
      isFavorite: !!data.isFavorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: data.createdAt || todayISO()
    };
  }

  const TIP_CATEGORIES = ['grounding', 'cognitive', 'physical', 'social', 'other'];
  const TIP_CATEGORY_LABELS = { grounding: 'Grounding', cognitive: 'Cognitive', physical: 'Physical', social: 'Social', other: 'Other' };

  /**
   * @typedef {Object} AnxietyTip
   * @property {string} id
   * @property {string} title
   * @property {string} body
   * @property {'grounding'|'cognitive'|'physical'|'social'|'other'} category
   * @property {boolean} isFavorite
   * @property {number} order
   * @property {string} createdAt
   */
  function tipModel(data) {
    data = data || {};
    return {
      id: data.id || uid('tip'),
      title: data.title || '',
      body: data.body || '',
      category: TIP_CATEGORIES.indexOf(data.category) !== -1 ? data.category : 'other',
      isFavorite: !!data.isFavorite,
      order: typeof data.order === 'number' ? data.order : 0,
      createdAt: data.createdAt || todayISO()
    };
  }

  // ============================================================
  // GENERIC COLLECTION CRUD — same makeCollection recipe as
  // household-data.js/finance-data.js/selfcare-data.js.
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

  const Breathwork = makeCollection(KEYS.breathwork, breathworkModel);
  const Tips = makeCollection(KEYS.tips, tipModel);

  // ============================================================
  // SELECTORS
  // ============================================================
  function breathworkSorted() {
    return Breathwork.list().slice().sort(function (a, b) { return a.order - b.order || (a.createdAt || '').localeCompare(b.createdAt || ''); });
  }
  function tipsSorted() {
    return Tips.list().slice().sort(function (a, b) { return a.order - b.order || (a.createdAt || '').localeCompare(b.createdAt || ''); });
  }
  /** Total seconds for one full cycle of a technique — used by the pacer
   * to schedule phase transitions. */
  function cycleSeconds(t) {
    return (t.inhaleSec || 0) + (t.holdInSec || 0) + (t.exhaleSec || 0) + (t.holdOutSec || 0);
  }

  // ============================================================
  // SEED — a handful of well-known breathing techniques and a spread of
  // grounding/cognitive/physical/social tips, so the page is never empty
  // on first load. Guarded by anxiety:seeded, and only if both
  // collections are already empty, so it can never clobber real data
  // added later — same precedent as every other page's seedIfEmpty().
  // ============================================================
  function seedDefaultContent() {
    Breathwork.add({ name: 'Box Breathing', description: 'Four equal phases — inhale, hold, exhale, hold — used by everyone from athletes to Navy SEALs to steady focus under pressure.', inhaleSec: 4, holdInSec: 4, exhaleSec: 4, holdOutSec: 4, cycles: 6, goal: 'focus', order: 0 });
    Breathwork.add({ name: '4-7-8 Breathing', description: "Dr. Andrew Weil's technique — a longer exhale than inhale shifts the body toward rest. Good before sleep or when winding down from a spike.", inhaleSec: 4, holdInSec: 7, exhaleSec: 8, holdOutSec: 0, cycles: 4, goal: 'sleep', order: 1 });
    Breathwork.add({ name: 'Coherent Breathing', description: 'A gentle, even 5-second in / 5-second out rhythm (about 6 breaths a minute) — a steady baseline for everyday calm, no holds to track.', inhaleSec: 5, holdInSec: 0, exhaleSec: 5, holdOutSec: 0, cycles: 8, goal: 'calm', order: 2 });
    Breathwork.add({ name: 'Extended Exhale', description: 'A short inhale and a long, slow exhale — the fastest way to nudge the nervous system down when anxiety spikes in the moment.', inhaleSec: 4, holdInSec: 0, exhaleSec: 8, holdOutSec: 2, cycles: 6, goal: 'panic', order: 3 });

    Tips.add({ title: '5-4-3-2-1 Grounding', body: 'Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste. Pulls attention out of a spiraling thought and back into the room.', category: 'grounding', order: 0 });
    Tips.add({ title: 'Cold water on your wrists or face', body: 'A quick burst of cold (splash your face, hold an ice cube, run cold water over your wrists) triggers the dive reflex and can blunt a panic spike within seconds.', category: 'physical', order: 1 });
    Tips.add({ title: 'Name the thought, don’t argue with it', body: 'Instead of "this is stupid, stop thinking it," try "I’m noticing an anxious thought about X." Labeling creates a little distance without fighting it.', category: 'cognitive', order: 2 });
    Tips.add({ title: 'Text one person', body: "You don't need a whole conversation. A single low-stakes message to someone you trust breaks the isolation a spiral thrives on.", category: 'social', order: 3 });
    Tips.add({ title: 'Progressive muscle relaxation', body: 'Tense each muscle group for 5 seconds, then release, working head to toe. The contrast makes it easier to actually feel your body relax.', category: 'physical', order: 4 });
    Tips.add({ title: 'Ask "what would I tell a friend?"', body: 'Anxious thoughts are often harsher than anything you’d say to someone else in the same spot. Borrowing that kinder voice is a real reframing tool, not just a platitude.', category: 'cognitive', order: 5 });
    Tips.add({ title: 'Put both feet flat on the floor', body: 'A small, physical anchor. Notice the actual pressure of the floor under your feet for a few breaths — it’s hard to fully spiral while paying attention to something this concrete.', category: 'grounding', order: 6 });

    storeSet(KEYS.seeded, true);
  }

  function seedIfEmpty() {
    if (storeGet(KEYS.seeded)) return;
    if (Breathwork.list().length || Tips.list().length) {
      storeSet(KEYS.seeded, true);
      return;
    }
    seedDefaultContent();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  global.AnxietyData = {
    KEYS: KEYS,
    BREATHWORK_GOALS: BREATHWORK_GOALS,
    BREATHWORK_GOAL_LABELS: BREATHWORK_GOAL_LABELS,
    TIP_CATEGORIES: TIP_CATEGORIES,
    TIP_CATEGORY_LABELS: TIP_CATEGORY_LABELS,
    Models: { breathwork: breathworkModel, tip: tipModel },
    Breathwork: Breathwork,
    Tips: Tips,
    breathworkSorted: breathworkSorted,
    tipsSorted: tipsSorted,
    cycleSeconds: cycleSeconds,
    todayISO: todayISO,
    uid: uid,
    seedIfEmpty: seedIfEmpty
  };
})(window);
